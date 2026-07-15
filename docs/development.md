# Development and Operations

**Status:** canonical setup, verification, deploy, and manual QA guide for the current `master` branch.

## Prerequisites

- Node.js 22 or newer;
- pnpm;
- Wrangler 4 authenticated to the target Cloudflare account;
- Telegram bot token from BotFather;
- Cloudflare Workers, D1, KV, Durable Objects, Queues, and Vectorize.

Workers AI is not required by Conversation Suggestions.

## Install

```bash
pnpm install
cp .env.example .dev.vars
```

Fill `.dev.vars` with local secrets. Never commit it.

## Secrets and variables

| Name | Type | Purpose |
|---|---|---|
| `SECRET_TELEGRAM_API_TOKEN` | secret | Telegram Bot API token |
| `BOT_SECRET_KEY` | secret | Telegram webhook `secret_token` validation |
| `APP_MASTER_KEY` | secret | AES-GCM/HKDF key material for tickets, chat routes, labels, profiles, requests |
| `APP_HMAC_PEPPER` | secret | HMAC for Telegram actor hash and blind tags |
| `BOT_INFO` | secret/var | cached Telegram `getMe` result object |
| `BOT_NAME` | secret/var | display name used in copy |
| `BOT_USERNAME` | secret/var | username without `@`, used for deep links |

Use at least 32 bytes of entropy for `APP_MASTER_KEY` and `APP_HMAC_PEPPER`.

Production:

```bash
wrangler secret put SECRET_TELEGRAM_API_TOKEN
wrangler secret put BOT_SECRET_KEY
wrangler secret put APP_MASTER_KEY
wrangler secret put APP_HMAC_PEPPER
wrangler secret put BOT_INFO
wrangler secret put BOT_NAME
wrangler secret put BOT_USERNAME
```

## Bindings

Current runtime bindings:

| Binding | Resource |
|---|---|
| `DB` | D1 `nekonymous_core` |
| `NEKO_KV` | routing/cache KV |
| `USER_STATE_DO` | `UserStateDurableObject` |
| `TELEGRAM_OUTBOX_DO` | `TelegramOutboxDurableObject` |
| `TICKET_VAULT` | `TicketVaultDurableObject` |
| `SAFETY_STATE_DO` | `SafetyStateDurableObject` |
| `PROFILE_VAULT_DO` | `ProfileVaultShardDurableObject` |
| `CONVERSATION_VAULT_DO` | `ConversationVaultShardDurableObject` |
| `PAIR_LEDGER_DO` | `PairLedgerShardDurableObject` |
| `NEKO_OUTBOX_QUEUE` | `neko-outbox` |
| `NEKO_STATS_QUEUE` | `neko-stats` |
| `NEKO_PROFILE_INDEX_QUEUE` | `neko-profile-index` |
| `CONVERSATION_VECTORS` | `nekonymous-conversation` |

The committed `wrangler.jsonc` includes deployment-specific ids. For another Cloudflare account, start from `wrangler.jsonc.example` and replace resource identifiers deliberately.

## Queue configuration

Current consumer behavior:

| Queue | Batch size | Batch timeout | Retries |
|---|---:|---:|---:|
| `neko-outbox` | 10 | 0 seconds | 5 + DLQ |
| `neko-stats` | 50 | 5 seconds | 5 + DLQ |
| `neko-profile-index` | 5 | 5 seconds | 5 + DLQ |

Outbox is latency-sensitive. Do not reintroduce a batch wait without measuring the user-facing effect.

## Local D1

```bash
pnpm db:migrations:apply:local
```

Remote:

```bash
pnpm db:migrations:apply:remote
```

Review every remote migration before applying it.

## Durable Object migrations

`wrangler.jsonc` contains historical migration tags required by already deployed environments. Do not reorder, rename, or rewrite applied tags.

The public-release Durable Object migration creates the current storage classes for fresh deployments. Inspect remote state before resetting production resources.

Before changing DO migration history:

```bash
wrangler deployments list
wrangler versions list
wrangler deploy --dry-run
```

Never assume a fresh environment and an existing production environment need the same history edit.

## Conversation resources

```bash
./tools/setup-conversation-resources.sh
```

Review the script and target account before running it. It can create or modify remote resources.

## Run locally

```bash
pnpm dev
```

Wrangler listens on port `8787`. Telegram requires a public HTTPS endpoint; expose the local port through a tunnel and register:

```text
https://your-tunnel.example/bot
```

The webhook `secret_token` must equal `BOT_SECRET_KEY`.

## Telegram webhook

Example registration:

