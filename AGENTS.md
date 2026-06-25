# AGENTS.md

## Prime Directive

Nekonymous runs as a **single Cloudflare Worker** with a **Telegram webhook only** (no public HTML site in V1). Server code must be small, edge-safe, low-CPU, and predictable.

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
- `UserStateDO` stores encrypted ticket payloads and encrypted route envelopes, keyed by lookup hashes.
- Anonymous messaging must not write a plain sender-recipient graph or message transcript to D1.
- Keep the existing compact repository layout; do not create a parallel `core/` tree.
- No KV inbox/conversation storage and no dual-read or migration fallbacks for removed storage paths.
- Reports, labels, blocks, and pending actions use hashes/tags/encrypted context — not plaintext anonymous peer edges.
- Do not claim E2EE, zero-knowledge delivery, perfect anonymity, or clinical/dating compatibility in code or copy.

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

Nekonymous is a Persian-first anonymous Telegram bot: personal deep-link messaging, conversation-style **assessment** (ارزیابی), and opt-in **matching**. Hosted relay with encryption at rest — **not** E2EE.

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

**V1 rules:**

- No KV inbox/conversation storage. Do not add dual-read, dual-write, or migration fallbacks.
- No soft-deleted user rows for account reset — use hard delete (`hardDeleteUserAccount`).
- Assessment schema version is **`v1`** only (`ASSESSMENT_VERSION` in `question-bank.ts`).
- User-facing copy says **ارزیابی**, not تست. Command is `/assessment` only (no `/test`).

## Current Stack

- **Cloudflare Workers** — single Worker entry (`src/index.ts`) + queue consumer
- **Grammy** — Telegram bot framework (`grammy`)
- **Cloudflare D1** — users, links, reports, assessment, matching, anonymous `platform_stats`
- **Cloudflare KV** — routing/cache only (`tg:{hash}`, `link:{slug}`)
- **Cloudflare Durable Objects (SQLite)** — `UserStateDurableObject`, `TelegramOutboxDurableObject`
- **Cloudflare Queues** — `telegram-outbox` for non-critical outbound Telegram sends
- **Web Crypto API** — HMAC, HKDF-SHA-256, AES-256-GCM (`src/ticketing/ticketing-service.ts`)
- **Workers AI + Vectorize** — profile embeddings for assessment/matching (`env.AI`, `env.PROFILE_VECTORS`)
- **Wrangler 4** — dev and deploy (`wrangler.jsonc`)
- **pnpm** — package manager

There is no Nuxt, GraphQL, separate `workers/` package, public website, or frontend SPA.

## Main Folder Model

```
src/
├── index.ts                         # DO exports, fetch, queue
├── types.ts                         # Environment, BotUser, D1User, ticket types
├── bot/
│   ├── create-bot.ts
│   ├── register-handlers.ts         # command/callback wiring
│   ├── router.ts                    # POST /bot webhook only
│   ├── menu.ts
│   ├── menu-labels.ts
│   └── keyboards.ts
├── features/
│   ├── identity/
│   │   └── identity-service.ts      # users, links, KV cache, hard delete, recreate
│   ├── messaging/
│   │   ├── messaging-service.ts
│   │   ├── messaging-commands.ts    # /start, /inbox
│   │   ├── messaging-actions.ts     # reply, block, nickname, report
│   │   ├── payload-service.ts
│   │   └── report-service.ts
│   ├── settings/
│   │   ├── settings-handlers.ts
│   │   └── settings-copy.ts
│   ├── assessment/                  # 56-question / 14-dimension flow (v1)
│   │   ├── assessment-handlers.ts
│   │   ├── assessment-flow-service.ts
│   │   ├── assessment-profile-service.ts
│   │   ├── assessment-scores.ts
│   │   ├── profile-vector-service.ts
│   │   ├── question-bank.ts, scoring.ts, keyboards.ts, …
│   ├── matching/
│   │   ├── match-handlers.ts, match-system-handlers.ts
│   │   ├── match-service.ts, match-request-service.ts
│   │   ├── match-vector-service.ts, match-selection.ts, match-scoring.ts, …
│   └── platform/
│       └── platform-stats-service.ts  # anonymous lifetime counters
├── ticketing/
│   └── ticketing-service.ts
├── storage/
│   ├── user-state-do.ts
│   ├── user-state-client.ts         # only place for UserStateDO fetch calls
│   ├── telegram-outbox-do.ts
│   └── telegram-outbox-client.ts
├── queues/
│   ├── telegram-outbox.types.ts
│   └── telegram-outbox.consumer.ts
├── i18n/
│   └── messages.ts
└── utils/
    ├── router.ts, sender.ts, tools.ts, user.ts, contact.ts, …
    └── logs.ts                        # logBotError only

migrations/
└── 0001_init.sql                      # squashed V1 schema + platform_stats

tools/
├── verify-ticketing.ts                # pnpm test:ticketing
├── verify-assessment.ts               # pnpm test:assessment
├── verify-matching.ts                 # pnpm test:matching
├── audit-d1.sh / audit-d1.sql         # pnpm audit:d1
├── sync-d1-migration-history.sql      # squash d1_migrations after migration file changes
├── flush-remote-d1.sql
├── flush-remote.sh
└── reset-assessment-data.sql

docs/
├── architecture/matching-v1.md
└── security/threat-model.md
```

