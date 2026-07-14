import type {
  DeliveryAttemptId,
  InboxDedupeTag,
  InboxNotificationEventId,
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

export type InboxNotificationDecision =
  | Readonly<{
      required: true;
      eventId: InboxNotificationEventId;
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

export type InboxDrainResult = Readonly<
  | {
      status: "completed";
      deliveredCount: number;
    }
  | {
      status: "retry";
      deliveredCount: number;
      delaySeconds: number;
    }
>;

export type InboxDeliveryPrefs = Readonly<{
  blockTags: ReadonlySet<string>;
  labelCache: Map<string, string | undefined>;
}>;

export type InboxDeliverClaimResult = Readonly<
  | { outcome: "delivered" }
  | { outcome: "unavailable" }
  | { outcome: "retryable-failure"; delaySeconds: number }
>;
