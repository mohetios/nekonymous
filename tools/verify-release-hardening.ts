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
assertIncludes(userState, "deleteAlarm()", "purge must clear durable object alarms before deleteAll");
assertIncludes(userState, "SELECT ticket_hash FROM inbox_pointers", "purge must return inbox ticket hashes");

const identity = read("src/features/identity/identity-service.ts");
assertIncludes(identity, "invalidateUserConversationProfile", "reset must invalidate profile vault state");
assertIncludes(identity, "expireTicketRecord", "reset must clear ticket vault records");
assertIncludes(identity, "DurableObjectCallError", "user state init must fail closed on storage errors");
assertIncludes(identity, "error.status === 404", "user state init must only run on explicit 404");

const requestService = read("src/features/conversation/suggestions/request-service.ts");
assertIncludes(requestService, "claimRequestAccept", "accepted request tickets need an accepting claim before ticket creation");
assertIncludes(requestService, "completeRequestAccept", "accepted requests must finalize with the created ticket hash");
assertIncludes(requestService, "requestAcceptOperationId", "accepted request tickets need stable operation keys");
assertIncludes(requestService, "candidateProfile?.status === \"discoverable\"", "request creation must reject non-discoverable candidates");

const requestNotify = read("src/features/conversation/suggestions/request-notify.ts");
if (/idempotencyKey:\s*`request-notify:\$\{requestRef\}`/.test(requestNotify)) {
  fail("request notification idempotency must not store raw request refs");
}

const outbox = read("src/storage/telegram-outbox-do.ts");
assertIncludes(outbox, "async sendJob(job: TelegramOutboxJob)", "outbox must expose typed RPC sendJob");
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
assertIncludes(index, "case \"neko-outbox\"", "queue dispatch must handle outbox explicitly");
assertIncludes(index, "Unknown queue:", "unknown queues must fail loudly");

const outboxClient = read("src/storage/telegram-outbox-client.ts");
assertIncludes(outboxClient, "stub.sendJob(job)", "outbox client must use typed DO RPC");

const ticketVaultClient = read("src/storage/ticket-vault/ticket-vault.client.ts");
assertIncludes(ticketVaultClient, ".storeTicket(input)", "ticket vault client must use typed DO RPC");
assertIncludes(ticketVaultClient, ".getTicket(ticketHash)", "ticket vault client must use typed DO RPC");

const userStateClient = read("src/storage/user-state-client.ts");
assertIncludes(userStateClient, ".getState()", "user state client must use typed DO RPC");
assertIncludes(userStateClient, "DurableObjectCallError(404", "user state client must preserve fail-closed 404 semantics");

const profileVaultClient = read("src/storage/profile-vault/profile-vault.client.ts");
assertIncludes(profileVaultClient, ".storeProfile(input)", "profile vault client must use typed DO RPC");

const logs = read("src/utils/logs.ts");
if (logs.includes("console.error(`[${context}]`, error)")) {
  fail("logger must not pass arbitrary error objects directly to console.error");
}

const workflow = read(".github/workflows/check.yml");
assertIncludes(workflow, "pull_request:", "check workflow must run on pull requests");
assertIncludes(workflow, "branches: [master]", "check workflow must run on master pushes");

const wrangler = read("wrangler.jsonc");
assertIncludes(wrangler, "\"observability\"", "production wrangler config must enable observability");
assertIncludes(wrangler, "head_sampling_rate\": 0.1", "production traces must use reduced sampling");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-outbox-dlq\"", "outbox must use a dedicated DLQ");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-stats-dlq\"", "stats must use a dedicated DLQ");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-profile-index-dlq\"", "profile index must use a dedicated DLQ");
if (wrangler.includes("NEKO_DLQ") || wrangler.includes("neko-dlq")) {
  fail("wrangler.jsonc must not bind the legacy shared neko-dlq queue");
}

console.log("verify-release-hardening: OK");
