import type { InternalAccountId, QueueRequestId, UnixMillis } from "../primitives";

export type InboxDrainJob = Readonly<{
  kind: "inbox-drain";
  idempotencyKey: string;
  userId: InternalAccountId;
  requestId: QueueRequestId;
  createdAt: UnixMillis;
}>;
