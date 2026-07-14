/**
 * Static release-hardening invariants for the current sealed-ticket stack.
 * Run: pnpm test:release-hardening
 */

import {
  assertIncludes,
  assertNotIncludes,
  fail,
  readRepoFile,
} from "./verify-helpers.ts";

const read = readRepoFile;

const ticketVault = read("src/storage/ticket-vault/ticket-vault.do.ts");
assertIncludes(ticketVault, "route_enc = NULL", "expired tickets must clear route_enc");
assertIncludes(ticketVault, "meta_enc = NULL", "expired tickets must clear meta_enc");
assertIncludes(ticketVault, "async alarm()", "TicketVault must sweep expiry by alarm");
assertIncludes(ticketVault, "EXPIRY_SWEEP_LIMIT", "TicketVault expiry sweep must be bounded");
assertIncludes(ticketVault, "next.expires_at <= now", "TicketVault must reschedule overdue expiry sweeps");
assertIncludes(
  read("src/contracts/ticketing/lifecycle.ts"),
  '"active"',
  "ticket lifecycle must include active"
);
assertIncludes(
  read("src/contracts/ticketing/lifecycle.ts"),
  '"viewed" | "replied"',
  "ticket transitions must be lifecycle-only (viewed/replied)"
);
assertNotIncludes(
  read("src/contracts/ticketing/lifecycle.ts"),
  '"blocked"',
  "ticket status must not include blocked"
);
assertNotIncludes(
  read("src/contracts/ticketing/lifecycle.ts"),
  '"reported"',
  "ticket status must not include reported"
);

const userState = read("src/storage/user-state-do.ts");
assertIncludes(userState, "unread_inbox_items", "inbox admission must use unread delivery queue rows");
assertIncludes(userState, "sealed_capability_enc BLOB NOT NULL", "unread capability must be stored as ciphertext");
assertIncludes(userState, "isUnreadDedupeConflict", "unread insert must only dedupe on unique constraint conflicts");
assertIncludes(userState, "sqlChanges()", "UserState RPC must verify rows written");
assertIncludes(userState, "DEFAULT_DRAFT_TTL_MS", "drafts must get a default TTL");
assertIncludes(userState, "expires_at <= ?", "getDraft must expire stale drafts");
assertIncludes(userState, "inserted: this.sqlChanges() === 1", "addBlock must report true inserts");
assertIncludes(userState, "removed: this.sqlChanges() === 1", "removeBlock must report true removals");
assertIncludes(userState, "delivery_attempt_id", "unread claims must be attempt guarded");
assertIncludes(userState, "DELETE FROM unread_inbox_items", "purge must clear unread rows");
assertIncludes(userState, "eventId: crypto.randomUUID()", "each unread admission must mint an independent notification event");
assertIncludes(userState, "getLabel(contactTag", "UserState must expose single-label nickname lookup");
assertIncludes(userState, "dropRemovedNotificationCycleTable", "UserState must drop removed notification-cycle table");
assertIncludes(userState, "block_tag TEXT PRIMARY KEY", "blocks must use recipient-local block tags");
assertIncludes(userState, "contact_tag TEXT PRIMARY KEY", "nicknames must use recipient-local contact tags");
assertIncludes(userState, "deleteAlarm()", "purge must clear durable object alarms before deleteAll");
assertNotIncludes(
  userState,
  "CREATE TABLE IF NOT EXISTS inbox_notification_cycle",
  "notification cycle table must not be created"
);
assertNotIncludes(userState, "createNotificationCycle", "notification cycle helpers must stay absent");
assertNotIncludes(userState, "getInboxNotificationCycle", "notification cycle RPCs must stay absent");
assertNotIncludes(userState, "claimUnreadBatch", "batch unread claim must stay absent");
assertNotIncludes(userState, "notice_message_id", "notification message ids must not be stored");
assertNotIncludes(userState, "notice_revision", "editable notification revisions must stay absent");
assertNotIncludes(userState, "unread_notice_state", "editable unread notices must stay absent");
assertNotIncludes(userState, "blocked_user_id", "old block relation column must stay absent");
assertNotIncludes(userState, "target_user_id", "old nickname relation column must stay absent");
assertNotIncludes(userState, `addInbox${"Pointer"}`, "inbox pointer RPC must stay absent");
assertNotIncludes(userState, `inbox${"Page"}`, "inbox page RPC must stay absent");
assertNotIncludes(userState, `markInbox${"Status"}`, "inbox status RPC must stay absent");