```bash
curl -X POST "https://api.telegram.org/bot${SECRET_TELEGRAM_API_TOKEN}/setWebhook" \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://your-worker.example/bot",
    "secret_token": "YOUR_BOT_SECRET_KEY",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Do not place real tokens or secrets in committed scripts, shell history, screenshots, or issues.

## Verification commands

### Full release gate

```bash
pnpm check
```

Current `check` chain:

```text
types:check
→ typecheck
→ lint
→ knip
→ test:verify
→ test:workers
→ audit:ticket-storage
→ audit:types
```

### Focused commands

```bash
pnpm types:check
pnpm typecheck
pnpm lint
pnpm knip
pnpm test:workers
pnpm test:ticketing
pnpm test:idempotency
pnpm test:bot-flow
pnpm test:stats
pnpm test:d1-schema
pnpm test:release-hardening
pnpm test:conversation-profile
pnpm test:conversation-index
pnpm test:conversation-retrieval
pnpm test:conversation-ranking
pnpm test:conversation-eligibility
pnpm test:conversation-suggestions
pnpm test:conversation-requests
pnpm test:conversation-capabilities
pnpm test:conversation-privacy
pnpm test:profile-index-idempotency
pnpm audit:d1
pnpm audit:d1:local
pnpm audit:ticket-storage
pnpm audit:types
```

Use `git diff --check` before committing.

## Deploy

```bash
pnpm deploy
```

`pnpm deploy` applies remote D1 migrations and then runs a minified Wrangler deploy.

Deployment is a remote mutation. Run it only against the intended account and environment.

After deploy:

```bash
wrangler tail
```

Observe webhook timing, Queue consumers, Outbox retry/rejection, and Durable Object failures without logging message bodies or identifiers.

Stats Queue events are at-least-once. Each event includes a 35-day idempotency receipt in D1 so retry after a successful counter write does not increment the public aggregate twice.

## Safe observability

Hot-path timing emits stage durations such as:

```text
identityMs
draftMs
recipientMs
slugMs
sealMs
ackMs
totalMs
```

Timing metadata must not include raw ids, capabilities, hashes, tags, ciphertext, message text, or request bodies.

Important error stages include:

```text
queue:telegram
queue:inbox-drain
queue:inbox-notification
telegram-outbox:internal
telegram-outbox:dispatch
inbox:open-unread-capability
inbox:resolve-ticket
inbox:finalization-stale
```

## Manual QA

Use at least two Telegram accounts.

### Identity and link

1. `/start` creates one account and active public link.
2. repeated `/start` reuses the active account.
3. personal link opens a compose draft for the correct recipient.
4. self-message is rejected.
5. hard reset creates a new link and the old link stops resolving.

### Anonymous messaging

1. send one text message;
2. verify sender acknowledgment is prompt;
3. verify recipient receives a fresh notification with live unread count;
4. send 3 and 10 messages quickly and observe per-message notifications under one-second chat pacing;
5. press `/inbox` or `ib:d` and verify actual message delivery begins;
6. press `ib:d` twice and verify each ticket is delivered logically once;
7. run `/inbox` and `ib:d` concurrently and verify leases/idempotency;
8. test text and every supported Telegram media type;
9. verify payload is no longer deliverable after successful delivery while actions remain available;
10. verify a 51st unread is rejected when 50 are active.

### Failure behavior

- force a retryable Outbox result and verify Queue retry, unread retention, and vault retention;
- simulate Telegram `429` and verify `retry_after` is respected;
- simulate generic transient failure and verify five-second retry;
- verify malformed Queue jobs are logged and acknowledged rather than crashing a batch;
- verify stale unread attempt cannot delete a newer claim's TicketVault;
- verify permanent Telegram rejection completes unreachable unread/vault state.

### Ticket actions

1. reply anonymously;
2. block sender and verify direct message, reply, and conversation request are denied;
3. reset sender and verify block remains effective;
4. unblock and verify contact becomes possible;
5. set/change private nickname and verify future deliveries display it;
6. allow nickname draft to expire and verify it is ignored;
7. report the same ticket twice and verify one logical report event.

### Safety

1. submit reports from five distinct accounts inside the first window;
2. verify subject becomes suspended;
3. verify suspended subject cannot initiate message, reply, or request;
4. verify transition to probation using test-time controls;
5. submit three distinct probation reports in the phase window and verify ban;
6. reset subject account and verify sanction remains.

### Conversation Suggestions

1. complete all 25 questions on two accounts;
2. verify finalized encrypted profile and successful index revision;
3. enable discoverability explicitly;
4. search and open a suggestion;
5. send an intro and verify one durable request notification;
6. decline and verify cooldown;
7. accept twice/concurrently and verify one resulting ticket;
8. verify accepted intro arrives through the normal unread inbox;
9. block requester before request creation and verify request is denied;
10. hard reset and verify stale profile/index/request capability is unavailable.

## Telegram profile tooling

```bash
pnpm bot:profile
```

This mutates the live BotFather profile. Run only when intentionally updating production bot metadata.

## Destructive tools

```bash
pnpm flush:remote
pnpm flush:remote:local
```

Review implementation before use. Remote flush is destructive and Durable Object state may require explicit migration/class rotation rather than D1/KV/Vectorize cleanup alone.

## Documentation maintenance

When behavior changes, update the owning document listed in [`docs/README.md`](./README.md). Do not keep old and new architectures in parallel.
