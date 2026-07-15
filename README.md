# Nekonymous

**Nekonymous** is a Persian-first anonymous Telegram bot for personal anonymous links, sealed anonymous messaging, anonymous replies, and optional conversation suggestions.

The bot runs as one Cloudflare Worker. Telegram is the product surface; the Worker accepts Telegram webhooks, coordinates Cloudflare storage, consumes background queues, and sends messages through an idempotent Telegram outbox.

- [Intro page](https://mohetios.github.io/Nekonymous/)
- [Technical documentation](./docs/README.md)
- [Security policy](./SECURITY.md)

## Product scope

Nekonymous provides:

- a personal deep link: `t.me/{bot}?start={slug}`;
- anonymous text and supported Telegram media delivery;
- a bounded unread inbox with fresh unread-count notifications;
- anonymous replies attached to delivered ticket messages;
- recipient-local block and private nickname controls;
- blind reporting and automated safety sanctions;
- pause/resume for incoming contact;
- a 25-question, 8-dimension conversation profile;
- opt-in conversation suggestions with deterministic reciprocal ranking;
- accept-gated conversation requests that become normal sealed tickets;
- hard account reset with a new internal account and public link;
- anonymous aggregate product statistics.

Main commands:

```text
/start
/inbox
/settings
/assessment
/match
```

Persistent reply keyboard:

```text
🔗 لینک من
📥 صندوق پیام‌ها
🧭 پیشنهاد گفت‌وگو
⚙️ تنظیمات
```

## Messaging model

```text
personal link
  → sender composes a message
  → Worker creates an independent sealed ticket
  → TicketVault stores encrypted route, payload, and metadata
  → recipient UserState stores one sealed unread capability
  → recipient receives a fresh notification with the live unread count
  → /inbox or ib:d drains unread tickets
  → Telegram receives the message with ticket action buttons
  → payload is cleared and the unread row is removed
  → encrypted route actions remain available until ticket expiry
```

Every message is a separate ticket. The inbox is a temporary delivery queue, not a conversation archive or a relational message table.

## Privacy boundary

Nekonymous is designed to minimize joinable stored data and to hide users from each other in normal product flows. Sensitive stored data is encrypted at rest where implemented.

It is **not**:

- end-to-end encrypted;
- zero-knowledge;
- a perfect-anonymity system;
- a dating or fit product;
- a personality test or clinical assessment.

Telegram sees message plaintext while users send and receive it. The Worker sees plaintext while processing, encrypting, decrypting, and delivering it. Encryption at rest does not change this processing boundary.

Read the [Threat Model](./docs/threat-model.md) before making security or privacy claims.

## Architecture

```text
Telegram Bot API
        │ webhook / outbound API
        ▼
Cloudflare Worker + grammY
        │
        ├── D1: users, public links, aggregate statistics
        ├── UserState DO: recipient-local workflow state
        ├── TicketVault DO: sealed anonymous tickets
        ├── SafetyState DO: blind reports and sanctions
        ├── ProfileVault DO: encrypted conversation profiles
        ├── ConversationVault DO: sealed suggestions and requests
        ├── PairLedger DO: blind pair locks and cooldowns
        ├── TelegramOutbox DO: idempotent, paced delivery
        ├── KV: best-effort routing cache
        ├── Queues: outbox, statistics, profile indexing
        └── Vectorize: bounded 8-dimensional retrieval
```

D1 does not store anonymous message bodies, finalized conversation profiles, or a plaintext anonymous sender-recipient graph. KV and Vectorize are not authoritative product stores.

## Sealed tickets

A ticket capability is exactly 32 bytes encoded as 43 unpadded Base64URL characters:

```text
TicketCapability
  ├── 16-byte lookupNonce
  └── 16-byte keySeed
```

- `lookupNonce` derives the blind `ticketHash` used to locate a TicketVault record.
- `keySeed`, together with `APP_MASTER_KEY`, is required to derive independent route, payload, and metadata keys.
- an owner proof binds the ticket to the recipient Telegram actor, the recipient's current internal account, and the ticket hash;
- hard reset rotates the internal account id and immediately invalidates old ticket actions;
- ticket retention is 30 days;
- successful inbox delivery clears the payload and deletes the unread pointer;
- route material remains encrypted for reply, block, nickname, and report actions until expiry.

Before delivery, UserState contains only authenticated ciphertext for the capability plus blind deduplication and lease metadata. After delivery, Telegram callback data carries the capability for future actions.

See [Sealed Ticketing](./docs/sealed-ticketing.md).

## Conversation suggestions

Conversation Suggestions uses:

- 25 Persian-first questions;
- 8 conversation dimensions;
- separate self-style and desired-style vectors;
- discoverability off by default;
- bounded dual Vectorize retrieval;
- deterministic reciprocal ranking in TypeScript;
- sealed suggestion and request capabilities;
- blind pair locks and cooldowns;
- no Workers AI in retrieval or ranking.

An accepted request creates a normal sealed ticket. The accept operation uses deterministic ticket capability material so retries cannot create duplicate tickets.

See [Conversation Suggestions](./docs/conversation-suggestions.md).

## Quick start

Prerequisites:

- Node.js 22 or newer;
- pnpm;
- Wrangler authenticated to a Cloudflare account;
- a Telegram bot token;
- Cloudflare bindings configured from [`wrangler.jsonc.example`](./wrangler.jsonc.example).

```bash
pnpm install
cp .env.example .dev.vars
# Fill local secrets.

pnpm db:migrations:apply:local
./tools/setup-conversation-resources.sh

pnpm check
pnpm dev
```

`pnpm dev` starts local Wrangler on port `8787`. Telegram must reach `POST /bot` over HTTPS and the webhook `secret_token` must match `BOT_SECRET_KEY`.

Full setup and deployment instructions: [Development](./docs/development.md).

## Verification

```bash
pnpm types:check
pnpm typecheck
pnpm lint
pnpm knip
pnpm test
pnpm audit:ticket-storage
pnpm audit:types
pnpm check
```

`pnpm check` is the release gate. It verifies generated bindings, TypeScript, lint, dead code, repository invariants, Workers-runtime tests, ticket-storage boundaries, and contract consolidation.

## Documentation

| Document | Purpose |
|---|---|
| [Documentation index](./docs/README.md) | Canonical document map and ownership |
| [Architecture](./docs/architecture.md) | Runtime, storage planes, queues, bot interaction, performance |
| [Sealed Ticketing](./docs/sealed-ticketing.md) | Ticket capability, inbox, actions, tags, safety, lifecycle |
| [Conversation Suggestions](./docs/conversation-suggestions.md) | Profile, indexing, retrieval, ranking, requests |
| [Threat Model](./docs/threat-model.md) | Trust boundaries, threats, mitigations, residual risks |
| [Development](./docs/development.md) | Setup, bindings, tests, deploy, operations, manual QA |
| [Security Policy](./SECURITY.md) | Private vulnerability reporting |
| [Contributing](./CONTRIBUTING.md) | Contribution and review rules |

## Project status

`master` is the supported development line. It contains the July 2026 sealed-inbox, safety, request-idempotency, account-reset, Queue/Outbox, and release-hardening implementation.

## License

MIT — see [LICENSE](./LICENSE).
