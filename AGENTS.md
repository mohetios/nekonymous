# AGENTS.md

## Prime Directive

Nekonymous runs as a **single Cloudflare Worker** with a **Telegram webhook only** (no public HTML site). Server code must be small, edge-safe, low-CPU, and predictable.

When changing bot logic, crypto, D1, KV cache, Durable Objects, queues, or Worker routes, optimize for:

- low CPU per request
- few KV / Durable Object / D1 / HTTP subrequests
- small memory footprint
- simple control flow
- explicit validation and auth checks
- minimal files changed
- no accidental architecture growth

Do not generate heavy abstractions, repository layers, generic service frameworks, or framework-inside-framework patterns.

## V1 routing and privacy rules

Capability-based anonymous routing is the current model. Do not reintroduce older conversation/ref patterns.

- Telegram private chat buttons hold short routing capabilities; raw capabilities are request-only and must not be stored.
- `TicketVaultDO` stores sealed route and payload capsules (encrypted at rest); `UserStateDO` holds blind ticket slots only — not message bodies or ticket hashes.
- Anonymous messaging must not write a plain sender-recipient graph or message transcript to D1.
- Keep the existing compact repository layout; do not create a parallel `core/` tree.
- No KV inbox/conversation storage and no dual-read or migration fallbacks for removed storage paths.
- Reports, labels, blocks, and pending actions use hashes/tags/encrypted context — not plaintext anonymous peer edges.
- Do not claim E2EE, zero-knowledge delivery, perfect anonymity, or clinical/dating compatibility in code or copy.

## V2 refactor mode

- **Conversation Suggestions V2** is a clean-slate refactor — delete V1 assessment/matching; no migration, dual-read, or compatibility adapters.
- Read `README.md` and `docs/threat-model.md` before editing any user-facing or public copy.
- Read `docs/conversation-suggestions.md` before touching profile, indexing, retrieval, ranking, suggestions, or requests.
- Read `docs/sealed-ticketing.md` before touching inbox, ticketing, or sealed-ticket storage.
- Read `docs/architecture.md` before touching commands, keyboards, menus, drafts, or callback routing.

### Docs source of truth

| Topic | Path |
|-------|------|
| Product overview | `README.md` |
| Security limits | `SECURITY.md`, `docs/threat-model.md` |
| Bot commands / keyboards / callbacks | `docs/architecture.md` |
| Inbox / sealed tickets | `docs/sealed-ticketing.md` |
| Conversation profile + suggestions (V2) | `docs/conversation-suggestions.md` |
| Platform stats engine | `docs/architecture.md` |
| Persian voice | `CONTRIBUTING.md` |

### Persian product terminology (user-facing)

Prefer: پیام ناشناس، پاسخ ناشناس، صندوق پیام‌ها، نام خصوصی، ارزیابی سبک گفت‌وگو، پیشنهاد گفت‌وگو، گزینه‌ی گفت‌وگو، درخواست گفت‌وگو، پیام شروع گفت‌وگو، نمایش در پیشنهادها، توقف دریافت پیام، فعال‌سازی دریافت پیام، پاک کردن حساب، مرزهای حریم خصوصی، رمزنگاری در حالت سکون.

Do not use in positive copy: مچ، مچ‌یابی، درصد سازگاری، تست شخصیت، دوستیابی، پیام‌رسان امن، ناشناس کامل، رمزنگاری سرتاسری (except explicit negative disclaimers).

## Agent Operating Mode

### Before editing

- Inspect existing files and local patterns with `rg` / `rg --files`.
- Identify the smallest safe change set.
- Prefer editing existing files over creating new ones.
- Preserve user work and unrelated files.
- Do not invent APIs, folder paths, env names, KV key shapes, or Telegram handler names. Inspect first.

### While editing

- Make focused changes.
- Keep webhook and hot paths lean.
- Avoid broad rewrites unless explicitly requested.
- Do not add dependencies without approval.
- Do not run deploy, destructive KV clears, long-running dev, or build commands unless explicitly requested.

### After editing, report

- files changed
- files created
- commands run
- checks passed/failed
- assumptions
- follow-up needed

