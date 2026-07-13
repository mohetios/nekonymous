# Architecture

**Status:** canonical architecture for the current `master` branch.

Nekonymous is a Telegram-bot-only Cloudflare Worker. It has no public application API, authenticated web UI, plugin surface, or general route system. The static GitHub Pages site is an introduction page and is not part of the Worker runtime.

## Runtime surface

The Worker has three responsibilities:

```text
fetch()
  → validate and process Telegram POST /bot

queue()
  → dispatch known Cloudflare Queue batches

Durable Object exports
  → expose stateful storage and coordination classes
```

Unknown HTTP paths return `404`. Unknown queue names throw and fail the batch; they are not routed to another consumer.

The bot is wired statically with grammY. Handler order is explicit because middleware and callback registration order affect behavior.

## System map

```text
                         ┌───────────────────────┐
                         │   Telegram Bot API    │
                         └───────────┬───────────┘
                                     │ webhook
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker                                                │
│                                                                  │
│ POST /bot → grammY middleware → commands / messages / callbacks  │
│ queue()  → outbox | stats | profile-index                       │
│ exports  → Durable Object classes                               │
└───────────┬──────────────┬──────────────┬──────────────┬─────────┘
            │              │              │              │
            ▼              ▼              ▼              ▼
           D1        Durable Objects      KV         Vectorize
            │              │              │              │
            └──────────────┴───────┬──────┴──────────────┘
                                    │
                                    ▼
                         Telegram outbox delivery
```

## Cloudflare planes

| Plane | Authority | Must not become |
|---|---|---|
| D1 | identity structure, public links, daily aggregate statistics | anonymous transcript store or plaintext social graph |
| UserState DO | recipient-local state and short-lived workflow state | global user database |
| TicketVault DO | sealed anonymous message tickets | plaintext message table |
| ProfileVault DO | encrypted conversation profiles and index routing | D1-compatible profile graph |
| ConversationVault DO | sealed suggestions and requests | public relationship table |
| PairLedger DO | blind pair locks, cooldowns, and blocks | reversible pair directory |
| ReportLedger DO | blind report and abuse signals | sender-recipient report graph |
| TelegramOutbox DO | idempotent Telegram delivery | unbounded delivery log |
| KV | routing and short-lived cache | product source of truth |
| Queues | asynchronous delivery, indexing, and aggregation | exactly-once authority |
| Vectorize | bounded coarse candidate retrieval | final ranker or identity store |

Durable Objects coordinate atomic state changes. D1 remains the relational source of truth for structural account data. KV is never authoritative for inbox, profiles, suggestions, requests, or reports.

## Main data flows

### Anonymous deep-link message

```text
/start {slug}
  → resolve public link
  → sender writes text
  → create sealed ticket
  → TicketVault stores encrypted route + payload
  → recipient UserState stores an unread inbox item
  → recipient receives an aggregated unread notice
```

The notice does not include the message body or ticket capability. UserState holds only authenticated ciphertext for undelivered items. After successful delivery, the unread row is deleted and the delivered Telegram message owns future ticket actions.

### Inbox delivery

```text
ib:n / ib:b
  → claim unread item
  → decrypt sealed capability in memory
  → derive blind ticketHash from lookupNonce
  → resolve and verify current actor/account ownership
  → derive route/payload keys from keySeed
  → decrypt and send the payload through Telegram
  → clear payload only after successful send
  → delete the unread UserState item
  → keep route actions until expiry
```

`/inbox` renders the unread inbox control card. It is a bounded delivery queue, not a message archive. Delivered items disappear from UserState.

### Anonymous reply and actions

Telegram callback data contains a short capability reference. The Worker derives a blind lookup key, verifies the current actor, decrypts the route capsule only when required, and performs reply, block, report, unblock, or private nickname behavior.

Detailed protocol: [Sealed Ticketing](./sealed-ticketing.md).

### Conversation profile and suggestions

```text
25-question profile
  → encrypted ProfileVault record
  → profile-index queue
  → coarse self/desired vectors in Vectorize
  → bounded dual retrieval
  → profile resolution from ProfileVault
  → deterministic reciprocal ranker
  → sealed suggestions
  → sealed request
  → accept creates normal sealed message ticket
```

Vectorize retrieves candidates only. TypeScript applies eligibility, reciprocal scoring, exposure controls, cooldowns, pair state, and final ordering.

Detailed protocol: [Conversation Suggestions](./conversation-suggestions.md).

### Telegram outbound delivery

Non-critical Telegram sends can enter the outbox queue. Jobs carry stable idempotency keys.

```text
Queue batch
  → group by chat
  → sequential order within one chat
  → bounded concurrency across chats
  → TelegramOutbox DO claims delivery lease
  → call Telegram
  → lease-guarded success or failure
  → bounded retention cleanup
```

Cloudflare Queues and Durable Object alarms are at-least-once. Consumers, leases, state transitions, and cleanup operations are therefore idempotent.

### Product statistics

```text
product event
  → best-effort NEKO_STATS_QUEUE
  → batched D1 aggregate upsert
  → optional 60-second KV cache
  → public aggregate stats message
```