const createSealedTicket = read("src/features/ticketing/create-sealed-ticket.ts");
assertIncludes(createSealedTicket, "createTicketCapability", "new tickets must create canonical capabilities");
assertIncludes(createSealedTicket, "deriveTicketKeys", "new tickets must use canonical key derivation");
assertIncludes(createSealedTicket, "createContactTag", "new tickets must derive contact tags");
assertIncludes(createSealedTicket, "createBlockTag", "new tickets must derive block tags");
assertIncludes(createSealedTicket, "createAbuseSubjectTag", "new tickets must derive abuse-subject tags");
assertIncludes(createSealedTicket, "getSafetyDecision", "new tickets must check safety state");
assertIncludes(createSealedTicket, "sealUnreadCapability", "new tickets must seal capability into unread row");
assertIncludes(createSealedTicket, "addUnreadItem", "new tickets must create unread delivery queue item");
assertIncludes(createSealedTicket, "unreadAccepted = true", "ticket creation must mark unread acceptance before notification enqueue");
assertIncludes(createSealedTicket, "if (!unreadAccepted)", "ticket creation must compensate when unread insert fails");
assertIncludes(createSealedTicket, "createUnreadInboxDedupeTag", "new unread items must use blind dedupe");
assertIncludes(createSealedTicket, "eventId:", "notify payload must use notification eventId");
assertNotIncludes(createSealedTicket, "senderRouteTag", "RouteCapsule must not store removed sender route tag");
assertNotIncludes(createSealedTicket, "recipientRouteTag", "RouteCapsule must not store removed recipient route tag");
assertNotIncludes(createSealedTicket, "senderAlias", "RouteCapsule must not store removed nickname alias");
assertNotIncludes(createSealedTicket, "reportSeeds", "RouteCapsule must not store removed report seeds");
assertNotIncludes(createSealedTicket, `addInbox${"Pointer"}`, "ticket creation must not write inbox pointers");
assertNotIncludes(createSealedTicket, `addInboxCapability${"Slot"}`, "ticket creation must not use temporary slots");

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
assertIncludes(safetyState, "isReportEventConflict", "report insert must only treat unique conflicts as duplicates");
assertIncludes(safetyState, "reportersSincePhase", "sanction windows must start at phase boundary");
assertIncludes(safetyState, "const now = Date.now()", "SafetyState must own authoritative report time");

const safetyClient = read("src/storage/safety-state/safety-state.client.ts");
assertIncludes(safetyClient, "`safety:${abuseSubjectTag}`", "SafetyState must be keyed by full abuse subject tag");
assertNotIncludes(safetyClient, "shardNameForLookupHash(\"safety\"", "SafetyState must not use prefix sharding");

const requestService = read("src/features/conversation/suggestions/request-service.ts");
assertIncludes(requestService, "getSafetyDecision", "conversation requests must check safety state");
assertIncludes(requestService, "checkCanReceive", "conversation requests must enforce recipient block/pause");
assertIncludes(requestService, "createBlockTag", "conversation requests must derive block tags");
assertIncludes(requestService, "claimRequestAccept", "accepted request tickets need an accepting claim before ticket creation");
assertIncludes(requestService, "completeRequestAccept", "accepted requests must finalize with the created ticket hash");
assertIncludes(requestService, "requestAcceptOperationId", "accepted request tickets need stable operation keys");
assertIncludes(requestService, "candidateProfile?.status === \"discoverable\"", "request creation must reject non-discoverable candidates");

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
assertNotIncludes(identity, "state.labels", "toBotUser must not bulk-load contact labels");
assertNotIncludes(identity, "contactLabels:", "BotUser must not carry bulk contactLabels");

const contact = read("src/features/ticketing/contact.ts");
assertIncludes(contact, "getContactLabel", "nicknames must decrypt one contact label at a time");
assertIncludes(contact, "getContactLabelCiphertext", "nickname lookup must fetch a single ciphertext");

