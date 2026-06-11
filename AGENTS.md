# AGENTS.md

## Prime Directive

Nekonymous runs as a single Cloudflare Worker with a Telegram webhook and lightweight HTML pages. Server code must be small, edge-safe, low-CPU, and predictable.

When changing bot logic, crypto, KV, Durable Objects, or Worker routes, optimize for:

- low CPU per request
- few KV / Durable Object / HTTP subrequests
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

Nekonymous is a secure anonymous Telegram messaging bot. Users share a personal UUID link; others message them without revealing identity. Replies stay anonymous in both directions.

The product should feel:

- minimal
- privacy-first
- calm
- honest
- Persian-first in user-facing copy
- not SaaS-hype
- not over-architected

Public brand: **Nekonymous** / **نِکونیموس** (`package.json` name: `nekonymous`).

## Current Stack

- **Cloudflare Workers** — single Worker entry (`src/index.ts`)
- **Grammy** — Telegram bot framework (`grammy`)
- **Cloudflare KV** — users, conversations, UUID mapping, stats
- **Cloudflare Durable Objects** — per-user inbox queue (`InboxDurableObject`)
- **Web Crypto API** — SHA-256 key derivation and AES-GCM encryption
- **Web Crypto** — user link IDs via `crypto.getRandomValues` (`src/utils/uuid.ts`)
- **Tailwind CSS 2 (CDN)** — static HTML pages only
- **Wrangler 4** — dev and deploy
- **pnpm** — package manager (lockfile present; CI still uses `npm install`)

There is no Nuxt, GraphQL, D1, Queues, separate `workers/` package, or frontend SPA.

## Main Folder Model

```
src/
├── index.ts           # Worker fetch handler, route registration, DO export
├── types.ts           # User, Conversation, Environment, Handler
├── bot/
│   ├── bot.ts         # createBot(), Grammy wiring
│   ├── commands.ts    # /start, /inbox, message routing
│   ├── actions.ts     # inline keyboard: reply, block, unblock
│   └── inboxDU.ts     # InboxDurableObject
├── front/
│   ├── layout.ts      # shared HTML shell (RTL, Persian)
│   ├── home.ts        # / landing page + public stats
│   └── about.ts       # /about page
└── utils/
    ├── router.ts      # minimal HTTP router
    ├── kv-storage.ts  # KVModel generic wrapper
    ├── ticket.ts      # encryption, ticket ID, conversation ID
    ├── sender.ts      # decrypt + forward media to Telegram
    ├── messages.ts    # Persian bot copy strings
    ├── constant.ts    # keyboards, menu handlers
    ├── tools.ts       # rate limit, MarkdownV2 escape, Persian digits
    └── logs.ts        # daily stats in KV

tools/
└── clear.js           # KV bulk delete helper (uses wrangler CLI)

migrations/            # does not exist — no D1
```

Do not create alternative roots unless the project already uses them.

`wrangler.toml` and `.dev.vars` are gitignored. Bindings are defined locally / in CI secrets.

## Worker Entry and Routes

`src/index.ts` is the only Worker entry.

| Method | Path    | Purpose                                      |
|--------|---------|----------------------------------------------|
| GET    | `/`     | Public home page with aggregate stats        |
| GET    | `/about`| About / privacy page                         |
| POST   | `/bot`  | Telegram webhook (`webhookCallback` + secret)|

Use `src/utils/router.ts` for new HTTP routes. Do not add a second router or framework.

Export `InboxDurableObject` from `src/index.ts` for Wrangler DO binding.

## Bot Architecture Rules

### Wiring

- `createBot(env)` in `src/bot/bot.ts` constructs the Grammy bot and registers handlers.
- Pass `KVModel` instances and bindings into command/action handlers — do not read `env` globals inside deep helpers unless that pattern already exists in the file.
- Register new commands in `bot.ts` and implement logic in `commands.ts` or `actions.ts`.

### Commands and flows

| Surface              | Handler location   |
|----------------------|--------------------|
| `/start`             | `commands.ts`      |
| `/inbox`             | `commands.ts`      |
| incoming messages    | `commands.ts`      |
| reply/block/unblock  | `actions.ts`       |
| reply keyboard menu  | `constant.ts`      |

Core user flow:

1. `/start` without payload → create/find user, show personal `t.me/...?start={uuid}` link.
2. `/start {uuid}` → open anonymous conversation with link owner (rate-limited, block-checked, no self-message).
3. User sends message/media → encrypt, store in KV, push ticket to recipient's Durable Object inbox, notify recipient.
4. `/inbox` → drain DO inbox, decrypt KV payloads, deliver to Telegram, clear payload from stored conversation.
5. Inline **پاسخ** / **بلاک** / **آنبلاک** → reply thread or block list updates.

