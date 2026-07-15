# Architecture

**Status:** canonical architecture for the current `master` branch.

Nekonymous is a Telegram-only Cloudflare Worker. The static site under `site/` is an introduction page and is not part of the Worker runtime.

## Runtime surface

The Worker has three entry responsibilities:

```text
fetch()
  → accept Telegram POST /bot
  → validate Telegram webhook secret
  → run grammY middleware and handlers

queue()
  → dispatch neko-outbox
  → dispatch neko-stats
  → dispatch neko-profile-index

Durable Object exports
  → expose bound stateful classes required by Wrangler
```

Unknown HTTP routes return `404`. Unknown queue names fail explicitly.

## System map

```text
┌───────────────────────┐
│ Telegram Bot API      │
└───────────┬───────────┘
            │ webhook
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Worker                                            │
│ POST /bot → grammY → commands / messages / callbacks         │
│ queue()   → outbox / stats / profile-index                    │
│ exports   → Durable Object classes                            │
└──────┬───────────────┬───────────────┬─────────────┬─────────┘
       │               │               │             │
       ▼               ▼               ▼             ▼
      D1         Durable Objects       KV         Vectorize
                       │
                       ▼
               Telegram outbox
                       │
                       ▼
               Telegram Bot API
```

## Cloudflare planes

| Plane | Authority | Must not become |
|---|---|---|
| D1 | active users, public links, aggregate daily statistics | anonymous transcript, profile store, pair graph |
| UserState DO | recipient-local unread queue, drafts, blocks, labels, rate limits, active profile session, discoverability and exposure state | global user database or plaintext inbox |
| TicketVault DO | encrypted route, payload, metadata, owner proof, ticket lifecycle | plaintext message table or per-user index |
| SafetyState DO | blind report events and sanction state for one abuse subject | reversible reporter/subject graph |
| ProfileVault DO | encrypted finalized profile and index routing state | D1-fit profile graph |
| ConversationVault DO | sealed suggestions, sealed requests, encrypted request intros | public relationship table |
| PairLedger DO | blind pair locks, blocks, cooldowns, exposure state | reversible pair directory |
| TelegramOutbox DO | per-chat paced, idempotent Telegram delivery with leases | unbounded delivery history |
| KV | best-effort `tg:` and `link:` routing cache, short-lived stats cache | product source of truth |
| Queues | asynchronous outbox, statistics aggregation, profile indexing | exactly-once authority |
| Vectorize | bounded coarse candidate retrieval | final ranker, identity store, profile source of truth |

Durable Objects own atomic state transitions. Queue and alarm delivery is at-least-once, so all consumers and durable mutations must be idempotent.

## Anonymous message creation

The sender-facing hot path is intentionally bounded:

```text
resolve sender identity and active draft
  → resolve recipient from public slug
  → createSealedTicket
       safety decision
       recipient pause/block gate
       encrypt route/payload/meta
       store TicketVault record
       store sealed unread capability
  → acknowledge sender
  → defer notification enqueue and aggregate statistics
```

The durable acceptance point is successful TicketVault storage plus successful unread insertion. Notification and statistics failures do not roll back an accepted ticket.

### Ticket and unread ownership

A ticket is independent. The recipient UserState does not store `ticketHash`, the plaintext capability, the message body, or a sender id. It stores:

```text
random unread item id
sealed capability ciphertext
blind dedupe tag
delivery state, attempt id, and lease
created and expiry timestamps
```

The unread capacity and one drain request are both bounded to 50 items.

## Unread notifications

Every newly accepted unread item creates one independent notification event.

```text
new unread
  → eventId returned by UserState
  → inbox-notification queue job
  → consumer loads current unread count from UserState
  → if count > 0, send one fresh Telegram notification
  → button callback: ib:d
```

Properties:

- the Queue job does not contain a ticket capability, ticket hash, message body, route, sender identity, or authoritative count;
- the displayed count is read at send time;
- duplicate Queue delivery is suppressed by an Outbox idempotency key based on account and event id;
- if the inbox has already been drained and the current count is zero, the notification job is acknowledged without sending;
- notifications are intentionally per accepted unread, not an editable aggregate message or an inbox cycle.

This product choice can create multiple paced notifications during a burst. It does not join tickets in storage.

## Inbox delivery

`/inbox`, the main keyboard inbox entry, and `ib:d` all request a drain of the current actor's unread queue.

```text
user requests inbox
  → cleanup expired unread rows
  → read live unread count
  → if zero, show empty message
  → enqueue inbox-drain job
  → immediately acknowledge that delivery is starting

inbox-drain consumer
  → claim one unread row with a lease
  → open sealed capability in memory
  → resolve TicketVault record
  → verify current actor + current internal account owner proof
  → derive keys and decrypt route/payload/meta
  → send through per-chat TelegramOutbox DO
  → on success, clear ticket payload and mark viewed
  → complete and delete unread row
  → repeat, up to 50
```

There is no inbox list, page, pagination, viewed shell, or durable delivered registry. The inbox is a bounded delivery queue.

### Failure semantics

- temporary Queue, DO, storage, cryptographic-runtime, or Telegram failures release the unread lease and retry;
- permanent missing, expired, invalid, or unsupported tickets are completed as orphans;
- orphan cleanup first proves ownership of the current unread attempt, then removes the vault record;
- a stale attempt cannot delete a TicketVault record owned by a newer claim;
- permanent Telegram rejection removes the unreachable unread and ticket record;
- a successful Outbox idempotency key prevents logical duplicate delivery.

