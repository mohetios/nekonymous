import type {
  DeliveryAttemptId,
  InboxDedupeTag,
  UnixMillis,
  UnreadItemId,
} from "../primitives";
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
}>;

export type CompleteUnreadDeliveryInput = Readonly<{
  itemId: UnreadItemId;
  deliveryAttemptId: DeliveryAttemptId;
}>;

export type ReleaseUnreadDeliveryInput = CompleteUnreadDeliveryInput;