Do not create alternative roots unless the project already uses them.

`wrangler.jsonc` is committed with binding IDs. `.dev.vars` is gitignored. Secrets are set via `wrangler secret put` in production.

GitHub Actions (`.github/workflows/`) are **manual only** (`workflow_dispatch`). Deploy with `pnpm deploy` unless explicitly running a workflow.

## Worker Entry and Routes

`src/index.ts` is the only Worker entry. It exports DO classes and delegates HTTP/queue handling.

| Method | Path  | Purpose                                       |
|--------|-------|-----------------------------------------------|
| POST   | `/bot` | Telegram webhook (`webhookCallback` + secret) |
| queue  | `telegram-outbox` | Outbound Telegram job consumer        |

Route registration lives in `src/bot/router.ts`. Use `src/utils/router.ts` (`Router` class) for new HTTP routes. Do not add a second router or framework.

Export `UserStateDurableObject` and `TelegramOutboxDurableObject` from `src/index.ts` for Wrangler DO bindings.

## Bot Architecture Rules

### Wiring

- `createBot(env)` in `src/bot/create-bot.ts` constructs the Grammy bot.
- `registerHandlers(bot, env)` in `src/bot/register-handlers.ts` wires commands and callbacks.
- Pass `env: Environment` into handlers — do not read untyped globals.
- Add new commands/callbacks in `register-handlers.ts`; implement logic in the matching `features/*` handler file.
- Keep raw `UserStateDO` / `TelegramOutboxDO` fetch calls inside `src/storage/*-client.ts` — not scattered in handlers.

### Commands and flows

| Surface              | Handler location                          |
|----------------------|-------------------------------------------|
| `/start`             | `features/messaging/messaging-commands.ts` |
| `/inbox`             | `features/messaging/messaging-commands.ts` |
| incoming messages    | `features/messaging/messaging-commands.ts` |
| reply/block/unblock/nickname/report | `features/messaging/messaging-actions.ts` |
| reply keyboard menu  | `bot/menu.ts`, `bot/keyboards.ts`         |
| `/settings`          | `features/settings/settings-handlers.ts`  |
| `/assessment`        | `features/assessment/assessment-handlers.ts` |
| `/match`             | `features/matching/match-handlers.ts`     |
| `/match_system`      | `features/matching/match-system-handlers.ts` |

Callback prefixes (keep short; capability suffix is base64url, under Telegram 64-byte limit):

- `o:`, `r:`, `b:`, `u:`, `n:`, `rp:` — inbox actions (capability token)
- `t:` — assessment flow
- `m:` — matching
- `ms:` — match-system hub

Core user flow:

