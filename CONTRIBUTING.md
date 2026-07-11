# Contributing

Thanks for helping improve Nekonymous.

Before a large pull request, open an issue or discussion first.

## Principles

- Keep security claims precise — see [SECURITY.md](./SECURITY.md) and [docs/security/threat-model.md](./docs/security/threat-model.md).
- Do not claim E2EE, zero-knowledge, perfect anonymity, dating compatibility, or clinical/personality diagnosis in user-facing copy.
- Persian-first UX; callback data must stay language-independent and under 64 bytes.
- Prefer small focused changes.
- Do not store plaintext message bodies, raw Telegram ids, or raw callback capabilities in D1 or KV.
- Do not use KV as source of truth for inbox, profiles, or conversation suggestions.
- Add or update verify scripts when touching ticketing, crypto, conversation profile/suggestions, storage, or i18n.

## Where to start (code)

| Question | Start here |
|----------|------------|
| Worker entry | `src/index.ts` |
| Bot wiring | `src/bot/register-handlers.ts` |
| Slash commands | `src/bot/commands.ts` |
| Bot interaction (commands, keyboards, callbacks) | `docs/architecture/bot-interaction-v1.md` |
| Inbox callbacks | `src/utils/telegram-callbacks.ts` |
| Sealed tickets | `docs/architecture/sealed-ticket-routing-and-inbox.md` |
| Conversation suggestions | `docs/architecture/conversation-suggestions-v2.md` |
| Maintainer rules | [AGENTS.md](./AGENTS.md) |

## Local checks

```bash
pnpm install
pnpm check
```

`pnpm check` runs `typecheck`, `lint`, `knip`, all conversation V2 verify scripts, ticketing/idempotency/stats checks, and `audit:ticket-storage`.

Individual scripts: `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm test`, `pnpm audit:d1`, `pnpm db:migrations:apply:local`.

Read [AGENTS.md](./AGENTS.md) before editing webhook hot paths.

## Security issues

Do not open public issues for vulnerabilities. See [SECURITY.md](./SECURITY.md).
