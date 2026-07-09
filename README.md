# Nekonymous

Nekonymous is a Persian-first anonymous Telegram bot for personal anonymous links, anonymous messaging, anonymous replies, conversation-style assessment, and optional conversation suggestions. V1 runs as a single Cloudflare Worker with a Telegram webhook only — the bot is the product surface.

- [github.com/mohetios/Nekonymous](https://github.com/mohetios/Nekonymous)

## Current status

- **V1 release candidate** (`0.1.0`)
- **Code-frozen for V1**
- **Telegram-bot-only** product surface (no public web app/SPA in the Worker)
- **Release polish / docs / QA** in progress
- **No payment or top-up in V1**

## What it does

- Personal anonymous link (`t.me/{bot}?start={slug}`)
- Anonymous message (deep link)
- Inbox (`/inbox`)
- Anonymous reply
- Block / report / private nickname
- Pause / resume incoming messages
- Display name settings
- Conversation-style assessment (56 questions, 14 dimensions, `v1`)
- Optional conversation suggestions (opt-in discoverability, accept-gated intros)
- Pending conversation requests (accept / decline / cancel)
- Reset suggestion history
- Hard account reset (new internal id + link)
- Anonymous platform stats (`platform_daily_stats` via `neko-stats` queue)

## What it is not

- Not E2EE
- Not zero-knowledge
- Not perfect anonymity
- Not a dating app
- Not a personality test or clinical diagnosis
- Not a public web app / SPA in V1
- No payments / Telegram Stars in V1

Telegram and the Worker see message plaintext while messages are processed. Encryption at rest for stored sensitive data is not the same as E2EE.

## Privacy boundaries

Nekonymous hides users from each other in normal product flows, minimizes stored data where possible, and encrypts sensitive stored data at rest where implemented.

**In storage (where implemented):** HMACed Telegram hashes, encrypted chat ids and payloads, sealed ticket routing, no anonymous message bodies in D1.

**Not protected:** Telegram/Worker plaintext during delivery, screenshots, secret or platform compromise.

Full model: [docs/security/threat-model.md](./docs/security/threat-model.md). Reporting: [SECURITY.md](./SECURITY.md).

## Architecture

```text
Telegram → Cloudflare Worker (grammY) → D1 / Durable Objects / KV / Queues / AI / Vectorize → Telegram outbox
```

| Layer | Role |
|-------|------|
| Worker | Webhook + queue consumers |
| D1 | Users, assessment, match workflow, stats |
| UserState DO | Inbox pointers, drafts, blocks, labels, assessment session |
| TicketVault DO | Sealed encrypted tickets |
| KV | Routing cache only |
| Vectorize + Workers AI | Embedding; candidate discovery (ranking in TypeScript) |

Details: [docs/architecture/sealed-ticket-routing-and-inbox.md](./docs/architecture/sealed-ticket-routing-and-inbox.md), [docs/architecture/matching-v1.md](./docs/architecture/matching-v1.md).

## Bot commands

```text
/start
/inbox
/settings
/assessment
/match
/match_system
```

Main reply keyboard: `🔗 لینک من` · `🧭 پیشنهاد گفت‌وگو` · `⚙️ تنظیمات`

## Setup

```bash
pnpm install
cp .env.example .dev.vars
# fill secrets

pnpm db:migrations:apply:local
pnpm check
pnpm dev
```

`pnpm dev` → `wrangler dev --local --port 8787`. Use an HTTPS tunnel for Telegram webhooks; `secret_token` must match `BOT_SECRET_KEY`.

Deploy: `pnpm deploy` (remote migrations + `wrangler deploy --minify`).

## Configuration

Local secrets: `.dev.vars` from [`.env.example`](./.env.example).

| Secret / var | Purpose |
|--------------|---------|
| `SECRET_TELEGRAM_API_TOKEN` | Bot API |
| `BOT_SECRET_KEY` | Webhook validation |
| `APP_MASTER_KEY` | Encryption IKM |
| `APP_HMAC_PEPPER` | Telegram hash HMAC |
| `BOT_INFO`, `BOT_NAME`, `BOT_USERNAME` | Bot metadata |

Wrangler bindings: `DB`, `NEKO_KV`, `USER_STATE_DO`, `TELEGRAM_OUTBOX_DO`, `TICKET_VAULT`, `REPORT_LEDGER`, `NEKO_OUTBOX_QUEUE`, `NEKO_STATS_QUEUE`, `AI`, `PROFILE_VECTORS`. Template: [`wrangler.jsonc.example`](./wrangler.jsonc.example).

## Development checks

```bash
pnpm typecheck
pnpm lint
pnpm knip
pnpm test
pnpm check
pnpm audit:d1
pnpm bot:profile
```

`pnpm check` runs typecheck, lint, knip, all verify scripts, and `audit:ticket-storage`.

## Documentation

| Document | Purpose |
|----------|---------|
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting and boundaries |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [AGENTS.md](./AGENTS.md) | Maintainer / agent rules |
| [docs/security/threat-model.md](./docs/security/threat-model.md) | Threat model |
| [docs/architecture/sealed-ticket-routing-and-inbox.md](./docs/architecture/sealed-ticket-routing-and-inbox.md) | Sealed ticket + inbox |
| [docs/architecture/matching-v1.md](./docs/architecture/matching-v1.md) | Conversation suggestions V1 |
| [docs/release/](./docs/release/) | Release audit notes |

## Roadmap

**Future backlog — not V1:**

- Telegram Stars / payments and quotas
- Admin/moderation dashboard
- Stronger abuse controls
- Richer analytics
- Multilingual polish

## License

MIT — see [LICENSE](./LICENSE).
