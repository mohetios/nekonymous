import {
  resolveProcessedEventClaim,
  type ProcessedEventSnapshot,
} from "../src/storage/processed-events-policy.ts";
import { messageCreatedOutboxEventKey } from "../src/features/ticketing/outbox-event-key.ts";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const now = Date.now();

// 1) duplicate webhook update_id does not duplicate side effects (done is skipped)
const doneSnapshot: ProcessedEventSnapshot = {
  status: "done",
  leaseUntil: null,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(doneSnapshot, now) === "done",
  "done event must be skipped safely"
);

// 2) failed processing can be retried
const failedSnapshot: ProcessedEventSnapshot = {
  status: "failed",
  leaseUntil: null,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(failedSnapshot, now) === "acquired",
  "failed event must be retryable"
);

// 3) processing lease can be recovered after expiry
const expiredLeaseSnapshot: ProcessedEventSnapshot = {
  status: "processing",
  leaseUntil: now - 1_000,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(expiredLeaseSnapshot, now) === "acquired",
  "expired processing lease must allow takeover"
);

// 4) active processing lease prevents duplicate processing until retry
const activeLeaseSnapshot: ProcessedEventSnapshot = {
  status: "processing",
  leaseUntil: now + 30_000,
  expiresAt: now + 60_000,
};
assert(
  resolveProcessedEventClaim(activeLeaseSnapshot, now) === "processing",
  "active processing lease must prevent duplicate processing"
);

// 5) two different outbox events to same recipient can both send
const eventKeyA = messageCreatedOutboxEventKey("ticket_hash_a");
const eventKeyB = messageCreatedOutboxEventKey("ticket_hash_b");
assert(
  eventKeyA !== eventKeyB,
  "different source events must generate distinct outbox keys"
);

// 6) same outbox event key sends only once (same stable key)
const eventKeyARepeat = messageCreatedOutboxEventKey("ticket_hash_a");
assert(
  eventKeyA === eventKeyARepeat,
  "same source event must generate same outbox key"
);

// 7) outbox key does not include raw ticketRef/chatId/message text
const forbiddenSamples = ["ref_ABC", "123456789", "hello text payload"];
for (const sample of forbiddenSamples) {
  assert(
    !eventKeyA.includes(sample),
    "outbox key must not include raw sensitive values"
  );
}

console.log("Processed-event idempotency policy OK");
console.log("Outbox event key strategy OK");
