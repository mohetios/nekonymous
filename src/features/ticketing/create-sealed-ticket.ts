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
import { createTicketCapability, encodeTicketCapability } from "./ticket-capability";
import { ensureUserStateInitialized } from "../identity/identity-service";
import { recordMessageCreated } from "../../stats/product-events";
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
import { enqueueFreshUnreadNotification } from "./inbox-notification";
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
  const capability = createTicketCapability();
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
    return { ok: false, status: 403 };
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
    replyToMessageId: input.isThreadReply ? input.replyToMessageId : undefined,
  };
  const meta = {
    displayNumber: displayNumberForTicketHash(ticketHash),
    createdAt: now,
  } satisfies TicketMetadata;

  const canReceive = await checkCanReceive(env, input.recipient.id, blockTag);
  if (!canReceive.ok) {
    return { ok: false, status: 403 };
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

  await storeTicket(env, {
    ticketHash,
    ownerProofTag,
    routeEnc,
    payloadEnc,
    metaEnc,
    createdAt: now,
    expiresAt,
  });

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
    await cleanupStoredTicket(env, ticketHash);
    return { ok: false, status: 500 };
  }

  if (!inboxResult.ok) {
    await cleanupStoredTicket(env, ticketHash);
    return { ok: false, status: inboxResult.status };
  }

  if (inboxResult.duplicate) {
    await cleanupStoredTicket(env, ticketHash);
    return {
      ok: true,
      status: 200,
      duplicate: true,
      pendingCount: inboxResult.unreadCount,
    };
  }

  if (
    typeof inboxResult.unreadCount !== "number" ||
    inboxResult.unreadCount < 1
  ) {
    await cleanupStoredTicket(env, ticketHash);
    return { ok: false, status: 500 };
  }

  await enqueueFreshUnreadNotification(
    env,
    input.recipient,
    itemId
  ).catch(() => undefined);

  await recordMessageCreated(env);

  return {
    ok: true,
    status: 200,
    pendingCount: inboxResult.unreadCount,
    ticketHash,
  };
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
