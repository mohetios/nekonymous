import type {
  DeliveryAttemptId,
  InboxNotificationCycleId,
  InboxDedupeTag,
  UnixMillis,
  UnreadItemId,
} from "../primitives";
import type { InboxNotificationDecision } from "./model";
import type { SealedUnreadCapability } from "../crypto";

export type AddUnreadItemInput = Readonly<{
  itemId: UnreadItemId;
  sealedCapabilityEnc: SealedUnreadCapability;
  dedupeTag: InboxDedupeTag;
  createdAt: UnixMillis;
  expiresAt: UnixMillis;
}>;

export type AddUnreadItemResult = Readonly<{
  ok: boolean;
  status: number;
  unreadCount?: number;
  duplicate?: boolean;
  notification: InboxNotificationDecision;
}>;

export type CompleteUnreadDeliveryInput = Readonly<{
  itemId: UnreadItemId;
  deliveryAttemptId: DeliveryAttemptId;
}>;

export type ReleaseUnreadDeliveryInput = CompleteUnreadDeliveryInput;

export type MarkInboxNotificationSentInput = Readonly<{
  cycleId: InboxNotificationCycleId;
  sentAt: UnixMillis;
}>;

export type CloseInboxNotificationCycleInput = Readonly<{
  cycleId?: InboxNotificationCycleId;
}>;
