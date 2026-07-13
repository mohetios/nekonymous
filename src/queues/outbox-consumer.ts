import type { Environment } from "../contracts/runtime";
import type { InboxDrainJob } from "../contracts/inbox/events";
import type { OutboxQueueJob } from "../contracts/queues/events";
import type { TelegramOutboxJob } from "../contracts/telegram/outbox";
import { sendViaOutboxDo } from "../storage/telegram-outbox-client";
import { drainUnreadInbox } from "../features/ticketing/inbox";

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
  batch: MessageBatch<OutboxQueueJob>,
  env: Environment
): Promise<void> => {
  const byChat = new Map<string, Message<TelegramOutboxJob>[]>();
  const drainMessages: Message<InboxDrainJob>[] = [];
  for (const message of batch.messages) {
    if (message.body.kind === "inbox-drain") {
      drainMessages.push(message as Message<InboxDrainJob>);
      continue;
    }
    const telegramMessage = message as Message<TelegramOutboxJob>;
    const messages = byChat.get(telegramMessage.body.chatHash) ?? [];
    messages.push(telegramMessage);
    byChat.set(telegramMessage.body.chatHash, messages);
  }

  await Promise.all([
    mapBounded([...byChat.values()], OUTBOX_CHAT_CONCURRENCY, (messages) =>
      handleChatMessages(messages, env)
    ),
    mapBounded(drainMessages, OUTBOX_CHAT_CONCURRENCY, async (message) => {
      try {
        await drainUnreadInbox(env, message.body.userId);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 5 });
      }
    }),
  ]);
};