Keep reports short and practical.

## Current Project Identity

Nekonymous is a Persian-first anonymous Telegram bot: personal deep-link messaging, conversation-style **assessment** (ارزیابی), and opt-in **conversation suggestions** (پیشنهاد گفت‌وگو). Hosted relay with encryption at rest — **not** E2EE.

Users share a personal link slug; others message them without revealing identity. Replies stay anonymous in both directions.

The product should feel:

- minimal
- privacy-first
- calm
- honest
- Persian-first in user-facing copy
- not SaaS-hype
- not over-architected

Public brand: **Nekonymous** / **نِکونیموس** (`package.json` name: `nekonymous`).

**V2 rules:**

- No KV inbox/conversation storage. Do not add dual-read, dual-write, or migration fallbacks.
- No soft-deleted user rows for account reset — use hard delete (`hardDeleteUserAccount`).
- Profile schema version is **`v2`** only (`CONVERSATION_PROFILE_VERSION` in `conversation/profile/constants.ts`).
- User-facing copy says **ارزیابی**, not تست. Command is `/assessment` only (no `/test`).
- No D1 profile, answer, or pair-graph rows. No Workers AI in suggestion path.
- Raw questionnaire answers deleted after successful profile finalization.

## Current Stack

- **Cloudflare Workers** — single Worker entry (`src/index.ts`) + queue consumer
- **Grammy** — Telegram bot framework (`grammy`)
- **Cloudflare D1** — users, links, aggregate stats tables only (no profile or pair graph)
- **Cloudflare KV** — routing/cache only (`tg:{hash}`, `link:{slug}`)
- **Cloudflare Durable Objects (SQLite)** — `UserStateDurableObject`, `ProfileVaultShardDurableObject`, `ConversationVaultShardDurableObject`, `PairLedgerShardDurableObject`, `TicketVaultDurableObject`, `ReportLedgerDurableObject`, `TelegramOutboxDurableObject`
- **Cloudflare Queues** — `neko-outbox`, `neko-stats`, `neko-profile-index` (+ DLQ)
- **Web Crypto API** — HMAC, HKDF-SHA-256, AES-256-GCM (`src/features/ticketing/ticketing-service.ts`)
- **Vectorize** — 8-d coarse vectors for retrieval only (`env.CONVERSATION_VECTORS`); no Workers AI
- **Wrangler 4** — dev and deploy (`wrangler.jsonc`)
- **pnpm** — package manager

There is no Nuxt, GraphQL, separate `workers/` package, public website SPA, or payment/top-up flow in V1. `site/index.html` is a static landing/docs pointer only.

## Main Folder Model

```
src/
├── index.ts                         # DO exports, fetch, queue
├── status.ts                        # domain status unions
├── types.ts                         # Environment, BotUser, shared payloads
├── bot/                             # Telegram webhook, grammY wiring, menus, callbacks
│   ├── webhook.ts
│   ├── create-bot.ts
│   ├── register-handlers.ts
│   ├── callback-data.ts
│   ├── sender.ts
│   └── commands.ts, menu.ts, keyboards.ts, user-rate-limit.ts
├── features/
│   ├── identity/                    # users, links, KV cache, hard delete, recreate
│   ├── ticketing/                   # sealed-ticket protocol and anonymous inbox
│   ├── conversation/
│   │   ├── profile/                 # 25-question / 8-dimension flow (v2)
│   │   └── suggestions/             # retrieval, ranking, suggestions, requests
│   ├── settings/
│   └── moderation/
├── storage/                         # Durable Objects, storage clients, sharding
├── queues/                          # Telegram outbox and background consumers
├── stats/                           # event emission, queue consumer, readers
├── i18n/                            # Persian-first visible copy
└── utils/                           # logs.ts, text.ts, timing-safe-equal.ts only

docs/
├── README.md
├── architecture.md
├── sealed-ticketing.md
├── conversation-suggestions.md
├── threat-model.md
├── development.md

LICENSE
SECURITY.md
CONTRIBUTING.md
```

Do not create alternative roots unless the project already uses them.

