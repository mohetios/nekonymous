# AGENTS.md

## Prime Directive

Nekonymous runs as a single Cloudflare Worker with a Telegram webhook and lightweight HTML pages. Server code must be small, edge-safe, low-CPU, and predictable.

When changing bot logic, crypto, D1, KV cache, Durable Objects, queues, or Worker routes, optimize for:

- low CPU per request
- few KV / Durable Object / D1 / HTTP subrequests
- small memory footprint
- simple control flow
- explicit validation and auth checks
- minimal files changed
- no accidental architecture growth

Do not generate heavy abstractions, repository layers, generic service frameworks, or framework-inside-framework patterns.

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

Nekonymous is a secure anonymous Telegram messaging bot. Users share a personal link slug; others message them without revealing identity. Replies stay anonymous in both directions.

The product should feel:

- minimal
- privacy-first
- calm
- honest
- Persian-first in user-facing copy
- not SaaS-hype
- not over-architected

Public brand: **Nekonymous** / **نِکونیموس** (`package.json` name: `nekonymous`).

V1 treats old KV user/conversation/inbox storage as disposable. Do not add legacy fallback, dual-read, or dual-write paths.

## Current Stack

- **Cloudflare Workers** — single Worker entry (`src/index.ts`) + queue consumer
- **Grammy** — Telegram bot framework (`grammy`)
- **Cloudflare D1** — users, public links, conversation summaries, reports, consents
- **Cloudflare KV** — routing/cache only (`tg:{hash}`, `link:{slug}`)
- **Cloudflare Durable Objects (SQLite)** — per-user hot state (`UserStateDurableObject`) and idempotent Telegram outbox (`TelegramOutboxDurableObject`)
- **Cloudflare Queues** — `telegram-outbox` for non-critical outbound Telegram sends
- **Web Crypto API** — HMAC, HKDF-SHA-256, AES-256-GCM (`src/services/crypto-service.ts`)
- **Tailwind CSS 2 (CDN)** — static HTML pages only
- **Wrangler 4** — dev and deploy (`wrangler.jsonc`)
- **pnpm** — package manager (lockfile present; CI still uses `npm install`)

There is no Nuxt, GraphQL, separate `workers/` package, or frontend SPA.

## Main Folder Model

```
src/
├── index.ts                    # Worker fetch + queue handler, DO exports
├── types.ts                    # Environment, BotUser, D1User, ticket types
├── bot/
│   ├── bot.ts                  # createBot(), Grammy wiring
│   ├── commands.ts             # /start, /inbox, message routing
│   ├── actions.ts              # inline keyboard: reply, block, unblock, nickname, report
│   └── settings.ts             # /settings, display name, pause, account delete
├── services/
│   ├── identity-service.ts     # D1 users, public links, KV routing cache
│   ├── crypto-service.ts       # HMAC, encrypt/decrypt, ticket/ref generation
│   ├── user-state-service.ts   # UserStateDO client (only place for DO fetch calls)
│   ├── messaging-service.ts    # send/inbox ticket flow, outbox notifications
│   ├── conversation-summary-service.ts
│   ├── report-service.ts
│   └── outbox-service.ts       # enqueue + TelegramOutboxDO dispatch
├── storage/durable/
│   ├── user-state-do.ts        # UserStateDurableObject
│   └── telegram-outbox-do.ts   # TelegramOutboxDurableObject
├── queues/
│   ├── types.ts
│   └── telegram-outbox.consumer.ts
├── front/
│   ├── layout.ts
│   ├── home.ts                 # public stats from D1
│   ├── about.ts
│   └── technical.ts
└── utils/
    ├── router.ts
    ├── sender.ts               # decrypt + forward media to Telegram
    ├── messages.ts
    ├── messages-settings.ts
    ├── constant.ts             # keyboards, callback prefixes
    ├── tools.ts
    ├── user.ts                 # display-name helpers, deep links
    ├── payload.ts              # grammy Message → MessagePayload
    ├── contact.ts
    ├── worker.ts               # defer via waitUntil
    └── logs.ts                 # logBotError only

migrations/
└── 0001_core.sql               # D1 schema

tools/
└── verify-crypto.ts            # crypto smoke tests (pnpm test:crypto)
```

