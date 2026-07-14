# Development

This guide covers local setup, Cloudflare resources, verification, deployment, and maintenance for Nekonymous.

## Prerequisites

- Node.js 22 or newer
- pnpm
- Wrangler CLI through the repository dependency
- a Cloudflare account
- a Telegram bot created through BotFather
- an HTTPS tunnel for local Telegram webhook testing

Install dependencies:

```bash
pnpm install
```

## Local secrets

Copy the template:

```bash
cp .env.example .dev.vars
```

Required values include:

| Name | Purpose |
|---|---|
| `SECRET_TELEGRAM_API_TOKEN` | Telegram Bot API token |
| `BOT_SECRET_KEY` | Telegram webhook secret validation |
| `APP_MASTER_KEY` | input key material for encrypted storage |
| `APP_HMAC_PEPPER` | HMAC identity and blind-lookup protection |
| `BOT_INFO` | bot metadata/copy configuration |
| `BOT_NAME` | visible bot name |
| `BOT_USERNAME` | Telegram bot username |

Never commit `.dev.vars`, production secrets, exported Cloudflare data, or real Telegram update payloads.

## Cloudflare bindings

The deployment template is [`wrangler.jsonc.example`](../wrangler.jsonc.example).

Current binding families:

```text
DB
NEKO_KV

USER_STATE_DO
PROFILE_VAULT_DO
CONVERSATION_VAULT_DO
PAIR_LEDGER_DO
TELEGRAM_OUTBOX_DO
TICKET_VAULT
REPORT_LEDGER

NEKO_OUTBOX_QUEUE
NEKO_STATS_QUEUE
NEKO_PROFILE_INDEX_QUEUE

CONVERSATION_VECTORS
```

Keep binding names and exported Durable Object class names aligned with Wrangler migrations. Renaming a class or binding is a deployment migration, not a normal source-file cleanup.

## Database and conversation resources

Apply local D1 migrations:

```bash
pnpm db:migrations:apply:local
```

Provision or migrate the Conversation Suggestions V2 resources:

```bash
./tools/setup-conversation-v2-resources.sh
```

The setup script can affect configured Cloudflare resources. Read the script and verify the active account/environment before using it against a remote environment.

Audit local D1 schema:

```bash
pnpm audit:d1:local
```

## Run locally

```bash
pnpm dev
```

This starts:

```text
wrangler dev --local --port 8787
```

Telegram must reach:

```text
POST /bot
```

Use an HTTPS tunnel and configure the Telegram webhook secret to match `BOT_SECRET_KEY`.

The Worker does not expose a public application API. Non-`POST /bot` requests should return `404`.

## Verification commands

### Required before every pull request or deploy

```bash
pnpm run check
git diff --check
```

`pnpm run check` runs:

```text
types:check (wrangler binding drift)
typecheck
lint
knip
all repository verification scripts
sealed-ticket storage audit
test:workers (Vitest in workerd)
```

Use the global Wrangler CLI (`wrangler`, not `pnpm exec wrangler`) for remote operations in this repository.

Regenerate binding types after `wrangler.jsonc` binding changes:

```bash
pnpm types:bindings
pnpm types:check
```

### Individual commands

```bash
pnpm typecheck
pnpm types:bindings
pnpm types:check
pnpm lint
pnpm lint:fix
pnpm knip
pnpm test
pnpm test:workers
pnpm audit:d1
pnpm audit:d1:local
pnpm audit:ticket-storage
```

`pnpm test` runs the Node verification scripts only. `pnpm test:workers` runs Vitest with `@cloudflare/vitest-pool-workers` for runtime integration tests under `test/`.

### Focused verification

```bash
pnpm test:ticketing
pnpm test:idempotency
pnpm test:stats
pnpm test:bot-flow
pnpm test:d1-schema

pnpm test:conversation-v2-resources
pnpm test:conversation-capabilities
pnpm test:conversation-privacy
pnpm test:conversation-profile
pnpm test:conversation-index
pnpm test:conversation-retrieval
pnpm test:conversation-ranking
pnpm test:conversation-eligibility
pnpm test:conversation-suggestions
pnpm test:conversation-requests
pnpm test:profile-index-idempotency

pnpm test:release-hardening
pnpm test:workers
```

The verification scripts use Node's TypeScript stripping and do not introduce a runtime test framework into the Worker.

Tooling note: keep TypeScript on the latest `5.9.x` line until `typescript-eslint` officially supports TypeScript 7. The July 2026 dependency update keeps `typescript-eslint` on `8.63.x`, whose supported peer range is `<6.1`.

Vitest worker tests cover:

- webhook auth and routing (`test/worker-runtime.test.ts`)
- queue dispatch fail-closed behavior
- typed Durable Object RPC smoke tests (`test/storage-rpc.test.ts`)

### Queue setup

Create or verify Cloudflare Queues and dedicated DLQs:

```bash
./tools/setup-queues.sh
```

Primary queues: `neko-outbox`, `neko-stats`, `neko-profile-index`