`wrangler.jsonc` is committed with binding IDs. `.dev.vars` is gitignored. Secrets are set via `wrangler secret put` in production.

GitHub Actions (`.github/workflows/`) run checks on pull requests, `master` pushes, and manually (`workflow_dispatch`). Deploy with `pnpm deploy` unless explicitly running a workflow.

## Worker Entry and Routes

`src/index.ts` is the only Worker entry. It exports DO classes and delegates HTTP/queue handling.

| Method | Path  | Purpose                                       |
|--------|-------|-----------------------------------------------|
| POST   | `/bot` | Telegram webhook (`webhookCallback` + secret) |
| queue  | `neko-outbox` | Outbound Telegram job consumer        |
| queue  | `neko-stats` | Aggregate stats events into D1        |
| queue  | `neko-profile-index` | Profile vector upsert/delete/verify |

Export `UserStateDurableObjectV3`, `ProfileVaultShardDurableObjectV3`, `ConversationVaultShardDurableObjectV3`, `PairLedgerShardDurableObjectV3`, `TicketVaultDurableObjectV3`, `ReportLedgerDurableObjectV3`, and `TelegramOutboxDurableObjectV3` from `src/index.ts` for Wrangler DO bindings.

Webhook handling lives in `src/bot/webhook.ts`. Do not add a generic router or second HTTP framework.

## Bot Architecture Rules

### Wiring

- `createBot(env)` in `src/bot/create-bot.ts` constructs the Grammy bot.
- `registerHandlers(bot, env)` in `src/bot/register-handlers.ts` wires commands and callbacks.
- Pass `env: Environment` into handlers — do not read untyped globals.
- Add new commands/callbacks in `register-handlers.ts`; implement logic in the matching `features/*` handler file.
- Keep raw `UserStateDO` / `TicketVaultDO` / `ReportLedgerDO` / `TelegramOutboxDO` fetch calls inside `src/storage/*-client.ts` — not scattered in handlers.

### Commands and flows

| Surface              | Handler location                          |
|----------------------|-------------------------------------------|
| `/start`             | `features/ticketing/handlers.ts` |
| `/inbox`             | `features/ticketing/handlers.ts` |
| incoming messages    | `features/ticketing/handlers.ts` |
| reply/block/unblock/nickname/report | `features/ticketing/actions.ts` |
| reply keyboard menu  | `bot/menu.ts`, `bot/keyboards.ts`         |
| `/settings`          | `features/settings/settings-handlers.ts`  |
| `/assessment`        | `features/conversation/profile/profile-handlers.ts` |
| `/match`             | `features/conversation/suggestions/*` (hub handlers) |

Callback prefixes (keep short; capability suffix is base64url, under Telegram 64-byte limit):

- `o:`, `r:`, `b:`, `u:`, `n:`, `rp:` — ticket open/actions
- `ib:` — inbox menu / pagination
- `t:` — conversation profile questionnaire flow
- `m:` — suggestion hub navigation (search, pending, profile, discoverability)
- `s:` — suggestion ticket actions (`s:{suggestionRef}`)
- `q:` — request ticket actions (`q:{requestRef}`)
- `st:` — settings inline actions (migrated from V1 `s:`)

Unknown callbacks are answered by one generic catch-all (`EXPIRED_CALLBACK_MESSAGE`). Do not add legacy alias handlers.

Core user flow:

1. `/start` without payload → resolve/create D1 user + public link, show personal `t.me/...?start={slug}` link.
2. `/start {slug}` → open compose draft to link owner (rate-limited, block-checked, pause-checked, no self-message).
3. Sender sends message/media → seal ticket in `TicketVaultDO`, add blind slot in recipient `UserStateDO`, emit stats event, notify recipient via encrypted capability outbox job.
4. `o:{TicketCapability}` → derive ticket hash from lookup nonce, verify actor/account owner proof, decrypt with key seed, deliver to Telegram, clear `payload_enc`, delete blind slot, keep `route_enc` for actions.
5. `/inbox` → render the unread inbox control card and claim undelivered items.
6. Inline **پاسخ دادن** / **مسدود کردن** / **رفع مسدودی** / **نام خصوصی** / **گزارش کردن** → reply draft, block list, nickname, or report flow. Callback data holds short refs/capabilities (`r:`, `b:`, `u:`, `n:`, `rp:` + base64url); never trust callback data alone — load ticket from vault and verify ownership.

