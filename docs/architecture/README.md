# Architecture notes (legacy layout)

**Status:** historical reference only.

These files describe earlier flat module paths (`features/messaging`, `features/conversation-profile`, `features/conversation-suggestions`, `bot/router.ts`) that were removed in the V2 reorganization.

Canonical architecture lives in:

- [`../architecture.md`](../architecture.md)
- [`../sealed-ticketing.md`](../sealed-ticketing.md)
- [`../conversation-suggestions.md`](../conversation-suggestions.md)

Current source layout:

```text
src/features/ticketing/
src/features/conversation/profile/
src/features/conversation/suggestions/
src/bot/webhook.ts
src/bot/callback-data.ts
```

Do not use these legacy docs for new implementation work.
