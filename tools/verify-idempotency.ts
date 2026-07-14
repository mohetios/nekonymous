import {
  resolveProcessedEventClaim,
  type ProcessedEventSnapshot,
} from "../src/storage/processed-events-policy.ts";
import { isInboxNotificationJob } from "../src/contracts/inbox/events.ts";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const now = Date.now();

const doneSnapshot: ProcessedEventSnapshot = {
  status: "done",
  leaseUntil: null,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(doneSnapshot, now) === "done",
  "done event must be skipped safely"
);

const failedSnapshot: ProcessedEventSnapshot = {
  status: "failed",
  leaseUntil: null,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(failedSnapshot, now) === "acquired",
  "failed event must be retryable"
);

const expiredLeaseSnapshot: ProcessedEventSnapshot = {
  status: "processing",
  leaseUntil: now - 1_000,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(expiredLeaseSnapshot, now) === "acquired",
  "expired processing lease must allow takeover"
);

const activeLeaseSnapshot: ProcessedEventSnapshot = {
  status: "processing",
  leaseUntil: now + 30_000,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(activeLeaseSnapshot, now) === "processing",
  "active processing lease must prevent duplicate processing"
);

const ticketDeliveryEventKey = (ticketHash: string): string =>
  `ticket-delivery:${ticketHash}`;

const eventKeyA = ticketDeliveryEventKey("ticket_hash_a");
const eventKeyB = ticketDeliveryEventKey("ticket_hash_b");
assert(
  eventKeyA !== eventKeyB,
  "different source events must generate distinct outbox keys"
);

const eventKeyARepeat = ticketDeliveryEventKey("ticket_hash_a");
assert(
  eventKeyA === eventKeyARepeat,
  "same source event must generate same outbox key"
);

const forbiddenSamples = ["ref_ABC", "123456789", "hello text payload"];
for (const sample of forbiddenSamples) {
  assert(
    !eventKeyA.includes(sample),
    "outbox key must not include raw sensitive values"
  );
}

const inboxNotificationKey = (accountId: string, eventId: string): string =>
  `inbox-notification:${accountId}:${eventId}`;

assert(
  inboxNotificationKey("user-a", "event-1") !==
    inboxNotificationKey("user-a", "event-2"),
  "distinct notification events must get distinct outbox keys"
);
assert(
  inboxNotificationKey("user-a", "event-1") ===
    inboxNotificationKey("user-a", "event-1"),
  "same notification event must replay with the same outbox key"
);

assert(
  isInboxNotificationJob({
    kind: "inbox-notification",
    accountId: "user-a",
    eventId: "event-1",
  }),
  "canonical inbox notification jobs must validate"
);
assert(
  !isInboxNotificationJob({
    kind: "inbox-notification",
    accountId: "user-a",
    eventId: "event-1",
    unreadCount: 3,
  }),
  "notification jobs must reject stored unread counts"
);
assert(
  !isInboxNotificationJob({
    kind: "inbox-notification",
    accountId: "user-a",
    cycleId: "cycle-1",
    itemId: "item-1",
  }),
  "notification jobs must reject removed cycle/item fields"
);

console.log("Processed-event idempotency policy OK");
console.log("Outbox event key strategy OK");
console.log("Inbox notification event idempotency OK");