### Telegram copy

- User-facing bot strings live in `src/utils/messages.ts`.
- Keep Persian tone consistent with existing messages.
- Use `escapeMarkdownV2` when `parse_mode: "MarkdownV2"` is set.
- Use `convertToPersianNumbers` for counts shown to users.

Do not hardcode new English bot strings unless the task explicitly asks for localization work.

## Message and Crypto Rules

Encryption is ticket-based. Read `src/utils/ticket.ts` before changing storage or inbox behavior.

| Concept          | Role                                                        |
|------------------|-------------------------------------------------------------|
| `ticketId`       | Per-message private key (Base64), stored in DO inbox only |
| `conversationId` | SHA-256 digest used as KV key (derived from ticket + `APP_SECURE_KEY`) |
| `APP_SECURE_KEY` | Worker secret mixed into ticket key material                         |

Flow:

1. `await generateTicketId(APP_SECURE_KEY)` on send.
2. `await getConversationId(ticketId, APP_SECURE_KEY)` → KV key.
3. `await encryptedPayload(ticketId, json, APP_SECURE_KEY)` → stored in `conversation` KV namespace.
4. Inbox DO stores `{ timestamp, ticketId }` only — not plaintext.
5. On `/inbox`, decrypt via `decryptPayload`, send through `sendDecryptedMessage`, then clear `payload` in KV while keeping `connection` metadata.

Derivation (all via `crypto.subtle` / `crypto.getRandomValues` in `src/utils/ticket.ts`):

- Ticket: `SHA-256(random32 || APP_SECURE_KEY)` → Base64 ticket ID.
- Key material: `SHA-256(ticketBytes || APP_SECURE_KEY)` → 32-byte AES-256 key.
- Conversation ID: `SHA-256(keyMaterial || "nekonymous:conversation")` → Base64 KV key.

Rules:

- Never log `ticketId`, `APP_SECURE_KEY`, decrypted payloads, or Telegram tokens.
- Never store plaintext message bodies in KV or DO storage.
- Use Web Crypto only — no Node `crypto`, no third-party crypto libraries.
- Do not replace the ticket model with ad-hoc encryption without an explicit migration plan.
- `blockList` stores Telegram user IDs as strings/numbers — match existing comparisons in `commands.ts` / `actions.ts`.

## KV Rules

`KVModel<T>` in `src/utils/kv-storage.ts` namespaces keys as `{namespace}:{id}`.

Current namespaces (constructed in `bot.ts`):

| Namespace      | Value type        | Purpose                              |
|----------------|-------------------|--------------------------------------|
| `user`         | `User`            | profile, block list, conversation state |
| `conversation` | encrypted string  | encrypted `Conversation` JSON        |
| `userUUIDtoId` | Telegram user id  | UUID → user id lookup                |
| `stats`        | number            | daily counters (`key:YYYY-MM-DD`)    |

Prefer:

- `get` / `save` / `updateField` / `popItemFromField` on `KVModel`
- namespaced keys via the model — not raw `kv.put` scattered in new code
- bounded `list()` usage with explicit prefixes (see `logs.ts`)

Avoid:

- loading all users or conversations without prefix/limit
- storing decrypted message text in KV
- new parallel KV access patterns when `KVModel` already fits

KV is eventually consistent. Do not use it for inbox ordering truth — the Durable Object inbox is the per-user queue.

## Durable Object Rules

`InboxDurableObject` (`src/bot/inboxDU.ts`) is one DO instance per recipient Telegram user ID (`idFromName(userId)`).

Internal routes (via stub `fetch`):

| Method | Path        | Behavior                          |
|--------|-------------|-----------------------------------|
| POST   | `/add`      | append `{ timestamp, ticketId }`  |
| GET    | `/counter`  | return inbox array (used for count notification) |
| GET    | `/retrieve` | return inbox and delete storage |

Prefer:

- DO for per-user inbox serialization only
- short DO methods, direct `state.storage` access
- stub calls from `commands.ts` using the existing URL pattern (`https://inbox/...`)

Avoid:

- moving user profiles or encrypted conversations into DO storage without a deliberate redesign
- unbounded inbox growth without a product decision — `/retrieve` currently drains the full inbox

## Cloudflare Worker Performance Rules

Treat every webhook request as an edge hot path.

Prefer:

