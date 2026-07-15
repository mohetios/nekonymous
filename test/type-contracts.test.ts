import { describe, expect, it } from "vitest";
import type { UnreadInboxItemRow } from "../src/contracts/inbox/model";
import type {
  InboxDrainJob,
  InboxNotificationJob,
} from "../src/contracts/inbox/events";
import type {
  AbuseSubjectTag,
  BlockTag,
  ContactTag,
  EncodedTicketCapability,
  InboxNotificationEventId,
  InternalAccountId,
  TicketHash,
  UnixMillis,
} from "../src/contracts/primitives";

declare const contactTag: ContactTag;
declare const blockTag: BlockTag;
declare const abuseSubjectTag: AbuseSubjectTag;
declare const encodedCapability: EncodedTicketCapability;
declare const ticketHash: TicketHash;
declare const accountId: InternalAccountId;
declare const eventId: InboxNotificationEventId;
declare const now: UnixMillis;

const acceptBlockTag = (_value: BlockTag): void => undefined;
const acceptAbuseSubjectTag = (_value: AbuseSubjectTag): void => undefined;
const acceptEncodedCapability = (_value: EncodedTicketCapability): void =>
  undefined;
const acceptUnixMillis = (_value: UnixMillis): void => undefined;

describe("canonical type contracts", () => {
  it("keeps runtime test harness active", () => {
    expect(true).toBe(true);
  });
});

const _runCompileTimeChecks = (): void => {
  acceptBlockTag(blockTag);
  acceptAbuseSubjectTag(abuseSubjectTag);
  acceptEncodedCapability(encodedCapability);
  acceptUnixMillis(now);

  // @ts-expect-error ContactTag must not be accepted where BlockTag is required.
  acceptBlockTag(contactTag);

  // @ts-expect-error BlockTag must not be accepted where AbuseSubjectTag is required.
  acceptAbuseSubjectTag(blockTag);

  const unreadItem = {
    itemId: "item-id",
    sealedCapabilityEnc: "sealed",
    dedupeTag: "dedupe",
    deliveryState: "active",
    deliveryAttemptId: null,
    deliveryLeaseUntil: null,
    createdAt: now,
    expiresAt: now,
  } satisfies UnreadInboxItemRow;

  // @ts-expect-error UnreadInboxItemRow must not contain a ticketHash field.
  unreadItem.ticketHash = ticketHash;

  const drainJob = {
    kind: "inbox-drain",
    idempotencyKey: "drain:key",
    userId: "account-id",
    requestId: "request-id",
    createdAt: now,
  } satisfies InboxDrainJob;

  // @ts-expect-error InboxDrainJob must not carry a ticket capability.
  drainJob.capability = encodedCapability;

  const notificationJob = {
    kind: "inbox-notification",
    accountId,
    eventId,
  } satisfies InboxNotificationJob;

  // @ts-expect-error InboxNotificationJob must not carry a ticket capability.
  notificationJob.capability = encodedCapability;

  // @ts-expect-error InboxNotificationJob must not carry a ticket hash.
  notificationJob.ticketHash = ticketHash;

  // @ts-expect-error InboxNotificationJob must not carry a stored unread count.
  notificationJob.unreadCount = 3;
};
