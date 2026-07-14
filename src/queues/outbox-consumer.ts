import type { Environment } from "../contracts/runtime";
import type {
  InboxDrainJob,
  InboxNotificationJob,
} from "../contracts/inbox/events";
import type { OutboxQueueJob } from "../contracts/queues/events";
import type { TelegramOutboxJob } from "../contracts/telegram/outbox";
import { sendViaOutboxDo } from "../storage/telegram-outbox-client";
import { drainUnreadInbox } from "../features/ticketing/inbox";
import { INBOX_MENU_CALLBACK } from "../bot/callback-data";
import { INBOX_FRESH_NOTICE_MESSAGE } from "../i18n/messages";
import { getUserById } from "../features/identity/identity-service";
import {
  closeInboxNotificationCycle,
  getInboxNotificationCycle,
  getUnreadSummary,
  markInboxNotificationSent,
} from "../storage/user-state-client";

const OUTBOX_CHAT_CONCURRENCY = 4;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isInboxNotificationJob = (
  value: unknown
): value is InboxNotificationJob =>
  isRecord(value) &&
  Object.keys(value).length === 3 &&
  value.kind === "inbox-notification" &&
  typeof value.accountId === "string" &&
  value.accountId.length > 0 &&
  typeof value.cycleId === "string" &&
  value.cycleId.length > 0;

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

const notificationJobForUser = (
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>,
  cycleId: string
): TelegramOutboxJob => ({
  idempotencyKey: `inbox-notification:${user.id}:${cycleId}`,
  kind: "telegram",
  chatCiphertext: user.telegram_chat_ciphertext,
  chatHash: user.telegram_user_hash,
  method: "sendMessage",
  payload: {
    text: INBOX_FRESH_NOTICE_MESSAGE,
    parse_mode: "HTML",
    reply_markup: noticeReplyMarkup,
  },
  priority: "low",
  createdAt: Date.now(),
});

const handleInboxNotificationMessage = async (
  message: Message<InboxNotificationJob>,
  env: Environment
): Promise<void> => {
  if (!isInboxNotificationJob(message.body)) {
    message.ack();
    return;
  }

  const { accountId, cycleId } = message.body;
  const cycle = await getInboxNotificationCycle(env, accountId);
  if (!cycle || cycle.cycleId !== cycleId) {
    message.ack();
    return;
  }
  if (cycle.status === "sent") {
    message.ack();
    return;
  }

  const summary = await getUnreadSummary(env, accountId);
  if (summary.unreadCount <= 0) {
    await closeInboxNotificationCycle(env, accountId, { cycleId });
    message.ack();
    return;
  }

  const user = await getUserById(accountId, env);
  if (!user) {
    await closeInboxNotificationCycle(env, accountId, { cycleId });
    message.ack();
    return;
  }

  const result = await sendViaOutboxDo(
    env,
    notificationJobForUser(user, cycleId)
  );
  if (result.ok && !result.permanentFailure) {
    await markInboxNotificationSent(env, accountId, {
      cycleId,
      sentAt: Date.now(),
    });
    message.ack();
    return;
  }

  if (result.retryable === false || result.permanentFailure) {
    message.ack();
    return;
  }

  message.retry({ delaySeconds: result.delaySeconds ?? 5 });
};

export const handleOutboxBatch = async (
  batch: MessageBatch<OutboxQueueJob>,
  env: Environment
): Promise<void> => {
  const byChat = new Map<string, Message<TelegramOutboxJob>[]>();
  const drainMessages: Message<InboxDrainJob>[] = [];
  const notificationMessages: Message<InboxNotificationJob>[] = [];
  for (const message of batch.messages) {
    if (message.body.kind === "inbox-drain") {
      drainMessages.push(message as Message<InboxDrainJob>);
      continue;
    }
    if (message.body.kind === "inbox-notification") {
      notificationMessages.push(message as Message<InboxNotificationJob>);
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
    mapBounded(notificationMessages, OUTBOX_CHAT_CONCURRENCY, async (message) => {
      try {
        await handleInboxNotificationMessage(message, env);
      } catch {
        message.retry({ delaySeconds: 5 });
      }
    }),
  ]);
};