- fewer imports in `index.ts` and `bot.ts`
- simple functions over classes (except the required DO class)
- direct validation and direct KV/DO access
- bounded loops
- `async` I/O over CPU-heavy transforms
- clearing message payloads from KV after delivery (existing pattern)

Avoid:

- CPU-heavy loops in handlers
- unbounded JSON parsing or serialization
- full KV namespace scans in request paths
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
- `Router` instance and route table in `index.ts`

Forbidden at module scope:

- current Telegram user
- request object
- auth token or ticket material
- per-request KV/DO results
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
NekonymousKV
BOT_INFO
BOT_NAME
APP_SECURE_KEY
INBOX_DO
```

Rules:

- read bindings from the `env` argument passed into handlers
- extend `Environment` when adding a new binding — do not use untyped `env.FOO` elsewhere
- never expose secrets in HTML pages or Telegram messages
- webhook route must keep `secretToken: env.BOT_SECRET_KEY` validation

Do not rely on `process.env` in Worker runtime code.

Local secrets live in `.dev.vars` (Wrangler) and `.env` (keep in sync). Copy from `.env.example` — never commit filled `.env` / `.dev.vars`.

## Auth and Security Rules

Webhook auth:

- POST `/bot` must remain protected by Telegram `secretToken` (`BOT_SECRET_KEY`).
- Reject or do not add routes that expose bot control without equivalent validation.

Privacy:

- anonymity depends on not leaking Telegram IDs in public surfaces
- do not add logging of message content, user IDs, or ticket IDs
- error replies to users should stay generic (`HuhMessage`) — avoid echoing `JSON.stringify(error)` in new code (existing code has some; do not spread that pattern)

Rate limiting:

- `checkRateLimit` uses a 5-second window on `user.lastMessage`
- preserve rate limits on send/reply unless explicitly changing product rules

Blocking:

- server-side block checks must run before accepting new messages and replies
- blocking uses `user.blockList` in KV

## Validation and Input Rules

Validate at the boundary:

- Telegram update context (`ctx.from`, `ctx.match`, message payload type)
- deep-link UUID on `/start`
- callback query ticket IDs (`reply_`, `block_`, `unblock_` prefixes)
- HTTP route params sanitized by `router.ts`

Prefer small explicit checks in the handler. Do not add a validation framework.

All list/stat aggregation should stay bounded — `getTotalStats` lists by prefix; do not replace with full-table scans as data grows without pagination design.

Return practical user-safe Persian errors. Keep internal details out of Telegram replies.

## Static Front Pages Rules

Public HTML lives in `src/front/` as template strings — not a SPA.

- `layout.ts` provides RTL Persian shell, Tailwind 2 CDN, Vazirmatn font.
- `home.ts` may fetch GitHub commit info and KV stats — keep external fetches fail-soft (existing pattern).
- `about.ts` is static explanatory content.

Rules:

- keep pages server-rendered strings; do not introduce Nuxt/React/Vue for these routes without explicit approval
- preserve RTL (`lang="fa"`, `direction: rtl`)
- sanitize any user-derived HTML (there is currently none — keep it that way)
- update placeholder `example.com` meta URLs only when asked

## TypeScript Rules

Prefer strict, boring TypeScript.

- keep `User`, `Conversation`, `InboxMessage`, `Environment` in `src/types.ts`
- avoid `any`; use `unknown` then narrow
- do not introduce global type hacks
- match existing Grammy `Context` handler signatures

## Dependencies Rules

Do not add production dependencies unless explicitly approved.

Before proposing a dependency, check:

- Can this be done with Web APIs?
- Can this be done with a small helper in `src/utils/`?
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

`pnpm check` runs typecheck, lint, and knip (unused files/exports/deps).
TypeScript also enforces `noUnusedLocals` and `noUnusedParameters`.

Only run when explicitly requested or clearly required:

```bash
pnpm dev
pnpm dev:telegram
pnpm deploy
pnpm clean:kv
wrangler deploy
wrangler kv:*
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

## Server Code Review Checklist

Before finalizing a Worker/bot change, verify:

- Does this run on Cloudflare Workers without Node-only runtime assumptions?
- Are bindings read from the typed `env` / handler args?
- Are all promises awaited, returned, or passed to `waitUntil`?
- Is request-scoped state local, not global?
- Are KV lists bounded by prefix and purpose?
- Are inbox operations going through the DO stub pattern?
- Are messages encrypted at rest and payloads cleared after delivery?
- Are block checks and rate limits enforced server-side?
- Are webhook secrets and crypto material never logged?
- Did this avoid unnecessary dependencies and abstraction layers?

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
