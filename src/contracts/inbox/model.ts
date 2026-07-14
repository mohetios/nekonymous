import type {
  DeliveryAttemptId,
  InboxNotificationCycleId,
  InboxDedupeTag,
  UnixMillis,
  UnreadItemId,
} from "../primitives";
import type { SealedUnreadCapability } from "../crypto";

export type UnreadDeliveryState = "active" | "delivering";

export type UnreadInboxItemRow = Readonly<{
  itemId: UnreadItemId;
  sealedCapabilityEnc: SealedUnreadCapability;
  dedupeTag: InboxDedupeTag;
  deliveryState: UnreadDeliveryState;
  deliveryAttemptId: DeliveryAttemptId | null;
  deliveryLeaseUntil: UnixMillis | null;
  createdAt: UnixMillis;
  expiresAt: UnixMillis;
}>;

export type UnreadSummary = Readonly<{
  unreadCount: number;
}>;

export type InboxNotificationCycleStatus = "pending" | "sent";

export type InboxNotificationCycle = Readonly<{
  cycleId: InboxNotificationCycleId;
  status: InboxNotificationCycleStatus;
  createdAt: UnixMillis;
  sentAt: UnixMillis | null;
}>;

export type InboxNotificationDecision =
  | Readonly<{
      required: true;
      cycleId: InboxNotificationCycleId;
    }>
  | Readonly<{
      required: false;
    }>;

export type UnreadDeliveryClaim = Readonly<{
  itemId: UnreadItemId;
  sealedCapabilityEnc: SealedUnreadCapability;
  dedupeTag: InboxDedupeTag;
  deliveryAttemptId: DeliveryAttemptId;
  expiresAt: UnixMillis;
}>;