## Delivered ticket actions

The delivered Telegram message includes capability callbacks for reply, block/unblock, private nickname, and report.

A callback is never trusted by itself:

```text
callback capability
  → parse canonical 43-character capability
  → derive ticketHash from lookupNonce
  → load TicketVault record
  → verify owner proof for current actor/current account
  → derive keys with keySeed
  → decrypt only required capsule
  → apply action policy
```

Callback families:

| Prefix | Domain |
|---|---|
| `r:` | anonymous reply |
| `b:` / `u:` | block / unblock |
| `n:` | private nickname |
| `rp:` | report |
| `ib:d` | drain current unread inbox |
| `st:` | settings and confirmations |
| `t:` | conversation profile |
| `m:` | conversation suggestion hub |
| `s:` | sealed suggestion action |
| `q:` | sealed request action |

Unknown or expired callbacks receive a generic unavailable response.

## Blocking, labels, and safety

Blind tags are domain separated:

- `contactTag`: recipient current account + sender current account; nickname continuity ends when either account is reset;
- `blockTag`: recipient current account + sender stable actor hash; sender reset does not bypass the block;
- `abuseSubjectTag`: sender stable actor hash; sanctions survive sender account reset;
- `reportEventTag`: ticket hash + reporter stable actor hash; prevents duplicate report of the same ticket by the same reporter;
- `reporterSubjectTag`: abuse subject + reporter stable actor hash; counts distinct reporters without creating a global reporter identity.

`checkCanReceive` is enforced for direct anonymous messages, replies, and conversation requests.

Safety policy is centralized in `SafetyStateDO`:

- 5 distinct reporters in 24 hours → 72-hour suspension;
- then 30 days of probation;
- 3 distinct reporters in 7 days during probation → indefinite ban;
- a later full first-strike threshold after an earlier strike can also ban;
- report events are retained for 90 days;
- suspended or banned actors cannot initiate new anonymous contact, replies, or conversation requests.

## Conversation profile and suggestions

```text
25-question profile
  → encrypted active session in UserState
  → encrypted finalized profile in ProfileVault
  → sealed profile-index Queue job
  → two 8-dimensional vectors in Vectorize
  → bounded reciprocal retrieval
  → deterministic TypeScript ranking
  → sealed suggestion
  → optional encrypted intro and sealed request
  → accept creates a normal sealed message ticket
```

Vectorize retrieves candidates only. Final ordering, eligibility, cooldowns, pair state, and exposure rules are applied in code.

Detailed protocol: [Conversation Suggestions](./conversation-suggestions.md).

## Telegram outbox

Outbox jobs use stable idempotency keys. The consumer groups work by chat and preserves FIFO order inside each chat while processing different chats concurrently.

`TelegramOutboxDO` provides:

- per-chat lease and lock;
- first send without artificial pacing delay;
- approximately one second between real sends in the same chat;
- Telegram `retry_after` as authoritative backoff;
- five-second generic retry for transient failures;
- permanent rejection for non-retryable Telegram errors;
- seven-day bounded idempotency retention;
- alarm-based cleanup.

Seen receipts are disabled by default to avoid doubling Outbox traffic.

## Identity and hard reset

D1 is authoritative for identity and public links. KV reads fall back to D1 and KV writes/deletes are best effort.

User creation inserts the active user and public link in one D1 batch. A hard reset:

```text
disable and invalidate conversation profile state
  → best-effort remove unread TicketVault records
  → purge UserState
  → hard-delete user and public links from D1
  → remove routing cache entries
  → create a new internal user and public link
```

The owner proof includes the internal account id, so old ticket actions stop working immediately after reset even if encrypted vault records remain until bounded cleanup.

## Statistics

Product events are best-effort Queue messages aggregated into D1 daily tables. Every stats Queue event carries an event id; the consumer records a 35-day D1 receipt before applying counters so at-least-once Queue retries do not double-count accepted events. Statistics do not scan TicketVault, UserState, ConversationVault, PairLedger, or SafetyState.

Public statistics contain aggregate counts only. They do not expose top users, per-link activity, message bodies, ticket details, or timelines.

## Source boundaries

```text
src/
  index.ts       Worker entry, queue dispatch, DO exports
  bot/           grammY wiring, commands, keyboards, callbacks
  contracts/     canonical domain and runtime contracts
  features/      identity, ticketing, moderation, settings, conversation
  storage/       Durable Objects and typed RPC clients
  queues/        Queue consumers
  stats/         aggregate event emission and readers
  i18n/          Persian-first visible copy
  utils/         small shared runtime helpers
```

Rules:

- handlers parse Telegram input, invoke product logic, and render responses;
- crypto and storage details stay outside UI handlers;
- Durable Object clients are typed and centralized;
- pure profile/ranking calculations do not receive `env`;
- all loops, result sets, Queue batches, decryptions, and retention scans are bounded;
- every promise is awaited, returned, or intentionally deferred through `waitUntil`;
- no request-scoped mutable state lives at module scope.

## Architecture verification

```bash
pnpm check
pnpm audit:d1
pnpm audit:ticket-storage
pnpm audit:types
pnpm test:workers
```

The verification suite covers storage boundaries, ticket lifecycle, Queue and Outbox idempotency, UserState RPC behavior, Safety thresholds, request accept idempotency, profile indexing, retrieval/ranking, privacy leakage, reset hardening, and bot routing.
