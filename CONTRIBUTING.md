# Contributing

Thanks for helping improve Nekonymous.

Prefer small, focused pull requests. Discuss large features, Durable Object migrations, cryptographic changes, product-scope changes, storage-model changes, or broad refactors before implementation.

Report vulnerabilities privately through [SECURITY.md](./SECURITY.md).

## Read before editing

- [Architecture](./docs/architecture.md)
- [Sealed Ticketing](./docs/sealed-ticketing.md) for messaging, inbox, actions, tags, reports, or delivery
- [Conversation Suggestions](./docs/conversation-suggestions.md) for profiles, indexing, retrieval, ranking, suggestions, or requests
- [Threat Model](./docs/threat-model.md) for storage, identity, crypto, logging, reset, or public claims
- [Development](./docs/development.md)
- [AGENTS.md](./AGENTS.md) for maintainer and coding-agent constraints

## Architecture principles

- The Telegram bot is the product surface; do not add a public Worker web application or plugin framework.
- Keep `src/index.ts` limited to webhook delegation, Queue dispatch, and Durable Object exports.
- Every anonymous message is an independent sealed ticket.
- D1 stores account structure and aggregate statistics, not anonymous transcripts, profiles, requests, or pair graphs.
- KV is best-effort routing/cache only.
- Durable Objects own atomic state transitions.
- Queues and alarms are at-least-once; consumers must be idempotent.
- Vectorize retrieves bounded candidates only; TypeScript applies final ranking and policy.
- Keep Worker CPU, subrequests, decryptions, Queue batches, and retention cleanup bounded.
- Prefer direct domain code over generic repositories, managers, plugin layers, or framework-within-framework abstractions.
- Do not add production dependencies without a concrete need and review.

## Privacy and security rules

Do not store or log:

```text
plaintext anonymous message body in D1 or KV
plaintext anonymous route in D1
raw Telegram user/chat id in D1, KV, Vectorize metadata, or logs
raw ticket, profile, suggestion, or request capability in storage
request intro in D1
reversible anonymous sender-recipient or pair graph
full Telegram update/error objects in production logs
application keys, bot token, webhook secret, or Cloudflare credentials
```

Callback data must be short, language-independent, and free of raw ids or content.

Public copy must not claim:

```text
E2EE
zero-knowledge
perfect anonymity
Telegram cannot see messages
Worker cannot see messages
fully private or guaranteed safe
dating fit
personality/clinical diagnosis
exact fit percentage
```

## Ticketing invariants

- capability is 43-character canonical unpadded Base64URL;
- lookup hash derives only from lookup nonce;
- key seed is required for decryption;
- owner proof binds current actor/current account;
- UserState unread row contains sealed capability, blind dedupe, and lease only;
- notification event contains no capability or ticket authority;
- live unread count is read at notification send time;
- `/inbox` and `ib:d` drain current actor state, not a supplied ticket list;
- temporary failures release/retry and do not delete healthy tickets;
- orphan cleanup must own the exact unread attempt before deleting TicketVault;
- successful delivery clears payload and completes unread;
- block/pause/Safety gates apply to direct messages, replies, and requests;
- deterministic accept retry creates one logical ticket.

## Local workflow

```bash
pnpm install
cp .env.example .dev.vars
pnpm db:migrations:apply:local
./tools/setup-conversation-resources.sh
pnpm check
pnpm dev
```

Review setup scripts before targeting remote resources.

## Required checks

Before submitting:

```bash
pnpm check
git diff --check
```

Run focused checks for the changed domain. Examples:

```bash
pnpm test:ticketing
pnpm test:idempotency
pnpm test:bot-flow
pnpm test:release-hardening
pnpm test:conversation-profile
pnpm test:conversation-ranking
pnpm test:conversation-requests
pnpm test:workers
pnpm audit:d1
pnpm audit:ticket-storage
pnpm audit:types
```

When an invariant changes, add or update automated verification. Manual Telegram testing is required for user-facing delivery but is not a replacement for tests.

## Code style

- Use strict, explicit TypeScript and existing domain contracts.
- Narrow `unknown`; avoid `any`.
- Use domain names rather than `helpers`, `manager`, `processor`, or `common`.
- Keep pure profile/ranking calculations independent of Cloudflare bindings.
- Use classes only where the platform requires them, primarily Durable Objects.
- Await, return, or intentionally defer every promise.
- Keep request-scoped mutable data local.
- Do not create one file per trivial function or a parallel `core/` tree.
- Preserve established command names, callback prefixes, binding names, and applied Durable Object migration tags unless the change includes a complete migration plan.

## Documentation ownership

| Change | Document |
|---|---|
| public product summary | `README.md` |
| runtime, storage planes, queues, bot interaction, performance, stats | `docs/architecture.md` |
| capability, TicketVault, inbox, notifications, actions, tags, Safety | `docs/sealed-ticketing.md` |
| profile, Vectorize, ranking, suggestions, requests | `docs/conversation-suggestions.md` |
| trust boundary, retention, reset, keys, residual risks | `docs/threat-model.md` |
| setup, bindings, scripts, migrations, deploy, QA | `docs/development.md` |
| coding-agent constraints | `AGENTS.md` |

## Pull request checklist

- [ ] Scope is focused and current behavior is described.
- [ ] Storage and privacy impact is reviewed.
- [ ] Failure, retry, lease, and idempotency behavior is explicit.
- [ ] CPU, subrequest, Queue, and retention impact is bounded.
- [ ] Relevant automated tests or verification scripts were updated.
- [ ] `pnpm check` passes.
- [ ] `git diff --check` passes.
- [ ] Manual Telegram QA was performed when delivery/UI changed.
- [ ] Documentation is synchronized.
- [ ] No secrets, production data, generated local state, deploy, migration, flush, or BotFather mutation is included unintentionally.

## Commit messages

Use Conventional Commits with a required scope:

```text
type(scope): imperative description
```

Examples:

```text
fix(ticketing): preserve tickets on transient inbox failures
perf(outbox): remove queue batch wait
fix(safety): persist first-strike phase start
docs(architecture): document per-unread notification events
```
