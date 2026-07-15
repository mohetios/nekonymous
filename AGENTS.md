# AGENTS.md

## Prime directive

Nekonymous is a single Cloudflare Worker with a Telegram webhook and Queue consumers. Keep server code small, edge-safe, bounded, and explicit.

Optimize changes for:

- low CPU and memory;
- few sequential subrequests;
- bounded loops, batches, decryptions, and storage scans;
- explicit validation and authorization;
- idempotent state transitions;
- conservative failure semantics;
- minimal architecture growth.

Do not introduce generic repository layers, plugin systems, dependency-injection frameworks, or a parallel `core/` tree.

## Current product identity

Nekonymous / نِکونیموس is a Persian-first anonymous Telegram bot for personal links, sealed anonymous messaging, anonymous replies, a conversation-style assessment, and opt-in conversation suggestions.

It is a hosted relay with encryption at rest. Do not claim E2EE, zero-knowledge, perfect anonymity, dating fit, personality diagnosis, or guaranteed safety.

Preferred Persian terms:

```text
پیام ناشناس
پاسخ ناشناس
صندوق پیام‌ها
نام خصوصی
ارزیابی سبک گفت‌وگو
پیشنهاد گفت‌وگو
گزینه‌ی گفت‌وگو
درخواست گفت‌وگو
پیام شروع گفت‌وگو
نمایش در پیشنهادها
توقف دریافت پیام
فعال‌سازی دریافت پیام
پاک کردن حساب
مرزهای حریم خصوصی
رمزنگاری در حالت سکون
```

Avoid positive use of:

```text
مچ
مچ‌یابی
درصد سازگاری
تست شخصیت
دوستیابی
پیام‌رسان امن
ناشناس کامل
رمزنگاری سرتاسری
```

## Read before editing

| Domain | Canonical document |
|---|---|
| product overview | `README.md` |
| runtime, queues, bot surfaces | `docs/architecture.md` |
| ticketing, inbox, actions, Safety | `docs/sealed-ticketing.md` |
| profiles, retrieval, ranking, requests | `docs/conversation-suggestions.md` |
| security claims, retention, reset | `docs/threat-model.md` |
| setup, migrations, deploy, QA | `docs/development.md` |

## Current stack

- Cloudflare Worker entry: `src/index.ts`
- grammY Telegram bot
- D1: users, public links, aggregate statistics
- KV: best-effort routing/cache only
- Durable Objects (SQLite):
  - `UserStateDurableObject`
  - `TelegramOutboxDurableObject`
  - `TicketVaultDurableObject`
  - `SafetyStateDurableObject`
  - `ProfileVaultShardDurableObject`
  - `ConversationVaultShardDurableObject`
  - `PairLedgerShardDurableObject`
- Queues: `neko-outbox`, `neko-stats`, `neko-profile-index`
- Vectorize: `CONVERSATION_VECTORS`, 8-dimensional controlled vectors
- Web Crypto: HMAC, HKDF-SHA-256, AES-256-GCM
- no Workers AI in Conversation Suggestions

## Repository shape

```text
src/
  index.ts
  bot/
  contracts/
  features/
    identity/
    ticketing/
    moderation/
    settings/
    conversation/profile/
    conversation/suggestions/
  storage/
  queues/
  stats/
  i18n/
  utils/

docs/
  README.md
  architecture.md
  sealed-ticketing.md
  conversation-suggestions.md
  threat-model.md
  development.md
```

Do not invent old files, retired safety ledgers, inbox pagination handlers, or retired assessment/matching paths.

## Worker and routing rules

- `src/index.ts` only delegates `fetch`, dispatches known queues, and exports bound DO classes.
- HTTP product surface is Telegram `POST /bot` only.
- Keep webhook secret validation through `BOT_SECRET_KEY`.
- Unknown queue names fail explicitly.
- Do not add a general HTTP router, public API, admin endpoint, or web application without explicit product approval and security review.

## Sealed-ticket invariants

- `TicketCapability` is 32 bytes: 16-byte lookup nonce + 16-byte key seed.
- Canonical encoding is 43 unpadded Base64URL characters.
- `ticketHash` derives only from lookup nonce.
- Decryption requires key seed plus `APP_MASTER_KEY`.
- Owner proof binds recipient stable actor hash, current internal account id, and ticket hash.
- TicketVault stores encrypted route/payload/meta and blind authorization material.
- UserState unread stores sealed capability ciphertext, blind dedupe, lease, and timestamps only.
- UserState must not store ticket hash, raw capability, message body, or sender account id.
- One newly accepted unread creates one independent notification event.
- Notification Queue jobs contain account/event only; count is read live.
- `/inbox` and `ib:d` drain the current actor's queue; no list, pagination, control card, or viewed shell.
- temporary failures release and retry;
- permanent orphan cleanup must first complete the exact unread attempt;
- successful delivery clears payload and completes unread;
- seen receipts remain disabled unless a product decision changes the load model.

