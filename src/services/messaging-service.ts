import type {
  ConnectionMetadata,
  Conversation,
  D1User,
  Environment,
  MessagePayload,
} from "../types";
import {
  buildDedupeKey,
  decryptConnectionMetadata,
  decryptMessagePayload,
  derivePairConversationId,
  encryptConnectionMetadata,
  encryptMessagePayload,
  generateCallbackRef,
  generateTicketId,
  getSenderAlias,
  pairConversationKey,
} from "./crypto-service";
import { upsertConversationSummary } from "./conversation-summary-service";
import { ensureUserStateInitialized } from "./identity-service";
import {
  addInboxTicket,
  getInboxTicket,
} from "./user-state-service";
import { enqueueTelegramOutbox } from "./outbox-service";

const parseMessagePayload = (raw: string): MessagePayload | null => {
  try {
    const data = JSON.parse(raw) as MessagePayload;
    if (!data || typeof data !== "object") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const hasDeliverablePayload = (payload: MessagePayload): boolean => {
  if (!payload.message_type) {
    return false;
  }
  if (payload.message_type === "text") {
    return !!payload.message_text?.trim();
  }
  return true;
};

export const loadTicketForAction = async (
  env: Environment,
  recipientUserId: string,
  ref: string
): Promise<{
  ticket: Awaited<ReturnType<typeof getInboxTicket>>;
  connection: ConnectionMetadata;
} | null> => {
  const ticket = await getInboxTicket(env, recipientUserId, ref);
  if (!ticket) {
    return null;
  }

  try {
    const connection = JSON.parse(
      await decryptConnectionMetadata(
        ticket.ticketId,
        ticket.connectionCiphertext,
        env.APP_MASTER_KEY
      )
    ) as ConnectionMetadata;
    return { ticket, connection };
  } catch {
    return null;
  }
};

const decryptTicketPayload = async (
  ticketId: string,
  payloadCiphertext: string,
  appMasterKey: string
): Promise<MessagePayload | null> => {
  try {
    const raw = await decryptMessagePayload(
      ticketId,
      payloadCiphertext,
      appMasterKey
    );
    return parseMessagePayload(raw);
  } catch {
    return null;
  }
};

export type SendMessageInput = {
  sender: D1User;
  recipient: D1User;
  payload: MessagePayload;
  linkSlug: string;
  isThreadReply: boolean;
  replyToMessageId?: number;
};

export const sendAnonymousMessage = async (
  env: Environment,
  input: SendMessageInput
): Promise<{
  ok: boolean;
  status: number;
  pendingCount?: number;
  notify?: boolean;
}> => {
  const ticketId = generateTicketId();
  const ref = generateCallbackRef();
  const conversationId = await derivePairConversationId(
    input.sender.id,
    input.recipient.id,
    env.APP_MASTER_KEY
  );
  const senderAlias = await getSenderAlias(
    input.recipient.id,
    input.sender.id,
    env.APP_MASTER_KEY
  );

  const connection: ConnectionMetadata = {
    senderUserId: input.sender.id,
    recipientUserId: input.recipient.id,
    conversationId,
    ticketId,
    senderAlias,
    linkSlug: input.linkSlug,
    parent_message_id: input.payload.telegramMessageId,
    reply_to_message_id: input.isThreadReply
      ? input.replyToMessageId
      : undefined,
    createdAt: input.payload.createdAt,
  };

  const [payloadCiphertext, connectionCiphertext] = await Promise.all([
    encryptMessagePayload(
      ticketId,
      JSON.stringify(input.payload),
      env.APP_MASTER_KEY
    ),
    encryptConnectionMetadata(
      ticketId,
      JSON.stringify(connection),
      env.APP_MASTER_KEY
    ),
  ]);

  const dedupeKey = buildDedupeKey(
    input.sender.id,
    input.recipient.id,
    input.payload.telegramMessageId
  );

  await ensureUserStateInitialized(env, input.recipient.id);

  const result = await addInboxTicket(env, input.recipient.id, {
    ref,
    ticketId,
    senderUserId: input.sender.id,
    recipientUserId: input.recipient.id,
    conversationId,
    payloadCiphertext,
    connectionCiphertext,
    dedupeKey,
  });

  if (!result.ok) {
    return { ok: false, status: result.status };
  }

  const [userA, userB] = pairConversationKey(
    input.sender.id,
    input.recipient.id
  );
  try {
    await upsertConversationSummary(env, conversationId, userA, userB);
  } catch {
    // Ticket is already accepted; summary is best-effort analytics.
  }

  return {
    ok: true,
    status: 200,
    pendingCount: result.pendingCount,
    notify: !result.duplicate,
  };
};

export const notifyRecipientInbox = async (
  env: Environment,
  recipient: D1User,
  pendingCount: number
): Promise<void> => {
  const { NEW_INBOX_MESSAGE } = await import("../utils/messages");
  const { convertToPersianNumbers } = await import("../utils/tools");
  const { getTelegramChatId } = await import("./identity-service");

  const chatId = await getTelegramChatId(recipient, env);
  const response = await fetch(
    `https://api.telegram.org/bot${env.SECRET_TELEGRAM_API_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: NEW_INBOX_MESSAGE.replace(
          "COUNT",
          convertToPersianNumbers(pendingCount)
        ),
        parse_mode: "HTML",
      }),
    }
  );

  if (!response.ok) {
    throw new Error("inbox notify failed");
  }
};

export const notifyMessageSeen = async (
  env: Environment,
  sender: D1User,
  parentMessageId?: number
): Promise<void> => {
  const { YOUR_MESSAGE_SEEN_MESSAGE } = await import("../utils/messages");

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

export const deliveryContextFromTicket = async (
  env: Environment,
  ticket: NonNullable<Awaited<ReturnType<typeof getInboxTicket>>>,
  ownerContactLabels: Record<string, string>,
  blockedUserIds: string[]
): Promise<{
  payload: MessagePayload;
  connection: ConnectionMetadata;
  senderLabel?: string;
  isBlocked: boolean;
}> => {
  const connection = JSON.parse(
    await decryptConnectionMetadata(
      ticket.ticketId,
      ticket.connectionCiphertext,
      env.APP_MASTER_KEY
    )
  ) as ConnectionMetadata;

  if (!ticket.payloadCiphertext) {
    throw new Error("Missing payload");
  }

  const payload = await decryptTicketPayload(
    ticket.ticketId,
    ticket.payloadCiphertext,
    env.APP_MASTER_KEY
  );
  if (!payload) {
    throw new Error("Invalid payload");
  }

  const senderLabel = connection.senderAlias
    ? ownerContactLabels[connection.senderAlias]
    : undefined;

  return {
    payload,
    connection,
    senderLabel,
    isBlocked: blockedUserIds.includes(connection.senderUserId),
  };
};

export const toLegacyConversation = (
  connection: ConnectionMetadata,
  payload: MessagePayload,
  senderChatId: number,
  recipientChatId: number
): Conversation => ({
  connection: {
    from: senderChatId,
    to: recipientChatId,
    senderLinkUuid: connection.linkSlug,
    parent_message_id: connection.parent_message_id,
    reply_to_message_id: connection.reply_to_message_id,
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