Statistics never scan TicketVault, UserState, ConversationVault, or ReportLedger.

D1 aggregate tables:

- `platform_daily_stats`
- `platform_daily_stats_by_key`
- `platform_daily_unique_stats`

Daily active users use a day-scoped blind hash. Public statistics do not expose top users, per-link owners, ticket details, message bodies, or user timelines.

### Hard account reset

```text
freeze old identity
  → disable discovery
  → remove/revoke profile and vector state
  → revoke conversation capabilities
  → purge blind ticket slots
  → purge UserState
  → remove D1 identity and KV routes
  → create new internal identity and public link
```

The operation is retryable and idempotent. Ticket access is revoked immediately because owner proof includes the old internal account id; old encrypted ticket records physically expire through the bounded ticket lifecycle. See [Threat Model](./threat-model.md) for profile-record limits.

## Bot interaction model

### Commands

| Command | Purpose |
|---|---|
| `/start` | create or resume account; show personal link; handle deep links |
| `/inbox` | open the bounded inbox |
| `/settings` | open settings |
| `/assessment` | open conversation profile |
| `/match` | open conversation suggestions |

The source of truth for command registration is `src/bot/commands.ts`.

### Keyboard layers

The persistent reply keyboard is navigation only:

```text
🔗 لینک من
📥 صندوق پیام‌ها
🧭 پیشنهاد گفت‌وگو
⚙️ تنظیمات
```

Inline keyboards perform actions on the current screen, ticket, suggestion, request, or confirmation.

During text entry, the reply keyboard contains only:

```text
↩️ لغو
```

Draft input is processed before main-menu labels so navigation text cannot hijack an active compose, reply, nickname, display-name, or request-intro flow.

### Callback families

| Prefix | Domain |
|---|---|
| `st:` | settings and confirmations |
| `t:` | conversation profile |
| `m:` | conversation suggestion hub |
| `s:` | sealed suggestion actions |
| `q:` | sealed conversation-request actions |
| `o:` | open a message ticket |
| `r:` | reply to message ticket |
| `b:` / `u:` | block and unblock |
| `n:` | private nickname |
| `rp:` | report |
| `ib:` | inbox menu |

Callback data remains language-independent, bounded by Telegram limits, and free of raw Telegram IDs or plaintext route data. Unrecognized or expired callbacks return one generic unavailable response.

## Source boundaries

```text
src/
  index.ts      Worker entry, queue dispatch, Durable Object exports
  bot/          Telegram composition, menus, keyboards, callbacks
  features/     identity, ticketing, moderation, settings,
                conversation profile and suggestions
  storage/      Durable Objects, storage clients, sharding, idempotency
  queues/       Telegram outbox and background consumers
  stats/        event emitters, aggregation, readers, formatting
  i18n/         Persian-first visible copy and language resources
  utils/        small shared helpers
```

Rules:

- Product handlers parse input, invoke product logic, and render a response.
- Crypto and storage details do not belong in Telegram UI handlers.
- Pure ranking and profile calculations do not receive the Worker `env`.
- Durable Objects own atomic state transitions.
- Queues handle non-critical asynchronous work.
- Request-specific mutable state must not live in module-level globals.
- Every promise is awaited, returned, or deliberately passed to `waitUntil`.
- New abstractions require repeated, concrete behavior; no generic repository or plugin layer.

## Storage access

Worker code talks to Durable Objects through typed storage clients in `src/storage/*-client.ts`. Each client resolves a shard stub and calls a public RPC method on the Durable Object class (for example `stub.getState()` or `stub.storeTicket(input)`). HTTP `fetch` routers inside Durable Objects are not used for internal Worker-to-DO calls.

Fail-closed rules:

- `UserStateDO` initialization runs only when `getState()` returns `null` (uninitialized), not on transient storage failures.
- unknown queue names throw during `queue()` dispatch;
- inbox-full and label-limit responses remain explicit at the client boundary.

## Performance invariants

- At most 10 unseen message payloads are decrypted per inbox request.
- Viewed inbox shells never decrypt payloads.
- Candidate retrieval and profile resolution are bounded.
- Queue processing uses bounded concurrency.
- No vault is globally scanned for statistics or dashboard data.
- D1 queries use explicit limits and relevant indexes.
- Encryption uses compact capsules, not one ciphertext per field.
- Worker bindings are used directly instead of HTTP calls back to Cloudflare services.
- Stats failures do not fail user operations.
- Telegram delivery uses stable idempotency keys and leases.
- Persistent Durable Object records have explicit retention or cleanup semantics.

## Architecture checks

The repository verification scripts enforce important parts of this document:

- ticket storage boundaries;
- webhook and outbox idempotency;
- D1 schema restrictions;
- bot command/callback flow;
- conversation capability ownership;
- profile and request storage privacy;
- profile projection and indexing;
- retrieval, ranking, and eligibility;
- request race behavior;
- release-hardening invariants.

Run:

```bash
pnpm run check
pnpm audit:d1
pnpm test:workers
```

`pnpm test:workers` runs Vitest inside the Workers runtime (`@cloudflare/vitest-pool-workers`) for webhook routing, queue dispatch, and typed Durable Object RPC smoke tests.
