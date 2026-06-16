import type { Environment } from "../types";
import type { TelegramOutboxJob } from "./types";
import { sendViaOutboxDo } from "../services/outbox-service";

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