const ticketingService = read("src/features/ticketing/ticketing-service.ts");
assertIncludes(ticketingService, "export const encryptScopedPayload", "scoped payload encrypt must be canonical");
assertIncludes(ticketingService, "export const decryptScopedPayload", "scoped payload decrypt must be canonical");
assertNotIncludes(ticketingService, "MatchIntro", "MatchIntro helpers must stay removed");

const requestNotify = read("src/features/conversation/suggestions/request-notify.ts");
if (/idempotencyKey:\s*`request-notify:\$\{requestRef\}`/.test(requestNotify)) {
  fail("request notification idempotency must not store raw request refs");
}

const keyboards = read("src/bot/keyboards.ts");
assertIncludes(keyboards, "inline_keyboard", "message action keyboards must be plain Telegram payloads");
assertNotIncludes(keyboards, "InlineKeyboard", "message action keyboards must not use Grammy InlineKeyboard class across DO RPC");

const outbox = read("src/storage/telegram-outbox-do.ts");
assertIncludes(outbox, "Pace only after a prior", "first outbox send must skip artificial pacing");
assertIncludes(outbox, "async sendJob(job: TelegramOutboxJob)", "outbox must expose typed RPC sendJob");
assertNotIncludes(outbox, `ticket-${"capability"}`, "outbox must not deliver raw ticket capabilities");
assertNotIncludes(outbox, "decryptTicketCapabilityForDelivery", "direct capability delivery helper must stay absent");
assertNotIncludes(outbox, "editMessageText", "outbox must not support editable inbox notices");
assertIncludes(outbox, "lease_attempt_id", "outbox sends must use attempt leases");
assertIncludes(outbox, "send_locks", "outbox must serialize sends per chat DO");
assertIncludes(outbox, "permanent_error", "outbox must retain permanent failure state");
assertIncludes(outbox, "async alarm()", "outbox must clean retained rows by alarm");
assertIncludes(outbox, "retryLeaseUntil", "outbox must hold chat locks through retry-after delays");
assertIncludes(outbox, "next.due_at <= now", "outbox must reschedule overdue cleanup sweeps");
assertIncludes(outbox, "CHAT_PACE_SCOPE", "outbox must pace sends per chat");
assertIncludes(outbox, 'status: "retry"', "outbox must return explicit retry status");
assertIncludes(outbox, 'status: "rejected"', "outbox must return explicit rejected status");
assertIncludes(outbox, "logBotError(\"telegram-outbox:internal\"", "outbox must log internal failures safely");

const outboxConsumer = read("src/queues/outbox-consumer.ts");
assertIncludes(outboxConsumer, "OUTBOX_CHAT_CONCURRENCY", "outbox consumer must bound cross-chat concurrency");
assertIncludes(outboxConsumer, "handleChatMessages", "outbox consumer must process each chat sequentially");
assertIncludes(outboxConsumer, "processChatLane", "outbox consumer must serialize per-chat inbox and telegram work");
assertIncludes(outboxConsumer, "isInboxDrainJob", "inbox drain jobs must be runtime validated");
assertIncludes(outboxConsumer, "result.status === \"retry\"", "inbox drain jobs must retry on transient delivery failure");
assertIncludes(outboxConsumer, "logBotError(\"queue:inbox-drain\"", "inbox drain failures must be logged safely");
assertIncludes(outboxConsumer, "drainUnreadInbox", "unread drain jobs must use canonical drain handler");
assertIncludes(outboxConsumer, "inbox-notification", "outbox consumer must process inbox notification jobs");
assertIncludes(outboxConsumer, "inbox-notification:${user.id}:${eventId}", "inbox notifications must use per-event idempotency");
assertIncludes(outboxConsumer, "getUnreadSummary", "inbox notifications must read live unread count");
assertIncludes(outboxConsumer, "inboxFreshNoticeMessage", "inbox notifications must include unread count copy");
assertIncludes(outboxConsumer, "DELIVER_INBOX_BUTTON", "inbox notices must use shared deliver CTA label");
assertNotIncludes(outboxConsumer, "editMessageText", "inbox notifications must never edit Telegram messages");
assertNotIncludes(outboxConsumer, "markInboxNotificationSent", "notification cycle mark-sent must stay absent");
assertNotIncludes(outboxConsumer, "closeInboxNotificationCycle", "notification cycle close must stay absent");
assertNotIncludes(outboxConsumer, "cycleId", "inbox notification consumer must not use cycle ids");