### Account reset (پاک کردن حساب)

`clearUserAccountAndRecreate` in `identity-service.ts`:

1. `purgeUserState` — wipe recipient DO (inbox, drafts, blocks, assessment session, …)
2. `hardDeleteUserAccount` — delete all D1 rows for user, Vectorize vector, KV routing keys
3. `createUserFromTelegram` — brand-new internal user id + new public link

No soft-delete. `telegram_user_hash` UNIQUE is freed by hard delete.
Ticket access is revoked immediately because the owner proof includes the old internal account id; old encrypted ticket records physically expire through the bounded ticket lifecycle. Do not add a replacement user-to-ticketHash registry for reset.

Anonymous aggregate counters are **not** decremented on delete.

### Telegram copy

- Shared bot strings: `src/i18n/messages.ts`, `src/i18n/labels.ts`.
- Settings copy: `src/i18n/settings.ts`.
- Matching copy: `src/i18n/matching.ts`.
- Conversation profile UI copy: `src/i18n/conversation-profile-ui.ts`.
- Keep Persian tone consistent with existing messages.
- Use `escapeMarkdownV2` when `parse_mode: "MarkdownV2"` is set.
- Use `convertToPersianNumbers` for counts shown to users.

Do not hardcode new English bot strings unless the task explicitly asks for localization work.

## Message and Crypto Rules

Read `docs/sealed-ticketing.md` and `src/features/ticketing/create-sealed-ticket.ts` before changing storage or inbox behavior.

| Concept                 | Role                                                                 |
|-------------------------|----------------------------------------------------------------------|
| `TicketCapability`      | 43-character unpadded base64url capability with 16-byte lookup nonce + 16-byte key seed |
| `ticketHash`            | Stable blind vault lookup hash derived from lookup nonce              |
| `capability` / callback ref | Short base64url token in Telegram buttons only (`o:`, `r:`, `b:`, `u:`, `n:`, `rp:`) |
| `route_enc`             | Encrypted route capsule in TicketVault (reply/block/report/nickname) |
| `payload_enc`           | Encrypted message payload in TicketVault; cleared after successful Telegram delivery |
| `APP_MASTER_KEY`        | Encryption IKM for sealed tickets and sensitive fields               |
| `APP_HMAC_PEPPER`       | HMAC key for `telegram_user_hash` — never store raw Telegram ids in D1 |

Flow:

1. `createSealedTicket` creates a ticket capability and encrypts route + payload capsules for `TicketVaultDO`.
2. Recipient `UserStateDO` stores an `unread_inbox_items` row with only authenticated ciphertext capability material.
3. `/inbox` or inbox controls claim unread rows, decrypt the capability in memory, deliver through `TelegramOutboxDO`, clear `payload_enc`, and delete the unread row after successful Telegram delivery.
4. Delivered message action callbacks resolve tickets via capability + vault record; verify recipient ownership and block state before actions.
5. Reports go to `ReportLedgerDO` with blind tags — no plaintext peer graph in D1.

Ciphertext envelope: JSON `{ v: 1, kid, iv, ct }` with 12-byte GCM IV.

Rules:

- Never log `ticketId`, `APP_MASTER_KEY`, `APP_HMAC_PEPPER`, decrypted payloads, or Telegram tokens.
- Never store raw callback capabilities.
- Never store plaintext message bodies in D1, KV, or DO storage.
- Use Web Crypto only — no Node `crypto`, no third-party crypto libraries.
- Blocks, labels, drafts, and rate limits live in `UserStateDO` — not D1 or KV.

## D1 Rules

D1 (`env.DB`, database `nekonymous_core`) is source of truth for:

- `users`, `public_links`
- `platform_daily_stats`, `platform_daily_stats_by_key`, `platform_daily_unique_stats` (event-driven via `neko-stats`)

