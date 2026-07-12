import type { D1User, Environment, MessagePayload } from "../../types";
import { encryptEnvelope } from "./envelope";
import {
  createOwnerProofTag,
  createPairTag,
  createTicketHash,
  deriveTicketKey,
  payloadAad,
  randomTicketRef,
  routeAad,
} from "./keys";
import { createMessageDedupeKey, getSenderAlias } from "./ticketing-service";
import { ensureUserStateInitialized } from "../identity/identity-service";
import { recordMessageCreated } from "../../stats/product-events";
import {
  addInboxPointer,
  type AddInboxPointerResult,
} from "../../storage/user-state-client";
import {
  deleteTicketRecord,
  expireTicketRecord,
  storeTicket,
} from "../../storage/ticket-vault/ticket-vault.client";
import {
  createdBucketForTime,
  displayNumberForTicketHash,
  inboxExpiresAt,
  sealInboxTicketRef,
} from "./inbox-pointer";

export type RouteCapsule = {
  senderChatRoute: string;
  recipientRouteTag: string;
  senderRouteTag: string;
  pairTag: string;
  reportSeeds: {
    senderAbuseSeed: string;
    pairAbuseSeed: string;
    linkAbuseSeed?: string;
  };
  replyPolicy: {
    canReply: boolean;
    maxChars: number;
  };
  senderAlias?: string;
  linkSlug?: string;
  parentMessageId?: number;
  replyToMessageId?: number;
  createdAt: number;
};

export type PayloadCapsule =
  | {
      type: "text";
      text: string;
      telegramMessageId: number;
      createdAt: number;
    }
  | {
      type: "telegram";
      payload: MessagePayload;
      createdAt: number;
    };

export type CreateSealedTicketInput = {
  sender: D1User;
  recipient: D1User;
  payload: MessagePayload;
  linkSlug: string;
  isThreadReply: boolean;
  replyToMessageId?: number;
  dedupeKey?: string;
};

export type CreateSealedTicketResult = {
  ok: boolean;
  status: number;
  pendingCount?: number;
  duplicate?: boolean;
  ticketHash?: string;
};

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

const expireTicketHashesBestEffort = async (
  env: Environment,
  ticketHashes: string[] | undefined
): Promise<void> => {
  if (!ticketHashes || ticketHashes.length === 0) {
    return;
  }

  await Promise.all(
    ticketHashes.map((ticketHash) =>
      expireTicketRecord(env, ticketHash).catch(() => undefined)
    )
  );
};

export const createSealedTicket = async (
  env: Environment,
  input: CreateSealedTicketInput
): Promise<CreateSealedTicketResult> => {
  const now = Date.now();
  const createdBucket = createdBucketForTime(now);
  const expiresAt = inboxExpiresAt(now);
  const ticketRef = randomTicketRef();
  const ticketHash = await createTicketHash(env.APP_HMAC_PEPPER, ticketRef);
  const ownerProofTag = await createOwnerProofTag(
    env.APP_HMAC_PEPPER,
    input.recipient.telegram_user_hash,
    ticketHash
  );
  const ticketKey = await deriveTicketKey(env.APP_MASTER_KEY, ticketHash);
  const senderAlias = await getSenderAlias(
    input.recipient.id,
    input.sender.id,
    env.APP_MASTER_KEY
  );
  const pairTag = await createPairTag(
    env.APP_HMAC_PEPPER,
    input.sender.telegram_user_hash,
    input.recipient.telegram_user_hash
  );

  const route: RouteCapsule = {
    senderChatRoute: input.sender.telegram_chat_ciphertext,
    recipientRouteTag: input.recipient.telegram_user_hash,
    senderRouteTag: input.sender.telegram_user_hash,
    pairTag,
    reportSeeds: {
      senderAbuseSeed: input.sender.telegram_user_hash,
      pairAbuseSeed: pairTag,
      linkAbuseSeed: input.linkSlug,
    },
    replyPolicy: {
      canReply: true,
      maxChars: 4096,
    },
    senderAlias,
    linkSlug: input.linkSlug,
    parentMessageId: input.payload.telegramMessageId,
    replyToMessageId: input.isThreadReply ? input.replyToMessageId : undefined,
    createdAt: now,
  };

  const [routeEnc, payloadEnc, sealedTicketRef] = await Promise.all([
    encryptEnvelope(
      ticketKey,
      JSON.stringify(route),
      routeAad(ticketHash),
      "ticket-route:v1"
    ),
    encryptEnvelope(
      ticketKey,
      JSON.stringify(payloadCapsuleFromMessage(input.payload)),
      payloadAad(ticketHash),
      "ticket-payload:v1"
    ),
    sealInboxTicketRef(env, ticketHash, ticketRef),
  ]);

  const dedupeKey =
    input.dedupeKey ??
    (await createMessageDedupeKey(
      env.APP_HMAC_PEPPER,
      input.sender.telegram_user_hash,
      input.recipient.telegram_user_hash,
      input.payload.telegramMessageId
    ));

  await storeTicket(env, {
    ticketHash,
    ownerProofTag,
    routeEnc,
    payloadEnc,
    createdAt: now,
    expiresAt,
  });

  await ensureUserStateInitialized(env, input.recipient.id);

  let inboxResult: AddInboxPointerResult;
  try {
    inboxResult = await addInboxPointer(env, input.recipient.id, {
      ticketHash,
      sealedTicketRef,
      displayNumber: displayNumberForTicketHash(ticketHash),
      createdBucket,
      createdAt: now,
      expiresAt,
      dedupeKey,
    });
  } catch {
    await cleanupStoredTicket(env, ticketHash);
    return { ok: false, status: 500 };
  }

  if (!inboxResult.ok) {
    await cleanupStoredTicket(env, ticketHash);
    return { ok: false, status: inboxResult.status };
  }

  await expireTicketHashesBestEffort(env, inboxResult.evictedTicketHashes);

  if (inboxResult.duplicate) {
    await cleanupStoredTicket(env, ticketHash);
    return {
      ok: true,
      status: 200,
      duplicate: true,
      pendingCount: inboxResult.pendingCount,
      ticketHash,
    };
  }

  if (
    typeof inboxResult.pendingCount !== "number" ||
    inboxResult.pendingCount < 1
  ) {
    await cleanupStoredTicket(env, ticketHash);
    return { ok: false, status: 500 };
  }

  await recordMessageCreated(env);

  return {
    ok: true,
    status: 200,
    pendingCount: inboxResult.pendingCount,
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