1. `/start` without payload → resolve/create D1 user + public link, show personal `t.me/...?start={slug}` link.
2. `/start {slug}` → open compose draft to link owner (rate-limited, block-checked, pause-checked, no self-message).
3. Sender sends message/media → encrypt payload + connection metadata, insert inbox ticket in recipient `UserStateDO`, increment `platform_stats.messages_relayed`, notify recipient via outbox queue.
4. `/inbox` → load pending tickets from recipient `UserStateDO`, decrypt, deliver to Telegram, clear `payload_ciphertext`, keep `connection_ciphertext` for callbacks.
5. Inline **پاسخ** / **مسدود** / **رفع مسدودیت** / **نام خصوصی** → reply draft, block list, or nickname flow. Callback data holds capabilities; never trust callback data alone — load ticket from DO and verify ownership.

### Account reset (پاک کردن حساب)

`clearUserAccountAndRecreate` in `identity-service.ts`:

1. `purgeUserState` — wipe recipient DO (inbox, drafts, blocks, assessment session, …)
2. `hardDeleteUserAccount` — delete all D1 rows for user, Vectorize vector, KV routing keys
3. `createUserFromTelegram` — brand-new internal user id + new public link

No soft-delete. `telegram_user_hash` UNIQUE is freed by hard delete.

Anonymous lifetime counters in `platform_stats` are **not** decremented on delete.

### Telegram copy

- Shared bot strings: `src/i18n/messages.ts`.
- Settings-specific copy: `src/features/settings/settings-copy.ts`.
- Feature-specific copy: `features/matching/match-copy.ts`, assessment keyboards, etc.
- Keep Persian tone consistent with existing messages.
- Use `escapeMarkdownV2` when `parse_mode: "MarkdownV2"` is set.
- Use `convertToPersianNumbers` for counts shown to users.

Do not hardcode new English bot strings unless the task explicitly asks for localization work.

## Message and Crypto Rules

Read `src/ticketing/ticketing-service.ts` before changing storage or inbox behavior.

| Concept                 | Role                                                                 |
|-------------------------|----------------------------------------------------------------------|
| `ticketId`              | 256-bit random opaque handle (base64url) per message                 |
| `capability`            | 24-byte base64url token held only in Telegram callback buttons       |
| `ref`                   | stored lookup hash for a capability, not a raw callback token        |
| `conversationId`        | ticket-local compatibility field; do not use for anonymous D1 routing |
| `APP_MASTER_KEY`        | Encryption IKM for payloads, chat ids, nicknames                     |
| `APP_HMAC_PEPPER`       | HMAC key for `telegram_user_hash` — never store raw Telegram ids in D1 |

Flow:

1. `generateTicketId()` + `randomCapability()` on send.
2. Encrypt `MessagePayload` and `ConnectionMetadata` with ticket-derived AES keys.
3. Store ticket in recipient `UserStateDO.inbox_tickets` under capability lookup hash — not in KV or D1 plaintext.
4. On open or `/inbox`, decrypt payload from DO, send via `sendDecryptedMessage`, enqueue seen notification, rotate to an action capability lookup hash, mark delivered, set `payload_ciphertext = NULL`.
5. Callbacks load ticket by capability-derived lookup hash from recipient DO, decrypt `connection_ciphertext`, verify user role.

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
- `reports`
- `assessment_profiles`, `assessment_attempts`, `assessment_answers`
- `profile_vector_index_events`
- `match_suggestions`, `match_requests`, `match_blocks`, `match_events`
- `platform_stats` (single row, no user ids — lifetime anonymous counters)

Apply migrations:

```bash
pnpm db:migrations:apply:local
pnpm db:migrations:apply:remote
```

Prefer:

- bounded queries with indexes
- `features/identity/identity-service.ts` for users/links/delete
- `features/assessment/assessment-profile-service.ts` for assessment D1
- `features/platform/platform-stats-service.ts` for public aggregate stats
- increment anonymous `platform_stats` on accepted sends — no message body or sender-recipient edge in D1

Avoid:

- storing plaintext message bodies or decrypted nicknames in D1
- storing hot inbox payloads, drafts, blocks, or labels in D1
- full-table scans in webhook paths
- soft-deleting users (`status = 'deleted'`) — hard delete instead

## KV Rules

`env.NEKO_KV` is **routing/cache only**. Access via `features/identity/identity-service.ts`.

| Key pattern         | Value   | Purpose                  |
|---------------------|---------|--------------------------|
| `tg:{telegramHash}` | user id | Telegram hash → user id |
| `link:{slug}`       | user id | Public slug → user id   |

