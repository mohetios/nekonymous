/**
 * Static release-hardening invariants.
 * Run: pnpm test:release-hardening
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const read = (path: string): string => readFileSync(`${root}/${path}`, "utf8");

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const assertIncludes = (content: string, needle: string, message: string): void => {
  if (!content.includes(needle)) {
    fail(message);
  }
};

const ticketVault = read("src/storage/ticket-vault/ticket-vault.do.ts");
assertIncludes(ticketVault, "route_enc = NULL", "expired tickets must clear route_enc");
assertIncludes(ticketVault, "meta_enc = NULL", "expired tickets must clear meta_enc");
assertIncludes(ticketVault, "async alarm()", "TicketVault must sweep expiry by alarm");
assertIncludes(ticketVault, "EXPIRY_SWEEP_LIMIT", "TicketVault expiry sweep must be bounded");
assertIncludes(ticketVault, "next.expires_at <= now", "TicketVault must reschedule overdue expiry sweeps");

const userState = read("src/storage/user-state-do.ts");
assertIncludes(userState, "evictedTicketHashes", "pointer eviction must report ticket hashes");
assertIncludes(userState, "SELECT ticket_hash FROM inbox_pointers", "purge must return inbox ticket hashes");

const identity = read("src/features/identity/identity-service.ts");
assertIncludes(identity, "invalidateUserConversationProfile", "reset must invalidate profile vault state");
assertIncludes(identity, "expireTicketRecord", "reset must clear ticket vault records");

const requestService = read("src/features/conversation/suggestions/request-service.ts");
assertIncludes(requestService, "conversation-request:${resolved.requestHash}", "accepted request tickets need stable dedupe keys");
assertIncludes(requestService, "candidateProfile?.status === \"discoverable\"", "request creation must reject non-discoverable candidates");

const requestNotify = read("src/features/conversation/suggestions/request-notify.ts");
if (/idempotencyKey:\s*`request-notify:\$\{requestRef\}`/.test(requestNotify)) {
  fail("request notification idempotency must not store raw request refs");
}

const outbox = read("src/storage/telegram-outbox-do.ts");
assertIncludes(outbox, "lease_attempt_id", "outbox sends must use attempt leases");
assertIncludes(outbox, "send_locks", "outbox must serialize sends per chat DO");
assertIncludes(outbox, "permanent_error", "outbox must retain permanent failure state");
assertIncludes(outbox, "async alarm()", "outbox must clean retained rows by alarm");
assertIncludes(outbox, "retryLeaseUntil", "outbox must hold chat locks through retry-after delays");
assertIncludes(outbox, "next.due_at <= now", "outbox must reschedule overdue cleanup sweeps");

const outboxConsumer = read("src/queues/outbox-consumer.ts");
assertIncludes(outboxConsumer, "OUTBOX_CHAT_CONCURRENCY", "outbox consumer must bound cross-chat concurrency");
assertIncludes(outboxConsumer, "handleChatMessages", "outbox consumer must process each chat sequentially");

const index = read("src/index.ts");
assertIncludes(index, "queueName === \"neko-outbox\"", "unknown queues must not fall through to outbox");
assertIncludes(index, "message.ack()", "unknown queue messages must be acknowledged");

const logs = read("src/utils/logs.ts");
if (logs.includes("console.error(`[${context}]`, error)")) {
  fail("logger must not pass arbitrary error objects directly to console.error");
}

const workflow = read(".github/workflows/check.yml");
assertIncludes(workflow, "pull_request:", "check workflow must run on pull requests");
assertIncludes(workflow, "branches: [master]", "check workflow must run on master pushes");

console.log("verify-release-hardening: OK");
