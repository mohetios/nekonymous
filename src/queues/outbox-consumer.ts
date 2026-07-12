import type { Environment } from "../types";
import type { TelegramOutboxJob } from "./telegram-outbox.types";
import { sendViaOutboxDo } from "../storage/telegram-outbox-client";

const OUTBOX_CHAT_CONCURRENCY = 4;

const mapBounded = async <T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> => {
  let index = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const current = index++;
        await fn(items[current]);
      }
    })
  );
};

const retryMessage = (
  message: Message<TelegramOutboxJob>,
  delaySeconds?: number
): void => {
  if (typeof delaySeconds === "number" && delaySeconds > 0) {
    message.retry({ delaySeconds });
    return;
  }
  message.retry();
};

const handleChatMessages = async (
  messages: Message<TelegramOutboxJob>[],
  env: Environment
): Promise<void> => {
  let retryRestDelay: number | undefined;

  for (const message of messages) {
    if (retryRestDelay !== undefined) {
      retryMessage(message, retryRestDelay);
      continue;
    }

    try {
      const result = await sendViaOutboxDo(env, message.body);
      if (result.ok) {
        message.ack();
      } else if (result.retryable === false) {
        message.ack();
      } else {
        retryRestDelay = result.delaySeconds ?? 5;
        retryMessage(message, retryRestDelay);
      }
    } catch {
      retryRestDelay = 5;
      retryMessage(message, retryRestDelay);
    }
  }
};

export const handleOutboxBatch = async (
  batch: MessageBatch<TelegramOutboxJob>,
  env: Environment
): Promise<void> => {
  const byChat = new Map<string, Message<TelegramOutboxJob>[]>();
  for (const message of batch.messages) {
    const messages = byChat.get(message.body.chatHash) ?? [];
    messages.push(message);
    byChat.set(message.body.chatHash, messages);
  }

  await mapBounded([...byChat.values()], OUTBOX_CHAT_CONCURRENCY, (messages) =>
    handleChatMessages(messages, env)
  );
};
