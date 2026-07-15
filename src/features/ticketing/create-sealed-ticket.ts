import type { Environment } from "../../contracts/runtime";
import type { MessagePayload } from "../../contracts/telegram/delivery";
import { encryptEnvelope } from "./envelope";
import {
  createOwnerProofTag,
  createTicketHash,
  createUnreadInboxDedupeTag,
  deriveTicketKeys,
  metaAad,
  payloadAad,
  routeAad,
} from "./keys";
import { createTicketCapability, createDeterministicTicketCapability, encodeTicketCapability } from "./ticket-capability";
import { ensureUserStateInitialized } from "../identity/identity-service";
import {
  addUnreadItem,
  checkCanReceive,
} from "../../storage/user-state-client";
import type { AddUnreadItemResult } from "../../contracts/inbox/rpc";
import {
  deleteTicketRecord,
  storeTicket,
} from "../../storage/ticket-vault/ticket-vault.client";
import { displayNumberForTicketHash, ticketExpiresAt } from "./ticket-lifecycle";
import { sealUnreadCapability } from "./unread-capability";
import {
  createAbuseSubjectTag,
  createBlockTag,
  createContactTag,
} from "./blind-tags";
import { getSafetyDecision } from "../../storage/safety-state/safety-state.client";

import type {
  CreateSealedTicketInput,
  CreateSealedTicketResult,
  RouteCapsule,
  TicketMetadata,
  TicketPayloadCapsule as PayloadCapsule,
} from "../../contracts/ticketing/model";

const payloadCapsuleFromMessage = (payload: MessagePayload): PayloadCapsule => {
  if (payload.message_type === "text" && payload.message_text !== undefined) {
    return {
      type: "text",
      text: payload.message_text,
      telegramMessageId: payload.telegramMessageId,
      createdAt: payload.createdAt,
    };
  }

  return {
    type: "telegram",
    payload,
    createdAt: payload.createdAt,
  };
};

const cleanupStoredTicket = async (
  env: Environment,
  ticketHash: string
): Promise<void> => {
  try {
    await deleteTicketRecord(env, ticketHash);
  } catch {
    // Best-effort cleanup for failed cross-DO writes.
  }
};

