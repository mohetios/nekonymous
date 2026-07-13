import type {
  DeliveryAttemptId,
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

export type UnreadDeliveryClaim = Readonly<{
  itemId: UnreadItemId;
  sealedCapabilityEnc: SealedUnreadCapability;
  dedupeTag: InboxDedupeTag;
  deliveryAttemptId: DeliveryAttemptId;
  expiresAt: UnixMillis;
}>;
