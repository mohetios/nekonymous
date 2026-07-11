import type {
  Conversation,
  D1User,
  Environment,
  MessagePayload,
} from "../../types";
import { decryptEnvelope } from "../ticketing/envelope";
import { payloadAad } from "../ticketing/keys";
import { OPEN_INBOX_BUTTON } from "../../i18n/labels";
import { UNREAD_INBOX_MESSAGE } from "../../i18n/messages";
import { createSealedTicket, payloadCapsuleToMessagePayload } from "./create-sealed-ticket";
import type {
  PayloadCapsule,
  RouteCapsule,
} from "./create-sealed-ticket";
import type { ResolvedTicketAction } from "./resolve-ticket-action";
import { enqueueTelegramOutbox } from "../../storage/telegram-outbox-client";
import {
  markTicketViewed,
} from "../../storage/ticket-vault/ticket-vault.client";
import { markInboxPointerViewed } from "../../storage/user-state-client";
import { INBOX_MENU_CALLBACK } from "../../utils/telegram-callbacks";
import { messageCreatedOutboxEventKey } from "./outbox-event-key";

export const hasDeliverablePayload = (payload: MessagePayload): boolean => {
  if (!payload.message_type) {
    return false;
  }
  if (payload.message_type === "text") {
    return !!payload.message_text?.trim();
  }
  return true;
};

export type SendMessageInput = {
  sender: D1User;
  recipient: D1User;
  payload: MessagePayload;
  linkSlug: string;
  isThreadReply: boolean;
  replyToMessageId?: number;
  /** Override inbox dedupe key (e.g. per match request id). */
  dedupeKey?: string;
};

export const sendAnonymousMessage = async (
  env: Environment,
  input: SendMessageInput
): Promise<{
  ok: boolean;
  status: number;
  pendingCount?: number;
  notify?: boolean;
  ticketHash?: string;
}> => {
  const result = await createSealedTicket(env, input);
  if (!result.ok) {
    return { ok: false, status: result.status };
  }

  const unreadCount = result.pendingCount;
  const shouldNotify =
    !result.duplicate &&
    typeof unreadCount === "number" &&
    unreadCount > 0;

  return {
    ok: true,
    status: 200,
    pendingCount: unreadCount,
    notify: shouldNotify,
    ticketHash: result.ticketHash,
  };
};

export const notifyRecipientInbox = async (
  env: Environment,
  recipient: D1User,
  pendingCount: number,
  sourceEventId: string
): Promise<void> => {
  if (!Number.isFinite(pendingCount) || pendingCount < 1) {
    return;
  }
  const text = UNREAD_INBOX_MESSAGE(pendingCount);
  await enqueueTelegramOutbox(env, {
    idempotencyKey: messageCreatedOutboxEventKey(sourceEventId),
    chatCiphertext: recipient.telegram_chat_ciphertext,
    chatHash: recipient.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: OPEN_INBOX_BUTTON,
              callback_data: INBOX_MENU_CALLBACK.open,
            },
          ],
        ],
      },
    },
    priority: "low",
    createdAt: Date.now(),
  });
};

export const notifyMessageSeen = async (
  env: Environment,
  sender: D1User,
  parentMessageId?: number
): Promise<void> => {
  const { YOUR_MESSAGE_SEEN_MESSAGE } = await import("../../i18n/messages");

  await enqueueTelegramOutbox(env, {
    idempotencyKey: `seen:${sender.id}:${parentMessageId ?? "none"}`,
    chatCiphertext: sender.telegram_chat_ciphertext,
    chatHash: sender.telegram_user_hash,
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
  ownerContactLabels: Record<string, string>
): Promise<{
  payload: MessagePayload;
  route: RouteCapsule;
  senderLabel?: string;
}> => {
  if (!resolved.ticket.payloadEnc) {
    throw new Error("Missing payload");
  }

  const capsule = await decryptEnvelope<PayloadCapsule>(
    resolved.ticketKey,
    resolved.ticket.payloadEnc,
    payloadAad(resolved.ticketHash)
  );
  const payload = payloadCapsuleToMessagePayload(capsule);
  const senderLabel = resolved.route.senderAlias
    ? ownerContactLabels[resolved.route.senderAlias]
    : undefined;

  return {
    payload,
    route: resolved.route,
    senderLabel,
  };
};

export const markResolvedTicketViewed = async (
  env: Environment,
  userId: string,
  ticketHash: string
): Promise<void> => {
  await Promise.all([
    markTicketViewed(env, ticketHash),
    markInboxPointerViewed(env, userId, ticketHash),
  ]);
};

export const toTicketDeliveryConversation = (
  route: RouteCapsule,
  payload: MessagePayload,
  senderChatId: number,
  recipientChatId: number
): Conversation => ({
  connection: {
    from: senderChatId,
    to: recipientChatId,
    senderLinkUuid: route.linkSlug,
    parent_message_id: route.parentMessageId,
    reply_to_message_id: route.replyToMessageId,
  },
  payload: {
    message_type: payload.message_type,
    message_text: payload.message_text,
    photo_id: payload.photo_id,
    video_id: payload.video_id,
    animation_id: payload.animation_id,
    document_id: payload.document_id,
    sticker_id: payload.sticker_id,
    voice_id: payload.voice_id,
    video_note_id: payload.video_note_id,
    audio_id: payload.audio_id,
    caption: payload.caption,
  },
});
