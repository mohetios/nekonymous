# Nekonymous Documentation

This directory is the canonical technical documentation set for the current `master` branch.

The documents describe implemented behavior. They are not a roadmap and must not preserve removed storage paths or historical names.

## Document ownership

| Document | Owns |
|---|---|
| [Architecture](./architecture.md) | Worker runtime, Cloudflare planes, bot surfaces, queues, statistics, source boundaries, performance |
| [Sealed Ticketing](./sealed-ticketing.md) | Anonymous ticket capability, TicketVault, unread inbox, notifications, actions, blind tags, safety routing, retention |
| [Conversation Suggestions](./conversation-suggestions.md) | Profile schema, indexing, retrieval, deterministic ranking, suggestions, requests, accept idempotency |
| [Threat Model](./threat-model.md) | Assets, trust assumptions, storage exposure, threats, mitigations, retention, reset semantics, limitations |
| [Development](./development.md) | Local setup, bindings, migrations, tests, deploy, observability, manual QA, troubleshooting |

Repository-level documents:

- [`README.md`](../README.md): public project entry;
- [`SECURITY.md`](../SECURITY.md): private vulnerability reporting;
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): contribution workflow and quality bar;
- [`AGENTS.md`](../AGENTS.md): coding-agent and maintainer constraints;
- [`src/features/ticketing/README.md`](../src/features/ticketing/README.md): implementation-local ticketing map;
- [`LICENSE`](../LICENSE): MIT license.

## Source-of-truth order

When information conflicts, use this order:

1. current code and Workers-runtime tests;
2. `wrangler.jsonc`, D1 migrations, and package scripts;
3. canonical documents in this directory;
4. root README summaries;
5. Git history and historical design notes.

## Documentation invariants

All documents must reflect these current rules:

- one Cloudflare Worker and Telegram webhook surface;
- no public application API or web application inside the Worker;
- D1 stores account structure and aggregate statistics, not anonymous transcripts or profile graphs;
- KV is best-effort routing/cache only;
- every anonymous message is an independent sealed ticket;
- UserState holds a temporary encrypted unread capability, not a ticket hash or message body;
- each newly accepted unread creates one idempotent notification event;
- notification count is read live from UserState when the notification is sent;
- `/inbox` and `ib:d` drain the current actor's queue; there is no inbox list, pagination, or persistent inbox control card;
- delivered ticket actions are capability-gated and actor/account-bound;
- block, contact label, and abuse/report relationships use domain-separated blind tags;
- `SafetyStateDO` owns report events and sanction state;
- Conversation Suggestions uses ProfileVault, ConversationVault, PairLedger, Vectorize, and deterministic TypeScript ranking;
- Workers AI is not in the suggestion path;
- hard reset creates a new internal identity and public link;
- no E2EE, zero-knowledge, perfect-anonymity, dating, or clinical claims.

## Writing rules

- Describe current behavior, not intended behavior.
- Use `Nekonymous` for the project name and «نِکونیموس» in Persian brand copy.
- Prefer Persian product terms such as «صندوق پیام‌ها», «نام خصوصی», «ارزیابی سبک گفت‌وگو», and «پیشنهاد گفت‌وگو».
- Keep identifiers and callback values in code formatting.
- Avoid reproducing large source listings; document invariants and point to owning modules.
- Do not publish real binding IDs, tokens, ciphertext, capabilities, raw Telegram identifiers, or production data.
- Update tests and the owning document in the same change when an invariant changes.

## Historical notes

`docs/architecture/README.md` is only a pointer retained for old links. It must not contain an alternative architecture specification.
