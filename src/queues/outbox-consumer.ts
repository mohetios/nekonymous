import type { Environment } from "../contracts/runtime";
import type {
  InboxDrainJob,
  InboxNotificationJob,
} from "../contracts/inbox/events";
import {
  isInboxDrainJob,
  isInboxNotificationJob,
} from "../contracts/inbox/events";
import type { OutboxQueueJob } from "../contracts/queues/events";
import type {
  OrderedOutboxLaneWork,
  OutboxLaneWork,
} from "../contracts/queues/outbox-lanes";
import type { TelegramOutboxJob } from "../contracts/telegram/outbox";
import { sendViaOutboxDo } from "../storage/telegram-outbox-client";
import { drainUnreadInbox } from "../features/ticketing/inbox";
import { INBOX_MENU_CALLBACK } from "../bot/callback-data";
import { DELIVER_INBOX_BUTTON } from "../i18n/labels";
import { inboxFreshNoticeMessage } from "../i18n/messages";
import { getUserById } from "../features/identity/identity-service";
import { getUnreadSummary } from "../storage/user-state-client";
import { logBotError } from "../utils/logs";

const OUTBOX_CHAT_CONCURRENCY = 4;

const noticeReplyMarkup = {
  inline_keyboard: [
    [
      {
        text: DELIVER_INBOX_BUTTON,
        callback_data: INBOX_MENU_CALLBACK.deliver,
      },
    ],
  ],
};

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
      switch (result.status) {
        case "sent":
          message.ack();
          break;
        case "retry":
          retryRestDelay = result.delaySeconds;
          logBotError("queue:telegram", new Error("Telegram outbox retry"), {
            retryable: true,
            delaySeconds: retryRestDelay,
          });
          retryMessage(message, retryRestDelay);
          break;
        case "rejected":
          logBotError("queue:telegram", new Error("Telegram outbox rejected"), {
            permanent: true,
          });
          message.ack();
          break;
      }
    } catch (error) {
      retryRestDelay = 5;
      logBotError("queue:telegram", error, {
        retryable: true,
        delaySeconds: retryRestDelay,
      });
      retryMessage(message, retryRestDelay);
    }
  }
};