Do not create alternative roots unless the project already uses them.

`wrangler.jsonc` is committed with binding IDs. `.dev.vars` is gitignored. Secrets are set via `wrangler secret put` in production.

## Worker Entry and Routes

`src/index.ts` is the only Worker entry.

| Method | Path               | Purpose                                       |
|--------|--------------------|-----------------------------------------------|
| GET    | `/`                | Public home page with aggregate stats (D1)    |
| GET    | `/about`           | About / privacy page                          |
| GET    | `/about/technical` | Technical architecture page                   |
| POST   | `/bot`             | Telegram webhook (`webhookCallback` + secret) |
| queue  | `telegram-outbox`  | Outbound Telegram job consumer                |

Use `src/utils/router.ts` for new HTTP routes. Do not add a second router or framework.

Export `UserStateDurableObject` and `TelegramOutboxDurableObject` from `src/index.ts` for Wrangler DO bindings.

## Bot Architecture Rules

### Wiring

- `createBot(env)` in `src/bot/bot.ts` constructs the Grammy bot and registers handlers.
- Pass `env: Environment` into command/action handlers — do not read untyped globals.
- Register new commands in `bot.ts`; implement logic in `commands.ts`, `actions.ts`, or `settings.ts`.
- Keep raw `UserStateDO` / `TelegramOutboxDO` fetch calls inside service wrappers — not scattered in handlers.

### Commands and flows

| Surface              | Handler location   |
|----------------------|--------------------|
| `/start`             | `commands.ts`      |
| `/inbox`             | `commands.ts`      |
| incoming messages    | `commands.ts`      |
| reply/block/unblock/nickname/report | `actions.ts` |
| reply keyboard menu  | `constant.ts`      |
| `/settings`          | `settings.ts`      |

Core user flow:

1. `/start` without payload → resolve/create D1 user + public link, show personal `t.me/...?start={slug}` link.
2. `/start {slug}` → open compose draft to link owner (rate-limited, block-checked, pause-checked, no self-message).
3. Sender sends message/media → encrypt payload + connection metadata, insert inbox ticket in recipient `UserStateDO`, upsert D1 conversation summary, notify recipient via outbox queue.
4. `/inbox` → load pending tickets from recipient `UserStateDO`, decrypt, deliver to Telegram, clear `payload_ciphertext`, keep `connection_ciphertext` for callbacks.
5. Inline **پاسخ** / **بلاک** / **آنبلاک** / **نام مستعار** → reply draft, block list, or nickname flow. Callback data uses short refs (`r:`, `b:`, `u:`, `n:`); never trust callback data alone — load ticket from DO and verify ownership.

### Telegram copy

- User-facing bot strings live in `src/utils/messages.ts`.
- Keep Persian tone consistent with existing messages.
- Use `escapeMarkdownV2` when `parse_mode: "MarkdownV2"` is set.
- Use `convertToPersianNumbers` for counts shown to users.

Do not hardcode new English bot strings unless the task explicitly asks for localization work.

## Message and Crypto Rules

Read `src/services/crypto-service.ts` before changing storage or inbox behavior.

| Concept                 | Role                                                                 |
|-------------------------|----------------------------------------------------------------------|
| `ticketId`              | 256-bit random opaque handle (base64url) per message                 |
| `ref`                   | 8-hex callback reference for inline buttons                          |
| `conversationId`        | Stable pair-derived id for D1 summary (not per-ticket KV key)        |
| `APP_MASTER_KEY`        | Encryption IKM for payloads, chat ids, nicknames                     |
| `APP_HMAC_PEPPER`       | HMAC key for `telegram_user_hash` — never store raw Telegram ids in D1 |

Flow:

1. `generateTicketId()` + `generateCallbackRef()` on send.
2. Encrypt `MessagePayload` and `ConnectionMetadata` with ticket-derived AES keys.
3. Store ticket in recipient `UserStateDO.inbox_tickets` — not in KV or D1 plaintext.
4. On `/inbox`, decrypt payload from DO, send via `sendDecryptedMessage`, enqueue seen notification, mark delivered, set `payload_ciphertext = NULL`.
5. Callbacks load ticket by `ref` from recipient DO, decrypt `connection_ciphertext`, verify user role.

