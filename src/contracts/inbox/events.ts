import type {
  InboxNotificationEventId,
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

/** Soft alert only — no ticket hash, capability, route, or stored count. */
export type InboxNotificationJob = Readonly<{
  kind: "inbox-notification";
  accountId: InternalAccountId;
  eventId: InboxNotificationEventId;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isInboxDrainJob = (value: unknown): value is InboxDrainJob =>
  isRecord(value) &&
  value.kind === "inbox-drain" &&
  typeof value.idempotencyKey === "string" &&
  value.idempotencyKey.length > 0 &&
  typeof value.userId === "string" &&
  value.userId.length > 0 &&
  typeof value.requestId === "string" &&
  value.requestId.length > 0 &&
  Number.isSafeInteger(value.createdAt);

export const isInboxNotificationJob = (
  value: unknown
): value is InboxNotificationJob =>
  isRecord(value) &&
  value.kind === "inbox-notification" &&
  typeof value.accountId === "string" &&
  value.accountId.length > 0 &&
  typeof value.eventId === "string" &&
  value.eventId.length > 0 &&
  Object.keys(value).length === 3;
