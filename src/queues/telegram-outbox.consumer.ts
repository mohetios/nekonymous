import type { Environment } from "../types";
import type { TelegramOutboxJob } from "./telegram-outbox.types";
import { sendViaOutboxDo } from "../storage/telegram-outbox-client";

export const handleTelegramOutboxBatch = async (
  batch: MessageBatch<TelegramOutboxJob>,
  env: Environment
): Promise<void> => {
  for (const message of batch.messages) {
    try {
      const result = await sendViaOutboxDo(env, message.body);
      if (result.ok) {
        message.ack();
      } else {
        message.retry();
      }
    } catch {
      message.retry();
    }
  }
};