**Forbidden in D1:** `assessment_profiles`, `assessment_answers`, `match_requests`, `requester_user_id`, `candidate_user_id`, `profile_summary_text`, `dimension_scores_json`, or any pair/profile graph.

Apply migrations:

```bash
pnpm db:migrations:apply:local
pnpm db:migrations:apply:remote
```

Prefer:

- bounded queries with indexes
- `features/identity/identity-service.ts` for users/links/delete
- `src/stats/stats-reader.ts` (`getPublicBotStats`) for public aggregate stats display
- increment anonymous stats via `record*()` in `src/stats/product-events.ts` on accepted sends — no message body or sender-recipient edge in D1

Avoid:

- storing plaintext message bodies or decrypted nicknames in D1
- storing hot inbox payloads, drafts, blocks, or labels in D1
- full-table scans in webhook paths
- soft-deleting users (`status = 'deleted'`) — hard delete instead

## KV Rules

`env.NEKO_KV` is **routing/cache only**. Routing access lives in `features/identity/identity-service.ts`; public aggregate stats may use short-lived `cache:*` keys in `src/stats/`.

| Key pattern         | Value   | Purpose                  |
|---------------------|---------|--------------------------|
| `tg:{telegramHash}` | user id | Telegram hash → user id |
| `link:{slug}`       | user id | Public slug → user id   |
| `cache:public-bot-stats:v1:{day}` | aggregate JSON | 60s public stats cache |

Prefer:

- D1 as source of truth; KV as optional acceleration
- delete stale cache keys when D1 lookup misses or on hard delete
- direct `env.NEKO_KV.put/get/delete` in identity/stats services — no `KVModel` wrapper

Avoid:

- forbidden key shapes: `user:`, `conversation:`, `userUUIDtoId:`, `stats:`
- storing ciphertext, profiles, blocks, inbox data, per-user stats, or plaintext identifiers in KV
- unbounded `list()` in request paths

KV is eventually consistent. Do not use it for inbox ordering — `UserStateDO` is the inbox authority.

## Durable Object Rules

### UserStateDurableObject

One DO per internal user id (`idFromName(userId)`). Authority for:

- pause, display name ciphertext, drafts, inbox **pointers**
- blocks, contact labels, rate limits
- profile questionnaire session (encrypted answers until finalization)
- discoverability preference, exposure tokens, search/request rate budgets

All UserStateDO calls go through `src/storage/user-state-client.ts`. Vault shard calls go through `src/storage/profile-vault/`, `conversation-vault/`, `pair-ledger/` RPC clients only.

Key UserState endpoints include: `/init`, `/state`, `/set-draft`, `/add-pointer`, `/pending-inbox`, `/mark-delivered`, `/pointer/:hash`, `/add-block`, `/remove-block`, `/set-label`, `/check-can-receive`, `/consume-rate-limit`, `/purge`, profile session routes under `/profile/*`.

Inbox cap: bounded active pointers per user DO (see `user-state-do.ts`).

### TelegramOutboxDurableObject

One DO per `chatHash` (`idFromName(chatHash)`). Idempotent outbound Telegram sends.

Queue consumer (`src/queues/outbox-consumer.ts` and `src/stats/stats-consumer.ts`) dispatches jobs via storage clients.

Prefer:

- direct replies for immediate command responses in webhook
- outbox queue for recipient notifications and seen messages
- idempotency keys on outbox jobs — duplicates must not double-send

Avoid:

- storing plaintext secrets in outbox DO logs
- unbounded inbox or outbox table growth without caps/eviction

## Conversation profile and suggestions (V2)

Read `docs/conversation-suggestions.md` — canonical contracts.

### Conversation profile

- **25 questions**, **8 dimensions**, version **`v2`**
- Active session in `UserStateDO` (encrypted); finalized profile in `ProfileVaultShardDO`
- Dual independent Vectorize IDs (self + desired); index via `neko-profile-index` queue
- Discoverability off by default; active only after both vectors verified
- Raw answers **deleted** after successful finalization

### Conversation suggestions

1. Dual Vectorize retrieval (self ↔ desired namespaces), topK bounded
2. Batch vault resolve → reciprocal deterministic ranking (no Vectorize score in final rank)
3. Hard filters (PairLedger, blocks, cooldowns, rate limits) override rank
4. Suggestion capability → request capability → accept creates normal sealed inbox ticket

