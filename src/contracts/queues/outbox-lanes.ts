import type { InboxDrainJob, InboxNotificationJob } from "../inbox/events";
import type { TelegramOutboxJob } from "../telegram/outbox";

export type OutboxLaneWork =
  | Readonly<{
      type: "telegram";
      messages: Message<TelegramOutboxJob>[];
    }>
  | Readonly<{
      type: "drain";
      message: Message<InboxDrainJob>;
    }>
  | Readonly<{
      type: "notification";
      message: Message<InboxNotificationJob>;
    }>;

export type OrderedOutboxLaneWork = Readonly<{
  order: number;
  work: OutboxLaneWork;
}>;
