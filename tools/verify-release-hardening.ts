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

const assertNotIncludes = (
  content: string,
  needle: string,
  message: string
): void => {
  if (content.includes(needle)) {
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
assertIncludes(userState, "unread_inbox_items", "inbox admission must use unread delivery queue rows");
assertIncludes(userState, "sealed_capability_enc BLOB NOT NULL", "unread capability must be stored as ciphertext");
assertIncludes(userState, "claimNextUnreadItem", "UserState must expose atomic one-item claim");
assertNotIncludes(userState, "claimUnreadBatch", "removed unread batch claim must stay absent");
assertIncludes(userState, "delivery_attempt_id", "unread claims must be attempt guarded");
assertIncludes(userState, "DELETE FROM unread_inbox_items", "purge must clear unread rows");
assertIncludes(userState, "block_tag TEXT PRIMARY KEY", "blocks must use recipient-local block tags");
assertIncludes(userState, "contact_tag TEXT PRIMARY KEY", "nicknames must use recipient-local contact tags");
assertIncludes(userState, "deleteAlarm()", "purge must clear durable object alarms before deleteAll");
assertNotIncludes(userState, "unread_notice_state", "editable unread notices must stay removed");
assertNotIncludes(userState, "blocked_user_id", "old block relation column must stay absent");
assertNotIncludes(userState, "target_user_id", "old nickname relation column must stay absent");
assertNotIncludes(userState, `addInbox${"Pointer"}`, "removed inbox pointer RPC must stay absent");
assertNotIncludes(userState, `inbox${"Page"}`, "removed inbox page RPC must stay absent");
assertNotIncludes(userState, `markInbox${"Status"}`, "removed inbox status RPC must stay absent");

const createSealedTicket = read("src/features/ticketing/create-sealed-ticket.ts");
assertIncludes(createSealedTicket, "createTicketCapability", "new tickets must create canonical capabilities");
assertIncludes(createSealedTicket, "deriveTicketKeys", "new tickets must use canonical key derivation");
assertIncludes(createSealedTicket, "createContactTag", "new tickets must derive contact tags");
assertIncludes(createSealedTicket, "createBlockTag", "new tickets must derive block tags");
assertIncludes(createSealedTicket, "createAbuseSubjectTag", "new tickets must derive abuse-subject tags");
assertIncludes(createSealedTicket, "getSafetyDecision", "new tickets must check safety state");
assertIncludes(createSealedTicket, "sealUnreadCapability", "new tickets must seal capability into unread row");
assertIncludes(createSealedTicket, "addUnreadItem", "new tickets must create unread delivery queue item");
assertIncludes(createSealedTicket, "createUnreadInboxDedupeTag", "new unread items must use blind dedupe");
assertNotIncludes(createSealedTicket, "senderRouteTag", "RouteCapsule must not store old sender route tag");
assertNotIncludes(createSealedTicket, "recipientRouteTag", "RouteCapsule must not store old recipient route tag");
assertNotIncludes(createSealedTicket, "senderAlias", "RouteCapsule must not store old nickname alias");
assertNotIncludes(createSealedTicket, "reportSeeds", "RouteCapsule must not store old report seeds");
assertNotIncludes(createSealedTicket, `addInbox${"Pointer"}`, "new ticket creation must not write removed inbox pointers");
assertNotIncludes(createSealedTicket, `addInboxCapability${"Slot"}`, "new ticket creation must not use temporary slots");

const blindTags = read("src/features/ticketing/blind-tags.ts");
for (const token of [
  "nekonymous:contact",
  "nekonymous:block",
  "nekonymous:abuse-subject",
  "nekonymous:report-event",
  "nekonymous:reporter-subject",
  "canonicalInput",
]) {
  assertIncludes(blindTags, token, `blind-tags must include ${token}`);
}

const safetyState = read("src/storage/safety-state/safety-state.do.ts");
assertIncludes(safetyState, "report_events", "SafetyState must store report events");
assertIncludes(safetyState, "sanction_state", "SafetyState must store sanction state");
assertIncludes(safetyState, "COUNT(*) AS count FROM", "SafetyState must count distinct reporters");
assertIncludes(safetyState, "operatorClearSanction", "SafetyState must expose internal clear API");

const resolver = read("src/features/ticketing/resolve-ticket-action.ts");
assertIncludes(resolver, "parseTicketCapability(ticketRef)", "ticket resolver must parse canonical capabilities");
assertIncludes(resolver, "createOwnerProofTag", "resolver must bind owner proof to account generation");
assertIncludes(resolver, "deriveTicketKeys", "resolver must require keySeed-backed keys");
assertIncludes(resolver, "actorUserId", "owner proof must include current internal account id");

const identity = read("src/features/identity/identity-service.ts");
assertIncludes(identity, "invalidateUserConversationProfile", "reset must invalidate profile vault state");
assertIncludes(identity, "listUnreadItemsForReset", "reset must inspect unread items before purging");
assertIncludes(identity, "openUnreadCapability", "reset must decrypt unread capabilities in memory");
assertIncludes(identity, "deleteTicketRecord", "reset must delete unread ticket records");
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
assertNotIncludes(outbox, `ticket-${"capability"}`, "outbox must not deliver raw ticket capabilities");
assertNotIncludes(outbox, "decryptTicketCapabilityForDelivery", "direct capability delivery helper must be removed");
assertNotIncludes(outbox, "editMessageText", "outbox must not support editable inbox notices");
assertIncludes(outbox, "lease_attempt_id", "outbox sends must use attempt leases");
assertIncludes(outbox, "send_locks", "outbox must serialize sends per chat DO");
assertIncludes(outbox, "permanent_error", "outbox must retain permanent failure state");
assertIncludes(outbox, "async alarm()", "outbox must clean retained rows by alarm");
assertIncludes(outbox, "retryLeaseUntil", "outbox must hold chat locks through retry-after delays");
assertIncludes(outbox, "next.due_at <= now", "outbox must reschedule overdue cleanup sweeps");

const outboxConsumer = read("src/queues/outbox-consumer.ts");
assertIncludes(outboxConsumer, "OUTBOX_CHAT_CONCURRENCY", "outbox consumer must bound cross-chat concurrency");
assertIncludes(outboxConsumer, "handleChatMessages", "outbox consumer must process each chat sequentially");
assertIncludes(outboxConsumer, "inbox-drain", "outbox consumer must process unread drain jobs");
assertIncludes(outboxConsumer, "drainUnreadInbox", "unread drain jobs must use canonical drain handler");

const index = read("src/index.ts");
assertIncludes(index, "case \"neko-outbox\"", "queue dispatch must handle outbox explicitly");
assertIncludes(index, "Unknown queue:", "unknown queues must fail loudly");
assertIncludes(index, "SafetyStateDurableObjectV4", "SafetyState DO must be exported");
assertNotIncludes(index, "ReportLedger", "ReportLedger DO must stay removed");

const outboxClient = read("src/storage/telegram-outbox-client.ts");
assertIncludes(outboxClient, "stub.sendJob(job)", "outbox client must use typed DO RPC");

const ticketVaultClient = read("src/storage/ticket-vault/ticket-vault.client.ts");
assertIncludes(ticketVaultClient, ".storeTicket(input)", "ticket vault client must use typed DO RPC");
assertIncludes(ticketVaultClient, ".getTicket(ticketHash)", "ticket vault client must use typed DO RPC");

const userStateClient = read("src/storage/user-state-client.ts");
assertIncludes(userStateClient, ".getState()", "user state client must use typed DO RPC");
assertIncludes(userStateClient, "DurableObjectCallError(404", "user state client must preserve fail-closed 404 semantics");
assertIncludes(userStateClient, "claimNextUnreadItem", "user state client must expose unread claim RPC");
assertIncludes(userStateClient, "completeUnreadDelivery", "user state client must expose attempt-guarded completion");
assertNotIncludes(userStateClient, `addInbox${"Pointer"}`, "user state client must not expose removed inbox pointers");
assertNotIncludes(userStateClient, `listInbox${"Page"}`, "user state client must not expose removed inbox pages");

const ticketCapability = read("src/features/ticketing/ticket-capability.ts");
assertIncludes(ticketCapability, "TICKET_CAPABILITY_BYTES =\n  TICKET_CAPABILITY_NONCE_BYTES + TICKET_CAPABILITY_KEY_SEED_BYTES", "ticket capability must be 16-byte nonce plus 16-byte keySeed");
assertIncludes(ticketCapability, "TICKET_CAPABILITY_CHARS = 43", "encoded ticket capability must be 43 chars");
assertNotIncludes(ticketCapability, `TicketCapability${"V" + "2"}`, "versioned ticket capability type must be removed");
assertNotIncludes(ticketCapability, `${"Leg" + "acy"}Ticket${"Capability"}`, "removed ticket capability type must stay absent");

for (const [path, source] of [
  ["src/features/ticketing/keys.ts", read("src/features/ticketing/keys.ts")],
  ["src/features/ticketing/resolve-ticket-action.ts", resolver],
  ["src/features/ticketing/create-sealed-ticket.ts", createSealedTicket],
]) {
  for (const token of [
    `create${"Leg" + "acy"}`,
    `derive${"Leg" + "acy"}`,
    "capability.version",
    `capability${"Version"}`,
    `TicketCapability${"V" + "2"}`,
    `${"Leg" + "acy"}Ticket${"Capability"}`,
    `ticket:${"v" + "2"}`,
  ]) {
    assertNotIncludes(source, token, `${path} must not contain ${token}`);
  }
}

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
assertIncludes(wrangler, "\"SAFETY_STATE_DO\"", "wrangler must bind SafetyState");
const activeDurableObjectBindings = wrangler.slice(
  wrangler.indexOf("\"durable_objects\""),
  wrangler.indexOf("\"migrations\"")
);
assertNotIncludes(
  activeDurableObjectBindings,
  "REPORT_LEDGER",
  "wrangler must not bind ReportLedger"
);
assertNotIncludes(
  activeDurableObjectBindings,
  "ReportLedger",
  "wrangler must not actively bind ReportLedger classes"
);
assertIncludes(wrangler, "head_sampling_rate\": 0.1", "production traces must use reduced sampling");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-outbox-dlq\"", "outbox must use a dedicated DLQ");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-stats-dlq\"", "stats must use a dedicated DLQ");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-profile-index-dlq\"", "profile index must use a dedicated DLQ");
if (wrangler.includes("NEKO_DLQ") || wrangler.includes("neko-dlq")) {
  fail("wrangler.jsonc must not bind the legacy shared neko-dlq queue");
}

console.log("verify-release-hardening: OK");