Prefer:

- D1 as source of truth; KV as optional acceleration
- delete stale cache keys when D1 lookup misses or on hard delete
- direct `env.NEKO_KV.put/get/delete` in identity service — no `KVModel` wrapper

Avoid:

- forbidden key shapes: `user:`, `conversation:`, `userUUIDtoId:`, `stats:`
- storing ciphertext, profiles, blocks, or inbox data in KV
- unbounded `list()` in request paths

KV is eventually consistent. Do not use it for inbox ordering — `UserStateDO` is the inbox authority.

## Durable Object Rules

### UserStateDurableObject

One DO per internal user id (`idFromName(userId)`). Authority for:

- pause, display name ciphertext, drafts, inbox tickets
- blocks, contact labels, rate limits
- assessment session state (`assessment_sessions` table in DO)
- processed events (schema reserved)

All DO calls go through `src/storage/user-state-client.ts` using `https://user-state/...` URLs.

Key endpoints: `/init`, `/state`, `/set-draft`, `/add-ticket`, `/pending-inbox`, `/mark-delivered`, `/ticket/:ref`, `/add-block`, `/remove-block`, `/set-label`, `/check-can-receive`, `/check-rate-limit`, `/purge`, `/assessment/*`.

Inbox cap: 50 tickets per user DO. Pending tickets indexed by `status = 'pending'`.

### TelegramOutboxDurableObject

One DO per `chatHash` (`idFromName(chatHash)`). Idempotent outbound Telegram sends.

Queue consumer (`src/queues/telegram-outbox.consumer.ts`) dispatches jobs via `src/storage/telegram-outbox-client.ts`.

Prefer:

- direct replies for immediate command responses in webhook
- outbox queue for recipient notifications and seen messages
- idempotency keys on outbox jobs — duplicates must not double-send

Avoid:

- storing plaintext secrets in outbox DO logs
- unbounded inbox or outbox table growth without caps/eviction

## Assessment and Matching (V1)

### Assessment

- **56 questions**, **14 dimensions**, version **`v1`**
- Active progress in `UserStateDO.assessment_sessions`
- Completed profile in D1 `assessment_profiles` (`dimension_scores_json`, controlled `profile_summary_text`)
- Vector id: `profile:{userId}:v1`
- Discoverability off by default; user opts in for matching

### Matching

1. Vectorize `topK` with metadata filters (`discoverable`, `matchEligible`, `locale`, `profileVersion`)
2. Merge with bounded recent discoverable D1 profiles when index is sparse (`fetchD1FallbackProfiles`)
3. Deterministic scoring in `match-scoring.ts` (Vectorize narrows; code decides)
4. Match request → candidate accept → normal inbox ticket

Do not add version-specific ranking hacks beyond `ASSESSMENT_VERSION === "v1"`.

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
- `Router` instance and route table in `src/bot/router.ts`

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
TELEGRAM_OUTBOX_DO

TELEGRAM_OUTBOX_QUEUE

AI
PROFILE_VECTORS

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
- read `docs/security/threat-model.md` before changing storage, matching metadata, or public security claims

Rate limiting:

- `UserStateDO` enforces a 5-second window via `/check-rate-limit` and `/touch-rate-limit`
- preserve rate limits on send/reply unless explicitly changing product rules

Blocking:

- server-side block checks must run before accepting new messages and replies
- blocking uses `blocks` table in recipient `UserStateDO`

## Validation and Input Rules

Validate at the boundary:

- Telegram update context (`ctx.from`, `ctx.match`, message payload type)
- deep-link slug on `/start` (`isPublicSlug` / `isUserLinkId`)
- callback query inbox capabilities (`o:`, `r:`, `b:`, `u:`, `n:`, `rp:` + base64url token)
- HTTP route params sanitized by `router.ts`

Prefer small explicit checks in the handler. Do not add a validation framework.

Public stats use `getPlatformStats` (anonymous counters + live active-user count). Do not replace with unbounded full-table scans as data grows.

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

`pnpm check` runs typecheck, lint, knip, `test:ticketing`, `test:assessment`, and `test:matching`.

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