Ciphertext envelope: JSON `{ v: 1, kid, iv, ct }` with 12-byte GCM IV.

Rules:

- Never log `ticketId`, `APP_MASTER_KEY`, `APP_HMAC_PEPPER`, decrypted payloads, or Telegram tokens.
- Never store plaintext message bodies in D1, KV, or DO storage.
- Use Web Crypto only — no Node `crypto`, no third-party crypto libraries.
- Blocks, labels, drafts, and rate limits live in `UserStateDO` — not D1 or KV.

## D1 Rules

D1 (`env.DB`, database `nekonymous_core`) is source of truth for:

- users (opaque id, `telegram_user_hash`, encrypted chat id)
- public_links (slug → owner)
- conversations (pair summaries, `message_count`, no plaintext body)
- reports
- consents

Schema: `migrations/0001_core.sql`. Apply with:

```bash
wrangler d1 migrations apply nekonymous_core --local
wrangler d1 migrations apply nekonymous_core --remote
```

Prefer:

- bounded queries with indexes
- `identity-service.ts` and `conversation-summary-service.ts` for D1 access
- upsert conversation summaries on send — no message body in D1

Avoid:

- storing plaintext message bodies or decrypted nicknames in D1
- storing hot inbox payloads, drafts, blocks, or labels in D1
- full-table scans in webhook paths

## KV Rules

`env.NEKO_KV` is **routing/cache only**. Access via `identity-service.ts`.

| Key pattern        | Value   | Purpose                    |
|--------------------|---------|----------------------------|
| `tg:{telegramHash}`| user id | Telegram hash → user id   |
| `link:{slug}`      | user id | Public slug → user id      |

Prefer:

- D1 as source of truth; KV as optional acceleration
- delete stale cache keys when D1 lookup misses
- direct `env.NEKO_KV.put/get/delete` in identity service — no `KVModel` wrapper

Avoid:

- legacy key shapes: `user:`, `conversation:`, `userUUIDtoId:`, `stats:`
- storing ciphertext, profiles, blocks, or inbox data in KV
- unbounded `list()` in request paths

KV is eventually consistent. Do not use it for inbox ordering — `UserStateDO` is the inbox authority.

## Durable Object Rules

### UserStateDurableObject

One DO per internal user id (`idFromName(userId)`). Authority for:

- pause, display name ciphertext, drafts, inbox tickets
- blocks, contact labels, rate limits
- processed events (schema reserved)

All DO calls go through `src/services/user-state-service.ts` using `https://user-state/...` URLs.

Key endpoints: `/init`, `/state`, `/set-draft`, `/add-ticket`, `/pending-inbox`, `/mark-delivered`, `/ticket/:ref`, `/add-block`, `/remove-block`, `/set-label`, `/check-can-receive`, `/check-rate-limit`, `/purge`.

Inbox cap: 50 tickets per user DO. Pending tickets indexed by `status = 'pending'`.

### TelegramOutboxDurableObject

One DO per `chatHash` (`idFromName(chatHash)`). Idempotent outbound Telegram sends.

Queue consumer (`src/queues/telegram-outbox.consumer.ts`) dispatches jobs via `outbox-service.ts`.

Prefer:

- direct replies for immediate command responses in webhook
- outbox queue for recipient notifications and seen messages
- idempotency keys on outbox jobs — duplicates must not double-send

Avoid:

- storing plaintext secrets in outbox DO logs
- unbounded inbox or outbox table growth without caps/eviction

## Cloudflare Worker Performance Rules

Treat every webhook request as an edge hot path.

Prefer:

- fewer imports in `index.ts` and `bot.ts`
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
- `Router` instance and route table in `src/index.ts`

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

