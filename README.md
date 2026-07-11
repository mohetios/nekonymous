# Nekonymous

Nekonymous is a Persian-first anonymous Telegram bot for personal anonymous links, anonymous messaging, anonymous replies, conversation-style assessment, and optional conversation suggestions. It runs as a single Cloudflare Worker with a Telegram webhook only — the bot is the product surface.

- **Intro page:** [mohetios.github.io/Nekonymous](https://mohetios.github.io/Nekonymous/)
- **Source:** [github.com/mohetios/Nekonymous](https://github.com/mohetios/Nekonymous)

## Current status

- **Conversation Suggestions V2** — implemented and pre-release signed off (`pre-release-conversation-v2-acca6b9`)
- **Telegram-bot-only** — no public web app or SPA in the Worker (GitHub Pages intro is static docs only)
- **Stack:** Cloudflare Workers + D1 + Durable Objects + KV + Queues + Vectorize (no Workers AI in the suggestion path)
- **Before deploy:** run `pnpm check`; use `tools/setup-conversation-v2-resources.sh` for Vectorize and vault DO setup on fresh environments

## What it does

- Personal anonymous link (`t.me/{bot}?start={slug}`)
- Anonymous message (deep link)
- Inbox (`/inbox`)
- Anonymous reply
- Block / report / private nickname
- Pause / resume incoming messages
- Display name settings
- **Conversation profile** — 25 questions, 8 dimensions, schema `v2` (`/assessment`)
- **Conversation suggestions** — dual Vectorize retrieval, reciprocal ranking, sealed capabilities (`/match`)
- **Conversation requests** — intro message; accept → sealed inbox ticket (`q:` callbacks)
- Hard account reset (new internal id + link)
- Anonymous platform stats (`platform_daily_stats` via `neko-stats` queue)

## What it is not

- Not E2EE
- Not zero-knowledge
- Not perfect anonymity
- Not a dating app
- Not a personality test or clinical diagnosis
- Not a hosted chat app with a public logged-in UI
- No payments / Telegram Stars

Telegram and the Worker see message plaintext while messages are processed. Encryption at rest for stored sensitive data is not the same as E2EE.

## Privacy boundaries

Nekonymous hides users from each other in normal product flows, minimizes stored data where possible, and encrypts sensitive stored data at rest where implemented.

**In storage (where implemented):** HMACed Telegram hashes, encrypted chat ids and payloads, sealed ticket routing, profile and suggestion data in vault Durable Objects — not anonymous message bodies in D1.

**Not protected:** Telegram/Worker plaintext during delivery, screenshots, secret or platform compromise.

Full model: [docs/security/threat-model.md](./docs/security/threat-model.md). Reporting: [SECURITY.md](./SECURITY.md).

## Architecture

```text
Telegram → Cloudflare Worker (grammY) → D1 / Durable Objects / KV / Queues / Vectorize → Telegram outbox
```

| Layer | Role |
|-------|------|
| Worker | Webhook + queue consumers |
| D1 | Users, public links, aggregate stats only |
| UserState DO | Inbox pointers, drafts, blocks, profile session, exposure tokens |
| ProfileVault / ConversationVault / PairLedger DO | Encrypted profiles, suggestions, requests, pair state |
| TicketVault DO | Sealed encrypted message tickets |
| KV | Routing cache only |
| Vectorize | Coarse 8-d vectors for suggestion retrieval (no Workers AI) |

Details: [docs/architecture/sealed-ticket-routing-and-inbox.md](./docs/architecture/sealed-ticket-routing-and-inbox.md), [docs/architecture/conversation-suggestions-v2.md](./docs/architecture/conversation-suggestions-v2.md), [docs/architecture/platform-stats-engine.md](./docs/architecture/platform-stats-engine.md).

## Bot commands

```text
/start
/inbox
/settings
/assessment
/match
```

Main reply keyboard: `🔗 لینک من` · `📥 صندوق پیام‌ها` · `🧭 پیشنهاد گفت‌وگو` · `⚙️ تنظیمات`

Bot interaction details: [docs/architecture/bot-interaction-v1.md](./docs/architecture/bot-interaction-v1.md).

## Setup

```bash
pnpm install
cp .env.example .dev.vars
# fill secrets

pnpm db:migrations:apply:local
./tools/setup-conversation-v2-resources.sh   # fresh local / remote resources
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

Wrangler bindings: `DB`, `NEKO_KV`, `USER_STATE_DO`, `PROFILE_VAULT_DO`, `CONVERSATION_VAULT_DO`, `PAIR_LEDGER_DO`, `TELEGRAM_OUTBOX_DO`, `TICKET_VAULT`, `REPORT_LEDGER`, `NEKO_OUTBOX_QUEUE`, `NEKO_STATS_QUEUE`, `NEKO_PROFILE_INDEX_QUEUE`, `CONVERSATION_VECTORS`. Template: [`wrangler.jsonc.example`](./wrangler.jsonc.example).

### Local testing (conversation V2)

1. Apply D1 migrations: `pnpm db:migrations:apply:local`
2. Create Vectorize index + vault DO migrations: `./tools/setup-conversation-v2-resources.sh`
3. Fill `.dev.vars` from `.env.example`
4. Run `pnpm check` then `pnpm dev`
5. Point Telegram webhook at your tunnel (`POST /bot`, secret `BOT_SECRET_KEY`)
6. Test flow: `/assessment` → complete profile → enable discoverability in `/match` → search → send intro → accept on second account

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

`pnpm check` runs typecheck, lint, knip, all `test:*` verify scripts, and `audit:ticket-storage`.

## Documentation

| Document | Purpose |
|----------|---------|
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting and boundaries |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [AGENTS.md](./AGENTS.md) | Maintainer / agent rules |
| [docs/security/threat-model.md](./docs/security/threat-model.md) | Threat model |
| [docs/architecture/bot-interaction-v1.md](./docs/architecture/bot-interaction-v1.md) | Commands, keyboards, callbacks |
| [docs/architecture/sealed-ticket-routing-and-inbox.md](./docs/architecture/sealed-ticket-routing-and-inbox.md) | Sealed ticket + inbox |
| [docs/architecture/conversation-suggestions-v2.md](./docs/architecture/conversation-suggestions-v2.md) | Conversation profile + suggestions V2 |
| [docs/architecture/platform-stats-engine.md](./docs/architecture/platform-stats-engine.md) | Anonymous stats queue, D1 aggregates, public stats page |
| [docs/brand/nekonymous-fa-voice-and-tone.md](./docs/brand/nekonymous-fa-voice-and-tone.md) | Persian product voice |
| [docs/release/pre-release-conversation-v2-acca6b9.md](./docs/release/pre-release-conversation-v2-acca6b9.md) | Pre-release sign-off record |

## Roadmap

**Future backlog — not in current release:**

- Telegram Stars / payments and quotas
- Admin/moderation dashboard
- Stronger abuse controls
- Richer analytics
- Multilingual polish

## License

MIT — see [LICENSE](./LICENSE).
