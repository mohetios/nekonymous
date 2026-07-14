import type {
  InboxNotificationCycleId,
  InternalAccountId,
  QueueRequestId,
  UnixMillis,
} from "../primitives";

export type InboxDrainJob = Readonly<{
  kind: "inbox-drain";
  idempotencyKey: string;
  userId: InternalAccountId;
  requestId: QueueRequestId;
  createdAt: UnixMillis;
}>;

export type InboxNotificationJob = Readonly<{
  kind: "inbox-notification";
  accountId: InternalAccountId;
  cycleId: InboxNotificationCycleId;
}>;