BOT_INFO
BOT_NAME
BOT_USERNAME
PUBLIC_SITE_URL?
```

Rules:

- read bindings from the `env` argument passed into handlers
- extend `Environment` when adding a new binding — do not use untyped `env.FOO` elsewhere
- never expose secrets in HTML pages or Telegram messages
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
- callback query inbox refs (`r:`, `b:`, `u:`, `n:`, `rp:` + 8 hex chars)
- HTTP route params sanitized by `router.ts`

Prefer small explicit checks in the handler. Do not add a validation framework.

Public stats use bounded D1 aggregates (`getPublicStats`). Do not replace with full-table scans as data grows without pagination design.

Return practical user-safe Persian errors. Keep internal details out of Telegram replies.

## Static Front Pages Rules

Public HTML lives in `src/front/` as template strings — not a SPA.

- `layout.ts` provides RTL Persian shell, Tailwind 2 CDN, Vazirmatn font.
- `home.ts` fetches GitHub commit info and D1 stats — keep external fetches fail-soft.
- `about.ts` is static explanatory content.

Rules:

- keep pages server-rendered strings; do not introduce Nuxt/React/Vue for these routes without explicit approval
- preserve RTL (`lang="fa"`, `direction: rtl`)
- sanitize any user-derived HTML (there is currently none — keep it that way)

## TypeScript Rules

Prefer strict, boring TypeScript.

- keep `Environment`, `BotUser`, `D1User`, `MessagePayload`, `ConnectionMetadata`, `InboxTicket` in `src/types.ts`
- `Conversation` in `types.ts` is a delivery view for `sender.ts` (Telegram chat ids) — not the storage model
- avoid `any`; use `unknown` then narrow
- do not introduce global type hacks
- match existing Grammy `Context` handler signatures

## Dependencies Rules

Do not add production dependencies unless explicitly approved.

Before proposing a dependency, check:

- Can this be done with Web APIs?
- Can this be done with a small helper in `src/utils/` or `src/services/`?
- Is the library Worker-compatible?
- Does it pull Node-only transitive dependencies?
- Does it increase the webhook bundle size?

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
```

`pnpm check` runs typecheck, lint, knip, and `test:crypto`.
TypeScript also enforces `noUnusedLocals` and `noUnusedParameters`.

Only run when explicitly requested or clearly required:

```bash
pnpm dev
pnpm deploy
wrangler deploy
wrangler d1 migrations apply nekonymous_core --remote
wrangler kv key list --binding NEKO_KV --remote
```

Never run destructive KV clears, deploy, or production Wrangler commands without explicit confirmation.

## Git Safety

- Inspect before editing.
- Preserve unrelated changes.
- Do not remove files unless directly required.
- Do not rewrite large files for style-only reasons.
- If unexpected workspace changes exist, do not overwrite them.

Default branch for deploy workflow is `master`.

## Cursor / Codex Behavior Rules

This file is the project source of truth for coding-agent behavior.

For Codex:

- keep this file near the repository root
- avoid bloating it beyond useful project-specific instructions

For Cursor:

- prefer this root `AGENTS.md` as shared guidance
- if Cursor rules are added, make them short bridges to this file

When working as an agent:

- follow project patterns over generic framework advice
- do not create files just because a template suggests them
- do not add docs unless requested
- do not add tests unless the project already has a clear test pattern or the task asks for them
- do not "improve" unrelated code
- do not replace working compact code with enterprise architecture
- do not reintroduce legacy KV conversation storage, `InboxSqliteDurableObject`, or `KVModel`

## Server Code Review Checklist

Before finalizing a Worker/bot change, verify:

- Does this run on Cloudflare Workers without Node-only runtime assumptions?
- Are bindings read from the typed `env` / handler args?
- Are all promises awaited, returned, or passed to `waitUntil`?
- Is request-scoped state local, not global?
- Are D1 queries bounded by purpose and indexes?
- Are inbox operations going through `user-state-service.ts`?
- Are messages encrypted at rest and payloads cleared after delivery?
- Are block checks and rate limits enforced server-side via UserStateDO?
- Are webhook secrets and crypto material never logged?
- Did this avoid unnecessary dependencies and abstraction layers?
- Did this avoid legacy `user:`, `conversation:`, `userUUIDtoId:`, or `stats:` KV keys?

## Default Answer Format for Implementation Tasks

When asked to give AI editor/Codex instructions, provide a complete implementable brief with:

- objective
- target files
- constraints
- generated base code or exact patch guidance when practical
- adaptation notes
- acceptance criteria
- what not to change
- checks to run

The brief should be complete enough that the editor agent can implement without guessing.