export const createSealedTicket = async (
  env: Environment,
  input: CreateSealedTicketInput
): Promise<CreateSealedTicketResult> => {
  const now = Date.now();
  const expiresAt = ticketExpiresAt(now);
  const capability = input.dedupeKey
    ? await createDeterministicTicketCapability(
        env.APP_MASTER_KEY,
        input.dedupeKey
      )
    : createTicketCapability();
  const ticketCapability = encodeTicketCapability(capability);
  const ticketHash = await createTicketHash(env.APP_HMAC_PEPPER, capability);
  const ownerProofTag = await createOwnerProofTag(
    env.APP_HMAC_PEPPER,
    input.recipient.telegram_user_hash,
    input.recipient.id,
    ticketHash
  );
  const ticketKeys = await deriveTicketKeys(
    env.APP_MASTER_KEY,
    ticketHash,
    capability
  );
  const [contactTag, blockTag, abuseSubjectTag] = await Promise.all([
    createContactTag(env.APP_HMAC_PEPPER, input.recipient.id, input.sender.id),
    createBlockTag(
      env.APP_HMAC_PEPPER,
      input.recipient.id,
      input.sender.telegram_user_hash
    ),
    createAbuseSubjectTag(env.APP_HMAC_PEPPER, input.sender.telegram_user_hash),
  ]);

  const safetyDecision = await getSafetyDecision(env, abuseSubjectTag);
  if (!safetyDecision.allowed) {
    return { ok: false, status: 403, reason: "safety" };
  }

  const route: RouteCapsule = {
    senderChatRoute: input.sender.telegram_chat_ciphertext,
    replyRouteTag: input.sender.telegram_user_hash,
    contactTag,
    blockTag,
    abuseSubjectTag,
    replyPolicy: {
      canReply: true,
      maxChars: 4096,
    },
    parentMessageId: input.payload.telegramMessageId,
    ...(input.isThreadReply && input.replyToMessageId !== undefined
      ? { replyToMessageId: input.replyToMessageId }
      : {}),
  };
  const meta = {
    displayNumber: displayNumberForTicketHash(ticketHash),
    createdAt: now,
  } satisfies TicketMetadata;

  // Always enforce receive gate — block/pause may change after the parent ticket.
  const canReceive = await checkCanReceive(env, input.recipient.id, blockTag);
  if (!canReceive.ok) {
    return {
      ok: false,
      status: 403,
      reason:
        canReceive.reason === "blocked"
          ? "blocked"
          : canReceive.reason === "paused"
            ? "paused"
            : "blocked",
    };
  }

  const routeSize = new TextEncoder().encode(JSON.stringify(route)).length;
  if (routeSize > 1024) {
    return { ok: false, status: 500 };
  }

  const [routeEnc, payloadEnc, metaEnc] = await Promise.all([
    encryptEnvelope(
      ticketKeys.routeKey,
      JSON.stringify(route),
      routeAad(ticketHash),
      "ticket-route"
    ),
    encryptEnvelope(
      ticketKeys.payloadKey,
      JSON.stringify(payloadCapsuleFromMessage(input.payload)),
      payloadAad(ticketHash),
      "ticket-payload"
    ),
    encryptEnvelope(
      ticketKeys.metaKey,
      JSON.stringify(meta),
      metaAad(ticketHash),
      "ticket-meta"
    ),
  ]);

  const storeResult = await storeTicket(env, {
    ticketHash,
    ownerProofTag,
    routeEnc,
    payloadEnc,
    metaEnc,
    createdAt: now,
    expiresAt,
  });
  const createdThisInvocation = storeResult === "created";

  let unreadAccepted = false;
  try {
    await ensureUserStateInitialized(env, input.recipient.id);

    const dedupeTag = await createUnreadInboxDedupeTag(
      env.APP_HMAC_PEPPER,
      ticketHash
    );
    const itemId = crypto.randomUUID();
    const sealedCapabilityEnc = await sealUnreadCapability(
      env.APP_MASTER_KEY,
      input.recipient.id,
      itemId,
      dedupeTag,
      ticketCapability
    );

    let inboxResult: AddUnreadItemResult;
    try {
      inboxResult = await addUnreadItem(env, input.recipient.id, {
        itemId,
        sealedCapabilityEnc,
        dedupeTag,
        createdAt: now,
        expiresAt,
      });
    } catch {
      return { ok: false, status: 500 };
    }

    if (!inboxResult.ok) {
      return {
        ok: false,
        status: inboxResult.status,
        ...(inboxResult.status === 429 ? { reason: "full" as const } : {}),
      };
    }

    if (inboxResult.duplicate) {
      // Unread already owns this ticketHash; keep the vault record.
      unreadAccepted = true;
      return {
        ok: true,
        status: 200,
        duplicate: true,
        ticketHash,
        ...(inboxResult.unreadCount !== undefined
          ? { pendingCount: inboxResult.unreadCount }
          : {}),
      };
    }

    if (
      typeof inboxResult.unreadCount !== "number" ||
      inboxResult.unreadCount < 1
    ) {
      return { ok: false, status: 500 };
    }

    unreadAccepted = true;

    return {
      ok: true,
      status: 200,
      pendingCount: inboxResult.unreadCount,
      ticketHash,
      ...(inboxResult.notification.required
        ? {
            notify: {
              eventId: inboxResult.notification.eventId,
            },
          }
        : {}),
    };
  } finally {
    // Only compensate tickets this invocation created — never delete a
    // deterministic ticket that already existed from a prior accept attempt.
    if (!unreadAccepted && createdThisInvocation) {
      await cleanupStoredTicket(env, ticketHash);
    }
  }
};

export const payloadCapsuleToMessagePayload = (
  capsule: PayloadCapsule
): MessagePayload => {
  if (capsule.type === "text") {
    return {
      message_type: "text",
      message_text: capsule.text,
      telegramMessageId: capsule.telegramMessageId,
      createdAt: capsule.createdAt,
    };
  }

  return capsule.payload;
};