const notificationJobForUser = (
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>,
  eventId: string,
  unreadCount: number
): TelegramOutboxJob => ({
  idempotencyKey: `inbox-notification:${user.id}:${eventId}`,
  kind: "telegram",
  chatCiphertext: user.telegram_chat_ciphertext,
  chatHash: user.telegram_user_hash,
  method: "sendMessage",
  payload: {
    text: inboxFreshNoticeMessage(unreadCount),
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
    logBotError(
      "queue:inbox-notification",
      new Error("Invalid inbox notification job"),
      { permanent: true }
    );
    message.ack();
    return;
  }

  const { accountId, eventId } = message.body;
  const summary = await getUnreadSummary(env, accountId);
  if (summary.unreadCount <= 0) {
    message.ack();
    return;
  }

  const user = await getUserById(accountId, env);
  if (!user) {
    message.ack();
    return;
  }

  const result = await sendViaOutboxDo(
    env,
    notificationJobForUser(user, eventId, summary.unreadCount)
  );
  if (result.status === "sent") {
    message.ack();
    return;
  }

  if (result.status === "rejected") {
    logBotError(
      "queue:inbox-notification",
      new Error("Inbox notification permanently rejected"),
      { permanent: true }
    );
    message.ack();
    return;
  }

  logBotError("queue:inbox-notification", new Error("Inbox notification retry"), {
    retryable: true,
    delaySeconds: result.delaySeconds,
  });
  message.retry({ delaySeconds: result.delaySeconds });
};

const handleInboxDrainMessage = async (
  message: Message<InboxDrainJob>,
  env: Environment
): Promise<void> => {
  if (!isInboxDrainJob(message.body)) {
    logBotError("queue:inbox-drain", new Error("Invalid inbox drain job"), {
      permanent: true,
    });
    message.ack();
    return;
  }

  try {
    const result = await drainUnreadInbox(env, message.body.userId);
    if (result.status === "retry") {
      logBotError("queue:inbox-drain", new Error("Inbox drain retry"), {
        retryable: true,
        delaySeconds: result.delaySeconds,
      });
      message.retry({ delaySeconds: result.delaySeconds });
      return;
    }
    message.ack();
  } catch (error) {
    logBotError("queue:inbox-drain", error, {
      retryable: true,
      delaySeconds: 5,
    });
    message.retry({ delaySeconds: 5 });
  }
};

const resolveAccountChatHash = async (
  env: Environment,
  accountId: string,
  cache: Map<string, string>
): Promise<string> => {
  const cached = cache.get(accountId);
  if (cached) {
    return cached;
  }
  const user = await getUserById(accountId, env);
  const chatHash = user?.telegram_user_hash ?? `missing:${accountId}`;
  cache.set(accountId, chatHash);
  return chatHash;
};

const processChatLane = async (
  orderedWork: OrderedOutboxLaneWork[],
  env: Environment
): Promise<void> => {
  const sorted = [...orderedWork].sort((left, right) => left.order - right.order);
  const telegramMessages: Message<TelegramOutboxJob>[] = [];

  for (const entry of sorted) {
    if (entry.work.type === "telegram") {
      telegramMessages.push(...entry.work.messages);
      continue;
    }
    if (telegramMessages.length > 0) {
      await handleChatMessages(telegramMessages, env);
      telegramMessages.length = 0;
    }
    if (entry.work.type === "drain") {
      await handleInboxDrainMessage(entry.work.message, env);
      continue;
    }
    await handleInboxNotificationMessage(entry.work.message, env);
  }

  if (telegramMessages.length > 0) {
    await handleChatMessages(telegramMessages, env);
  }
};

export const handleOutboxBatch = async (
  batch: MessageBatch<OutboxQueueJob>,
  env: Environment
): Promise<void> => {
  const lanes = new Map<string, OrderedOutboxLaneWork[]>();
  const accountChatHash = new Map<string, string>();
  let order = 0;

  const appendLaneWork = (chatHash: string, work: OutboxLaneWork): void => {
    const items = lanes.get(chatHash) ?? [];
    items.push({ order: order++, work });
    lanes.set(chatHash, items);
  };

  const appendTelegramMessage = (
    chatHash: string,
    message: Message<TelegramOutboxJob>
  ): void => {
    const items = lanes.get(chatHash) ?? [];
    const last = items[items.length - 1];
    if (last?.work.type === "telegram") {
      last.work.messages.push(message);
      return;
    }
    items.push({
      order: order++,
      work: { type: "telegram", messages: [message] },
    });
    lanes.set(chatHash, items);
  };

  for (const message of batch.messages) {
    if (message.body.kind === "inbox-drain") {
      const drainMessage = message as Message<InboxDrainJob>;
      const chatHash = await resolveAccountChatHash(
        env,
        drainMessage.body.userId,
        accountChatHash
      );
      appendLaneWork(chatHash, { type: "drain", message: drainMessage });
      continue;
    }
    if (message.body.kind === "inbox-notification") {
      const notificationMessage = message as Message<InboxNotificationJob>;
      const chatHash = await resolveAccountChatHash(
        env,
        notificationMessage.body.accountId,
        accountChatHash
      );
      appendLaneWork(chatHash, {
        type: "notification",
        message: notificationMessage,
      });
      continue;
    }
    const telegramMessage = message as Message<TelegramOutboxJob>;
    appendTelegramMessage(telegramMessage.body.chatHash, telegramMessage);
  }

  await mapBounded([...lanes.values()], OUTBOX_CHAT_CONCURRENCY, (orderedWork) =>
    processChatLane(orderedWork, env)
  );
};
