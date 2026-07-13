import { INBOX_MENU_CALLBACK } from "../../bot/callback-data";
import { INBOX_FRESH_NOTICE_MESSAGE } from "../../i18n/messages";
import type { D1User } from "../../contracts/identity/model";
import type { Environment } from "../../contracts/runtime";
import { enqueueTelegramOutbox } from "../../storage/telegram-outbox-client";

const noticeReplyMarkup = {
  inline_keyboard: [
    [
      {
        text: "📥 تحویل نامه‌ها",
        callback_data: INBOX_MENU_CALLBACK.deliver,
      },
    ],
  ],
};

export const enqueueFreshUnreadNotification = async (
  env: Environment,
  recipient: D1User,
  unreadEventKey: string
): Promise<void> => {
  await enqueueTelegramOutbox(env, {
    idempotencyKey: `inbox-notice:${unreadEventKey}`,
    kind: "telegram",
    chatCiphertext: recipient.telegram_chat_ciphertext,
    chatHash: recipient.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text: INBOX_FRESH_NOTICE_MESSAGE,
      parse_mode: "HTML",
      reply_markup: noticeReplyMarkup,
    },
    priority: "low",
    createdAt: Date.now(),
  });
};