const inboxEvents = read("src/contracts/inbox/events.ts");
assertIncludes(inboxEvents, "eventId: InboxNotificationEventId", "notification jobs must carry eventId");
assertIncludes(inboxEvents, "Object.keys(value).length === 3", "notification jobs must reject extra fields");
assertNotIncludes(inboxEvents, "cycleId", "notification jobs must not carry cycleId");
assertNotIncludes(inboxEvents, "itemId", "notification jobs must not carry unread itemId");
assertNotIncludes(inboxEvents, "unreadCount", "notification jobs must not store unread count");

const index = read("src/index.ts");
assertIncludes(index, "case \"neko-outbox\"", "queue dispatch must handle outbox explicitly");
assertIncludes(index, "Unknown queue:", "unknown queues must fail loudly");
assertIncludes(index, "SafetyStateDurableObjectV4", "SafetyState DO must be exported");
assertNotIncludes(index, "ReportLedger", "ReportLedger DO must stay absent");

const outboxClient = read("src/storage/telegram-outbox-client.ts");
assertIncludes(outboxClient, "stub.sendJob(job)", "outbox client must use typed DO RPC");

const ticketVaultClient = read("src/storage/ticket-vault/ticket-vault.client.ts");
assertIncludes(ticketVaultClient, ".storeTicket(input)", "ticket vault client must use typed DO RPC");
assertIncludes(ticketVaultClient, ".getTicket(ticketHash)", "ticket vault client must use typed DO RPC");
assertNotIncludes(ticketVaultClient, "markTicketBlocked", "TicketVault must not mark blocked status");
assertNotIncludes(ticketVaultClient, "markTicketRecordReported", "TicketVault must not mark reported status");

const userStateClient = read("src/storage/user-state-client.ts");
assertIncludes(userStateClient, ".getState()", "user state client must use typed DO RPC");
assertIncludes(userStateClient, "DurableObjectCallError(404", "user state client must preserve fail-closed 404 semantics");
assertIncludes(userStateClient, "claimNextUnreadItem", "user state client must expose unread claim RPC");
assertIncludes(userStateClient, "completeUnreadDelivery", "user state client must expose attempt-guarded completion");
assertIncludes(userStateClient, "getContactLabelCiphertext", "user state client must expose single-label ciphertext fetch");
assertNotIncludes(userStateClient, "getOptionalUserState", "unused optional state helper must stay absent");
assertNotIncludes(userStateClient, "purgeUnreadInbox", "unused purgeUnreadInbox client must stay absent");
assertNotIncludes(userStateClient, `addInbox${"Pointer"}`, "user state client must not expose inbox pointers");
assertNotIncludes(userStateClient, `listInbox${"Page"}`, "user state client must not expose inbox pages");

const ticketCapability = read("src/features/ticketing/ticket-capability.ts");
assertIncludes(ticketCapability, "TICKET_CAPABILITY_BYTES =\n  TICKET_CAPABILITY_NONCE_BYTES + TICKET_CAPABILITY_KEY_SEED_BYTES", "ticket capability must be 16-byte nonce plus 16-byte keySeed");
assertIncludes(ticketCapability, "TICKET_CAPABILITY_CHARS = 43", "encoded ticket capability must be 43 chars");
assertNotIncludes(ticketCapability, `TicketCapability${"V" + "2"}`, "versioned ticket capability type must stay absent");
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
  "wrangler must not bind REPORT_LEDGER"
);
assertNotIncludes(
  activeDurableObjectBindings,
  "ReportLedger",
  "wrangler must not bind ReportLedger classes"
);
assertIncludes(wrangler, "head_sampling_rate\": 0.1", "production traces must use reduced sampling");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-outbox-dlq\"", "outbox must use a dedicated DLQ");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-stats-dlq\"", "stats must use a dedicated DLQ");
assertIncludes(wrangler, "dead_letter_queue\": \"neko-profile-index-dlq\"", "profile index must use a dedicated DLQ");
if (wrangler.includes("NEKO_DLQ") || wrangler.includes("neko-dlq")) {
  fail("wrangler.jsonc must not bind the shared neko-dlq queue");
}

console.log("verify-release-hardening: OK");
