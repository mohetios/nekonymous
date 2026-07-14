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

export type TelegramOutboxSendResult = Readonly<
  | {
      status: "sent";
      duplicate: boolean;
      telegramMessageId: string | null;
    }
  | {
      status: "retry";
      delaySeconds: number;
    }
  | {
      status: "rejected";
      reason: "permanent" | "invalid";
    }
>;

export type TelegramOutboxSentRow = Readonly<{
  idempotency_key: string;
  status: TelegramOutboxSendStatus;
  telegram_message_id: string | null;
  lease_attempt_id: string | null;
  lease_until: number | null;
  attempts: number;
  permanent_error: number;
}>;

export type TelegramApiResponse = Readonly<{
  ok: boolean;
  result?: { message_id?: number };
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}>;
