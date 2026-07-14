import type { Environment } from "../../contracts/runtime";
import type { MessagePayload } from "../../contracts/telegram/delivery";
import { decryptEnvelope } from "./envelope";
import { payloadAad } from "./keys";
import { createSealedTicket, payloadCapsuleToMessagePayload } from "./create-sealed-ticket";
import type {
  RouteCapsule,
  SendMessageInput,
  CreateSealedTicketResult,
  TicketPayloadCapsule as PayloadCapsule,
} from "../../contracts/ticketing/model";
import type { ResolvedTicketAction } from "../../contracts/ticketing/actions";
import { enqueueTelegramOutbox } from "../../storage/telegram-outbox-client";
import {
  markTicketViewed,
} from "../../storage/ticket-vault/ticket-vault.client";

export const hasDeliverablePayload = (payload: MessagePayload): boolean => {
  if (!payload.message_type) {
    return false;
  }
  if (payload.message_type === "text") {
    return !!payload.message_text?.trim();
  }
  return true;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMessagePayload = (value: unknown): value is MessagePayload => {
  if (!isRecord(value)) {
    return false;
  }
  if (!Number.isSafeInteger(value.telegramMessageId)) {
    return false;
  }
  if (!Number.isSafeInteger(value.createdAt)) {
    return false;
  }
  if (
    value.message_type !== undefined &&
    typeof value.message_type !== "string"
  ) {
    return false;
  }
  if (
    value.message_text !== undefined &&
    typeof value.message_text !== "string"
  ) {
    return false;
  }
  return true;
};

const isPayloadCapsule = (value: unknown): value is PayloadCapsule => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.type === "text") {
    return (
      typeof value.text === "string" &&
      Number.isSafeInteger(value.telegramMessageId) &&
      Number.isSafeInteger(value.createdAt)
    );
  }
  if (value.type === "telegram") {
    return isMessagePayload(value.payload);
  }
  return false;
};

export const sendAnonymousMessage = async (
  env: Environment,
  input: SendMessageInput
): Promise<CreateSealedTicketResult> => createSealedTicket(env, input);

export const notifyMessageSeenRoute = async (
  env: Environment,
  chatCiphertext: string,
  chatHash: string,
  idempotencyKey: string,
  parentMessageId?: number
): Promise<void> => {
  const { YOUR_MESSAGE_SEEN_MESSAGE } = await import("../../i18n/messages");

  await enqueueTelegramOutbox(env, {
    idempotencyKey,
    chatCiphertext,
    chatHash,
    method: "sendMessage",
    payload: {
      text: YOUR_MESSAGE_SEEN_MESSAGE,
      ...(parentMessageId ? { reply_to_message_id: parentMessageId } : {}),
    },
    priority: "low",
    createdAt: Date.now(),
  });
};

export const deliveryContextFromResolvedTicket = async (
  resolved: ResolvedTicketAction,
  senderLabel?: string
): Promise<{
  payload: MessagePayload;
  route: RouteCapsule;
  senderLabel?: string;
}> => {
  if (!resolved.ticket.payloadEnc) {
    throw new Error("Missing payload");
  }

  const capsule = await decryptEnvelope<unknown>(
    resolved.payloadKey,
    resolved.ticket.payloadEnc,
    payloadAad(resolved.ticketHash)
  );
  if (!isPayloadCapsule(capsule)) {
    throw new Error("Invalid payload capsule");
  }
  const payload = payloadCapsuleToMessagePayload(capsule);

  return {
    payload,
    route: resolved.route,
    ...(senderLabel ? { senderLabel } : {}),
  };
};

export const markResolvedTicketViewed = async (
  env: Environment,
  _userId: string,
  resolved: ResolvedTicketAction
): Promise<void> => {
  await markTicketViewed(env, resolved.ticketHash);
};
