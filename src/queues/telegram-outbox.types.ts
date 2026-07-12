export type TelegramOutboxSendResult = {
  ok: boolean;
  duplicate?: boolean;
  permanentFailure?: boolean;
  retryable?: boolean;
  delaySeconds?: number;
  telegramMessageId?: string | null;
};

export type TelegramOutboxJob = {
  idempotencyKey: string;

  chatCiphertext: string;
  chatHash: string;

  method: "sendMessage" | "editMessageText" | "answerCallbackQuery";

  payload: {
    text?: string;
    parse_mode?: "HTML";
    reply_markup?: unknown;
    callback_query_id?: string;
    reply_to_message_id?: number;
    message_id?: number;
    chat_id?: number;
  };

  priority: "normal" | "low";
  createdAt: number;
};