No D1 candidate fallback. No Workers AI. User-facing copy says **پیشنهاد گفت‌وگو**, not مچ‌یابی. No compatibility percentages.

## Cloudflare Worker Performance Rules

Treat every webhook request as an edge hot path.

Prefer:

- fewer imports in `index.ts` and `create-bot.ts`
- simple functions over classes (except required DO classes)
- direct validation and service calls
- bounded loops
- `async` I/O over CPU-heavy transforms
- clearing message payloads from DO after delivery

Avoid:

- CPU-heavy loops in handlers
- unbounded JSON parsing or serialization
- full KV/D1 namespace scans in request paths
- `JSON.parse(JSON.stringify(...))` cloning
- module-level mutable request state
- Node-only libraries
- large dependencies for trivial utilities

When work is not required for the Telegram response:

- prefer `ctx.waitUntil` only if adding durable side effects that must not block the webhook ACK
- do not hide required work in floating promises

## Request Scope and Global State

Cloudflare isolates can be reused across requests.

Allowed at module scope:

- constants
- pure config maps
- compiled regex constants
- immutable helper data
- immutable route constants in `src/bot/webhook.ts`

Forbidden at module scope:

- current Telegram user
- request object
- auth token or ticket material
- per-request KV/DO/D1 results
- mutable arrays/maps storing request data

Pass request state through handler arguments and local variables.

## Promise Rules

Every promise must be one of:

- awaited
- returned
- intentionally passed to `ctx.waitUntil` when appropriate

No floating promises.

Grammy handlers should `await` Telegram API calls and storage operations before exiting, unless the existing file already returns a promise chain intentionally.

## Runtime Env Rules

Bindings and secrets are defined on `Environment` in `src/types.ts`:

```ts
SECRET_TELEGRAM_API_TOKEN
BOT_SECRET_KEY
APP_MASTER_KEY
APP_HMAC_PEPPER

NEKO_KV
DB

USER_STATE_DO
PROFILE_VAULT_DO
CONVERSATION_VAULT_DO
PAIR_LEDGER_DO
TICKET_VAULT
REPORT_LEDGER
TELEGRAM_OUTBOX_DO

NEKO_OUTBOX_QUEUE
NEKO_STATS_QUEUE
NEKO_PROFILE_INDEX_QUEUE

CONVERSATION_VECTORS

BOT_INFO
BOT_NAME
BOT_USERNAME
```

Rules:

- read bindings from the `env` argument passed into handlers
- extend `Environment` when adding a new binding — do not use untyped `env.FOO` elsewhere
- never expose secrets in Telegram messages
- webhook route must keep `secretToken: env.BOT_SECRET_KEY` validation

Do not rely on `process.env` in Worker runtime code.

Local secrets live in `.dev.vars` (Wrangler). Copy from `.env.example` — never commit filled `.dev.vars`.

Production secrets:

```bash
wrangler secret put SECRET_TELEGRAM_API_TOKEN
wrangler secret put BOT_SECRET_KEY
wrangler secret put APP_MASTER_KEY
wrangler secret put APP_HMAC_PEPPER
wrangler secret put BOT_INFO
wrangler secret put BOT_NAME
wrangler secret put BOT_USERNAME
```

## Auth and Security Rules

Webhook auth:

- POST `/bot` must remain protected by Telegram `secretToken` (`BOT_SECRET_KEY`).
- Reject or do not add routes that expose bot control without equivalent validation.

Privacy:

- anonymity depends on not leaking Telegram IDs in public surfaces
- do not add logging of message content, user IDs, or ticket ids
- error replies to users should stay generic (`HuhMessage`) — avoid echoing `JSON.stringify(error)` in new code
- read `docs/threat-model.md` before changing storage, matching metadata, or public security claims

Rate limiting:

- `UserStateDO` enforces a **1-second** global per-user action throttle via atomic `POST /consume-rate-limit` (Grammy middleware in `src/bot/user-rate-limit.ts`)
- preserve the global action throttle unless explicitly changing product rules