Dead-letter queues: `neko-outbox-dlq`, `neko-stats-dlq`, `neko-profile-index-dlq`

The legacy shared `neko-dlq` producer binding is removed from `wrangler.jsonc`.

## Manual two-account QA

Use two Telegram accounts.

### Core bot

1. Run `/start` on both accounts.
2. Open account A's personal link from account B.
3. Send an anonymous message.
4. Confirm A receives only a generic new-message notification.
5. Open `/inbox` and verify the body appears.
6. Open `/inbox` again and verify the compact viewed shell.
7. Reply from A and verify B receives a new sealed ticket.
8. Set and update a private nickname.
9. Block, confirm future delivery is denied, then test unblock.
10. Report a ticket.
11. Pause and resume incoming messages.
12. Test destructive hard-reset confirmation and old-link rejection.

### Conversation Suggestions V2

1. Complete `/assessment` on both accounts.
2. Verify 25 questions and a finalized profile.
3. Wait for or trigger profile-index queue processing.
4. Enable «نمایش در پیشنهادها» for both accounts.
5. Search from account A.
6. Open a suggestion and write an intro.
7. Confirm account B receives one request notification.
8. Accept twice or tap concurrently where possible; verify one resulting ticket.
9. Test decline and cancel paths.
10. Verify accepted conversation continues through the normal anonymous inbox.
11. Reset one account and confirm old profile/capability behavior is unavailable.

### Failure behavior

- Tap an expired or unsupported callback and verify the generic unavailable message.
- Repeat a command/update if your test harness supports it and confirm idempotency.
- Temporarily fail Telegram delivery in local verification and confirm payload/state is not finalized incorrectly.

## Telegram profile

BotFather profile tooling:

```bash
pnpm bot:profile
```

The script reads the canonical command definitions from code and verifies the Telegram command profile.

Treat this as a remote mutation. Run it only when intentionally updating the live bot profile.

## Deployment

The deploy script performs remote D1 migration before Worker deployment:

```bash
pnpm deploy
```

Equivalent behavior:

```text
wrangler d1 migrations apply DB --remote
wrangler deploy --minify
```

Before deploying:

```bash
git status --short
pnpm run check
pnpm audit:d1
```

Also verify:

- correct Cloudflare account and environment;
- secrets exist for the target Worker;
- D1, KV, Durable Object, Queue, DLQ, and Vectorize bindings match Wrangler;
- Durable Object migration history is valid;
- Telegram webhook URL and secret match the deployed Worker;
- no flush or remote cleanup command is being run unintentionally.

The following scripts are destructive or environment-sensitive and must never be part of a normal validation run:

```bash
pnpm flush:remote              # data wipe: D1 + KV + Vectorize (repeatable)
pnpm flush:remote -- --full-do-reset  # one-shot DO generation reset (needs new migration pair after v11)
pnpm flush:remote:local
pnpm db:migrations:apply:remote
pnpm bot:profile
pnpm deploy
```

## Code boundaries

### Worker hot path

- keep `src/index.ts` mechanical;
- accept Telegram webhook, dispatch known queues, export Durable Objects;
- no general route framework or plugin registry;
- reject unknown queues explicitly;
- avoid request-scoped module globals;
- await correctness-critical storage work;
- use `waitUntil` only for non-critical best-effort work.

### Product logic

- Telegram handlers parse, authorize, invoke product behavior, and render;
- sealed ticketing remains an explicit core domain;
- deterministic ranking remains pure TypeScript;
- Durable Objects own atomic state transitions;
- D1 is not a transcript or profile graph;
- KV is cache/routing only;
- Vectorize retrieves candidates only.

### Performance

- all lists, scans, decryptions, and candidate sets are bounded;
- no unbounded `Promise.all`;
- preserve per-chat Telegram order;
- use bounded concurrency across independent chats;
- use Cloudflare bindings directly;
- keep encrypted capsules compact;
- give persistent Durable Object rows explicit expiry or retention.

### Security

- no raw Telegram IDs in D1, KV, or Vectorize metadata;
- no raw callback capabilities in storage;
- no plaintext message body or anonymous route in D1;
- no arbitrary production error-object logging;
- no security claim stronger than the threat model;
- update or add a verification script when changing an invariant.

## Documentation maintenance

When changing:

| Area | Update |
|---|---|
| Worker/storage/queue topology | `docs/architecture.md` |
| ticket creation, inbox, callbacks, reports, expiry | `docs/sealed-ticketing.md` |
| profile, retrieval, ranking, suggestions, requests | `docs/conversation-suggestions.md` |
| trust boundary, retention, reset, cryptography | `docs/threat-model.md` and possibly `SECURITY.md` |
| setup, scripts, bindings, deployment | `docs/development.md` |
| public feature list or status | `README.md` |
| contribution quality bar | `CONTRIBUTING.md` |

## Pull request completion report

A meaningful implementation pull request should state:

```text
what changed
why it changed
storage or privacy impact
CPU/subrequest impact
files and migrations
tests run
manual QA
known limitations
remote actions not run
```
