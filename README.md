# Nekonymous

**Nekonymous** is a Persian-first anonymous Telegram bot for personal anonymous links, anonymous messages and replies, a conversation-style profile, and optional conversation suggestions.

It runs as a single Cloudflare Worker. Telegram is the product surface: the Worker accepts the Telegram webhook, consumes background queues, coordinates Cloudflare storage, and sends responses back through Telegram.

- [Intro page](https://mohetios.github.io/Nekonymous/)
- [Documentation](./docs/README.md)
- [Security policy](./SECURITY.md)

## What it does

- Creates a personal anonymous deep link: `t.me/{bot}?start={slug}`
- Relays anonymous text messages through sealed tickets
- Provides a bounded inbox with anonymous replies
- Supports block, report, private nickname, and pause/resume
- Builds a conversation profile from 25 questions across 8 dimensions
- Offers opt-in conversation suggestions with deterministic reciprocal ranking
- Converts an accepted conversation request into the normal sealed-ticket inbox flow
- Supports hard account reset with a new internal identity and public link
- Records anonymous aggregate product statistics

Main commands:

```text
/start
/inbox
/settings
/assessment
/match
```

Main reply keyboard:

```text
🔗 لینک من
📥 صندوق پیام‌ها
🧭 پیشنهاد گفت‌وگو
⚙️ تنظیمات
```

## Product flow

```text
Personal link
  → anonymous message
  → sealed ticket
  → recipient inbox
  → reply / nickname / block / report
  → ticket expiry
```

Optional conversation suggestions use a separate flow:

```text
25-question conversation profile
  → opt-in discoverability
  → bounded Vectorize retrieval
  → deterministic reciprocal ranking
  → sealed suggestion
  → sealed request
  → accepted request becomes a normal message ticket
```

## Privacy boundary

Nekonymous hides users from each other in normal product flows and minimizes joinable stored data. Sensitive stored data is encrypted at rest where implemented.

It is **not**:

- end-to-end encrypted;
- zero-knowledge;
- a perfect-anonymity system;
- a dating or compatibility product;
- a personality test or clinical assessment.

Telegram sees message plaintext while users send and receive messages. The Worker also sees plaintext while processing, encrypting, decrypting, and delivering it. Encryption at rest does not change that boundary.

Read the complete [threat model](./docs/threat-model.md) before making security or privacy claims.

## Core architecture

```text
Telegram Bot API
        │
        ▼
Cloudflare Worker + grammY
        │
        ├── D1
        ├── Durable Objects
        ├── KV
        ├── Queues
        └── Vectorize
        │
        ▼
Telegram outbox
        │
        ▼
Telegram Bot API
```

| Plane | Responsibility |
|---|---|
| Worker | `POST /bot`, grammY handlers, queue dispatch, Durable Object exports |
| D1 | users, public links, and aggregate product statistics |
| UserState DO | inbox pointers, drafts, blocks, labels, rate limits, profile sessions, exposure state |
| TicketVault DO | encrypted ticket routes and temporary encrypted payloads |
| ProfileVault DO | encrypted conversation profiles and Vectorize routing data |
| ConversationVault DO | sealed suggestions, requests, and encrypted request intros |
| PairLedger DO | blind pair locks, cooldowns, and pair state |
| ReportLedger DO | blind abuse and report signals |
| TelegramOutbox DO | idempotent Telegram delivery with leases and bounded retention |
| KV | routing and short-lived cache only |
| Queues | Telegram delivery, profile indexing, and aggregate statistics |
| Vectorize | coarse 8-dimensional retrieval only; no final decision logic |

D1 does not store anonymous message bodies or a plaintext anonymous sender-recipient graph. KV and Vectorize are not authoritative product stores.

## Sealed ticketing

An anonymous message is represented as a recipient-scoped sealed ticket capability:

```text
ticketRef
  → blind ticketHash
  → actor-bound owner proof
  → encrypted route capsule
  → temporary encrypted payload
  → TicketVault
  → sealed inbox pointer
```

The raw `ticketRef` is sent through Telegram callback data but is not stored as a database key. The payload is cleared after successful first inbox delivery. The encrypted route remains only until ticket expiry so reply, block, report, and private nickname actions can still work.

See [Sealed Ticketing](./docs/sealed-ticketing.md).

## Conversation suggestions

Conversation Suggestions V2 uses:

- 25 Persian-first questions;
- 8 conversation dimensions;
- separate self-style and desired-style vectors;
- opt-in discoverability;
- dual Vectorize retrieval;
- deterministic TypeScript ranking;
- blind pair state and sealed capabilities;
- no Workers AI in the suggestion or ranking path.

Vectorize retrieves a bounded candidate set. It does not make the final decision and does not receive Telegram identities.

See [Conversation Suggestions](./docs/conversation-suggestions.md).

## Quick start

Prerequisites:

- Node.js 22 or newer
- pnpm
- Wrangler authenticated to a Cloudflare account
- a Telegram bot token
- configured Cloudflare bindings from [`wrangler.jsonc.example`](./wrangler.jsonc.example)

```bash
pnpm install
cp .env.example .dev.vars
# Fill local secrets.

pnpm db:migrations:apply:local
./tools/setup-conversation-v2-resources.sh

pnpm run check
pnpm dev
```

`pnpm dev` starts local Wrangler on port `8787`. Telegram must reach `POST /bot` through an HTTPS URL, and the Telegram webhook secret must match `BOT_SECRET_KEY`.

The resource setup script can create or migrate Cloudflare resources. Review its target and configuration before using it outside a disposable development environment.

Full setup, testing, and deployment instructions are in [Development](./docs/development.md).

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm knip
pnpm test
pnpm run check
pnpm audit:d1
```

`pnpm run check` runs type checking, linting, dead-code checks, the repository verification scripts, Workers-runtime tests, and the sealed-ticket storage audit.

The current test suite covers ticket lifecycle, webhook and outbox idempotency, statistics, bot flow, D1 schema boundaries, profile indexing, conversation capabilities, privacy leakage, profile construction, retrieval, ranking, eligibility, requests, and release-hardening invariants.

## Documentation

| Document | Purpose |
|---|---|
| [Documentation index](./docs/README.md) | Canonical documentation map |
| [Architecture](./docs/architecture.md) | Runtime, storage planes, data flows, bot interaction, statistics |
| [Sealed Ticketing](./docs/sealed-ticketing.md) | Core anonymous relay and inbox protocol |
| [Conversation Suggestions](./docs/conversation-suggestions.md) | Profile, retrieval, ranking, suggestions, and requests |
| [Threat Model](./docs/threat-model.md) | Trust boundaries, threats, mitigations, and residual risks |
| [Development](./docs/development.md) | Local setup, tests, deployment, and maintenance |
| [Security Policy](./SECURITY.md) | Private vulnerability reporting |
| [Contributing](./CONTRIBUTING.md) | Contribution rules and quality bar |

## Project status

`master` is the supported development line. It includes Conversation Suggestions V2 and the July 2026 release-hardening work for ticket cleanup, account reset, request idempotency, Telegram outbox leases, queue safety, log redaction, capsule validation, and automated checks.

## License

MIT — see [LICENSE](./LICENSE).