Blocking:

- server-side block checks must run before accepting new messages and replies
- blocking uses `blocks` table in recipient `UserStateDO`

## Validation and Input Rules

Validate at the boundary:

- Telegram update context (`ctx.from`, `ctx.match`, message payload type)
- deep-link slug on `/start` (`isPublicSlug` / `isUserLinkId`)
- callback query inbox capabilities (`r:`, `b:`, `u:`, `n:`, `rp:` + base64url token)
- HTTP route params sanitized by `router.ts`

Prefer small explicit checks in the handler. Do not add a validation framework.

Public stats use `getPublicBotStats` (anonymous aggregate counters from `platform_daily_stats`). Do not replace with unbounded full-table scans as data grows.

Return practical user-safe Persian errors. Keep internal details out of Telegram replies.

## TypeScript Rules

Prefer strict, boring TypeScript.

- keep `Environment`, `BotUser`, `D1User`, `MessagePayload`, `ConnectionMetadata`, `InboxTicket` in `src/types.ts`
- `Conversation` in `types.ts` is a delivery view for `sender.ts` (Telegram chat ids) — not the storage model
- avoid `any`; use `unknown` then narrow
- do not introduce global type hacks
- match existing Grammy `Context` handler signatures

## Dependencies Rules

Do not add production dependencies unless explicitly approved.

Current approved runtime deps: `grammy`, `@cloudflare/workers-types`.

## Commands

Preferred inspection:

```bash
rg "pattern"
rg --files
```

Targeted checks when useful:

```bash
pnpm typecheck
pnpm lint
pnpm knip
pnpm check
pnpm audit:d1
```

`pnpm check` runs typecheck, lint, knip, all `test:*` verify scripts, and `audit:ticket-storage`.

Only run when explicitly requested or clearly required:

```bash
pnpm dev
pnpm deploy
wrangler d1 migrations apply DB --remote
./tools/flush-remote.sh          # destructive: D1 + KV + Vectorize reset
```

Never run destructive KV clears, deploy, or production Wrangler commands without explicit confirmation.

## Git Safety

- Inspect before editing.
- Preserve unrelated changes.
- Do not remove files unless directly required.
- Default branch is `master`.
- Do not re-enable push-triggered GitHub Actions unless explicitly requested.

### Commit messages (strict)

Every commit **must** use [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): imperative description
```

Rules:

- **type** — required, lowercase. Use: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.
- **scope** — required, lowercase area name. Examples: `bot`, `messaging`, `matching`, `assessment`, `storage`, `identity`, `settings`, `ticketing`, `tooling`, `docs`, `ci`, `deps`.
- **description** — required, imperative mood, concise, no trailing period. Example: `add global user-action rate limit`, not `added` or `Adds …`.
- **body** — optional; wrap at ~72 chars when extra context is needed.
- **breaking changes** — suffix subject with `!` or add a `BREAKING CHANGE:` footer.

Examples:

```text
feat(bot): add global user-action rate limit middleware
fix(storage): clear payload ciphertext after inbox delivery
docs(readme): document rate limits and quotas
chore(tooling): update telegram bot profile script
```

Do not use free-form subjects (`Update stuff`, `WIP`, `fixes`) unless the user explicitly requests otherwise.

## Server Code Review Checklist

Before finalizing a Worker/bot change, verify:

- Does this run on Cloudflare Workers without Node-only runtime assumptions?
- Are bindings read from the typed `env` / handler args?
- Are all promises awaited, returned, or passed to `waitUntil`?
- Is request-scoped state local, not global?
- Are D1 queries bounded by purpose and indexes?
- Are inbox operations going through `user-state-client.ts`?
- Are messages encrypted at rest and payloads cleared after delivery?
- Are block checks and rate limits enforced server-side via UserStateDO?
- Does account reset hard-delete user data (not soft-delete)?
- Are webhook secrets and crypto material never logged?
- Did this avoid unnecessary dependencies and abstraction layers?
- Did this avoid forbidden `user:`, `conversation:`, `userUUIDtoId:`, or `stats:` KV keys?