## Blind-tag invariants

- contact tag: recipient current account + sender current account;
- block tag: recipient current account + sender stable actor hash;
- abuse subject: sender stable actor hash;
- report event: ticket hash + reporter stable actor hash;
- reporter subject: abuse subject + reporter stable actor hash.

Do not replace these with direct account ids or a shared global relationship key.

## Safety invariants

- one SafetyState DO per abuse subject;
- allowed report reason codes are runtime validated;
- duplicate event tag does not count again;
- count distinct reporter subject tags;
- first phase starts on first countable report;
- 5 reporters/24h → 72h suspension;
- 30-day probation;
- 3 reporters/7d during probation → ban;
- report event retention is 90 days;
- sender reset does not clear sanction;
- Safety gate applies to direct message, reply, and conversation request creation.

## Conversation Suggestions invariants

- profile version `current`, 25 questions, 8 dimensions;
- raw answers stay encrypted in active UserState session and are deleted after finalization;
- finalized profile is encrypted in ProfileVault;
- two controlled 8-dimensional Vectorize projections;
- no D1 profile/request/pair graph and no D1 candidate retrieval path;
- no Workers AI;
- final ranking is deterministic TypeScript;
- discoverability is explicit and off by default;
- request intro is encrypted in ConversationVault;
- pair state is blind in PairLedger;
- request accept uses claim/lease plus deterministic ticket `dedupeKey`;
- repeated accept creates one logical sealed ticket;
- requests obey recipient block/pause and requester Safety gates.

## D1 and KV rules

D1 authority:

```text
users
public_links
platform aggregate statistics
```

Forbidden in D1:

```text
message body
TicketCapability or ticketHash
finalized profile or raw answers
suggestion/request intro
requester/candidate relation
pair graph
private nickname/block relation
```

KV is best-effort cache only:

```text
tg:{telegramHash} → user id
link:{slug} → user id
short aggregate stats cache
```

KV failure must fall back to D1 or log and continue. Never use KV for inbox ordering or product authority.

## Durable Object and Queue rules

- all DO calls go through typed storage clients;
- DOs own atomic state transitions;
- Queue bodies require runtime validation;
- Queue delivery is at-least-once;
- use stable idempotency keys;
- preserve per-chat FIFO lanes;
- first Telegram send is immediate; subsequent real sends are paced around one second;
- Telegram `retry_after` overrides generic retry;
- generic Outbox retry is five seconds;
- persistent rows require explicit bounded retention/cleanup.

## Logging rules

Never log:

```text
message text or caption
raw Telegram user/chat id
bot token, webhook secret, application keys
raw capability, ticket hash, blind tags
ciphertext or decrypted capsule
full Telegram update/request/error object
```

Use stage-based safe logs and timing fields only. User-facing errors remain generic.

## Promise and performance rules

Every promise is awaited, returned, or deliberately deferred through `ExecutionContext.waitUntil`.

Only defer non-authoritative work such as notifications and aggregate statistics after durable acceptance. Do not defer required TicketVault or unread writes.

Avoid:

- unbounded arrays or storage scans;
- repeated full `toBotUser` loads on hot paths;
- CPU-heavy transforms in webhook handlers;
- Node-only runtime APIs;
- module-level mutable request state;
- unnecessary dependencies.

## Migrations and remote safety

- default branch is `master`;
- preserve applied D1 and Durable Object migration history;
- do not rewrite or reorder applied Wrangler migration tags;
- inspect `wrangler deployments list`, `wrangler versions list`, and dry-run output before migration changes;
- do not deploy, apply remote migrations, flush resources, mutate BotFather profile, or clear production data without explicit instruction.

## Required checks

```bash
pnpm check
git diff --check
```

Use focused tests as appropriate. Update docs and automated verification when an invariant changes.

## Commit messages

Use Conventional Commits with required scope:

```text
type(scope): imperative description
```

Examples:

```text
fix(inbox): retry transient ticket resolution failures
docs(ticketing): document per-unread notification events
test(safety): cover five-reporter suspension threshold
```

## Final report

After changes, report briefly:

- files changed/created/removed;
- checks run and results;
- remote or destructive actions performed;
- remaining manual QA or follow-up.
