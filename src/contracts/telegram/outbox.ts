import type { ActorHash, TelegramMessageId, UnixMillis } from "../primitives";

export type TelegramOutboxSendStatus = "pending" | "sent" | "failed";

export type TelegramOutboxMethod =
  | "sendMessage"
  | "sendPhoto"
  | "sendVideo"
  | "sendAnimation"
  | "sendDocument"
  | "sendSticker"
  | "sendVoice"
  | "sendVideoNote"
  | "sendAudio"
  | "answerCallbackQuery";

export type TelegramOutboxPayload = Readonly<{
  text?: string;
  parse_mode?: "HTML";
  reply_markup?: unknown;
  callback_query_id?: string;
  reply_to_message_id?: TelegramMessageId;
  message_id?: TelegramMessageId;
  chat_id?: number;
  photo?: string;
  video?: string;
  animation?: string;
  document?: string;
  sticker?: string;
  voice?: string;
  video_note?: string;
  audio?: string;
  caption?: string;
}>;

export type TelegramOutboxJob = Readonly<{
  idempotencyKey: string;
  kind?: "telegram";
  chatCiphertext: string;
  chatHash: ActorHash;
  method: TelegramOutboxMethod;
  payload: TelegramOutboxPayload;
  priority: "normal" | "low";
  createdAt: UnixMillis;
}>;

export type TelegramOutboxSendResult = Readonly<{
  ok: boolean;
  duplicate?: boolean;
  permanentFailure?: boolean;
  retryable?: boolean;
  delaySeconds?: number;
  telegramMessageId?: string | null;
}>;
