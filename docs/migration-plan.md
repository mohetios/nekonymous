# Nekonymous storage & efficiency migration plan

This document describes **optional** future changes to inbox storage, stats aggregation, and ciphertext placement. It is not a commitment to implement everything here.

**Current state (after Tier 1–2):** webhook hot path is optimized (HKDF cache, bot cache, batched KV updates, DO `/add` pending count, deferred stats). The bot should keep running on the existing KV + Durable Object model until metrics justify going deeper.

**Principle:** measure first → change storage only when a metric proves pain → migrate with dual-read, not big-bang.

---

## When to use this plan

| Signal | Likely phase |
|--------|----------------|
| Bot works well, normal traffic, mostly text | **No migration** — stay on current model |
| Homepage stats `list` slows as daily keys grow | Phase 1 (stats totals) |
| DO `/add` or `/list` latency rises with inbox depth | Phase 2 (SQLite inbox) |
| Large media ciphertext duplicates dominate cost/CPU | Phase 3 (single ciphertext store) |
| p95 `/bot` CPU consistently high | Phase 0 profiling first, then decide |

---

## Cloudflare guidance (2025–2026)

References for design decisions:

| Topic | Guidance | Implication for Nekonymous |
|-------|----------|----------------------------|
| CPU vs wall time | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) — I/O (KV, DO, `fetch`) does not count toward CPU; crypto and JSON parsing do | Tier 1 crypto wins were the right first step |
| Profiling | [CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/) — use DevTools in `wrangler dev` before guessing | Required before Phase 2/3 |
| KV | Eventually consistent; good for read-heavy, rarely changing data | Keep user profiles, UUID map, daily stats in KV |
| Durable Objects | Transactional; one instance per recipient inbox is correct | Do not move inbox queue back to KV |
| SQLite DO | [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) — recommended for new DO namespaces | Consider for inbox when array model hurts |
| DO migrations | [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) — schema in constructor + `blockConcurrencyWhile()` | Required for Phase 2 |
| Schema version | `PRAGMA user_version` is **not** supported in DO SQLite — use `_sql_schema_migrations` table | See Phase 2 schema |
| PITR | SQLite DO point-in-time recovery (30 days) | Safety net during Phase 2 rollout |
| Queues | Fast ACK + async processing | **Skip** unless webhook latency becomes a product problem |

---

## Revised Tier 3 phases (priority order)

### Phase 0 — Observability (zero product risk)

Add baselines before any storage architecture change.

**Metrics to capture**

- Workers **CPU time** and **subrequest count** per route (`POST /bot` vs `GET /`)
- DO method latency: `/add`, `/list`, `/mark-delivered`, `/entry`
- Distribution of pending inbox size at `/add` time
- Ciphertext size buckets: text vs photo/video/document (byte length only — never log plaintext)

**Tools**

- Cloudflare Workers dashboard (production)
- DevTools CPU profile in `wrangler dev` (local)
- Optional: structured log lines with context labels only (no `ticketId`, no message content)

**Go / no-go**

- Proceed to Phase 1+ only when a metric crosses a threshold you define (example: p95 `/bot` CPU > 10 ms sustained, or DO op p95 > X ms with inbox near cap).

---

### Phase 1 — Homepage stats running totals (low risk, isolated) — **shipped**

**Implemented in** `src/utils/logs.ts`:

- Daily keys unchanged: `newConversation:YYYY-MM-DD`, `newUser:YYYY-MM-DD`.
- Running totals: `total:newConversation`, `total:newUser` (incremented with each `incrementStat` for those bases).
- `getTotalStats` reads two KV keys; if a total is missing, sums daily keys once and writes the total (lazy backfill on first homepage load after deploy).

**Rollback**

Revert `getTotalStats` / `incrementStat` in `src/utils/logs.ts`; daily keys remain valid.

---

### Phase 2 — Inbox DO: SQLite rows — **shipped**

**Implemented in** `src/bot/inboxDU.ts` + `wrangler.jsonc.example`:

- SQLite-backed `InboxSqliteDurableObject` (`new_sqlite_classes` migration tag `v3-inbox-sqlite` or equivalent).
- Table `inbox_entries` with indexed pending lookups; O(1) row ops instead of full JSON array rewrite.
- External routes unchanged: `/add`, `/list`, `/entry`, `/mark-delivered`, `/purge`.
- `/purge` runs `DELETE FROM inbox_entries` then `storage.deleteAll()`.

**Deploy note:** No legacy KV-array import. Existing KV-backed inbox data is **not** carried over — add the SQLite migration tag and accept empty inboxes until new traffic.

**Rollback:** Revert `inboxDU.ts` and Wrangler migration; redeploy previous Worker version.

---

### Phase 3 — Single ciphertext store (high risk, media-triggered)

**Problem today**

On send, the same encrypted blob is stored in:

1. KV `conversation:{conversationId}`
2. DO inbox entry `ciphertext`

After `/inbox` delivery, DO drops ciphertext; KV keeps a **cleared-payload** ciphertext so reply/block/nickname callbacks still work via `loadConversationForAction` → `conversations.getText()`.

**When to do it**

- Duplicate large media ciphertext dominates KV storage or send-path work.
- Phase 0 shows meaningful win from deduplication (define threshold before starting, e.g. 30% reduction on media send path).

**When not to**

Mostly text traffic — duplication cost is small relative to complexity and callback risk.

**Design options (choose one)**

| Model | Authority | Callback read path |
|-------|-----------|-------------------|
| **KV authority** | Ciphertext only in KV | DO holds `ref`, `ticketId`, `conversationId`; actions always `getText` from KV |
| **DO authority** | Ciphertext in DO until delivered, then KV | `loadConversationForAction` reads DO first, falls back to KV |

**Lifecycle state machine**

```
pending:   ciphertext in authority store (+ optional mirror during migration)
delivered: DO entry marked delivered; KV holds connection metadata (cleared payload encrypt)
callback:  documented single read path; dual-read fallback for pre-migration rows
```

**Files likely touched**

- `src/bot/commands.ts` (send + `/inbox` delivery)
- `src/utils/inbox.ts` (`loadConversationForAction`)
- `src/bot/inboxDU.ts` (if DO authority)

**Rollback**

Restore duplicate write on send; existing KV entries remain decryptable.

---

### Explicitly out of scope (for now)

- **Queues** between webhook and bot logic — Telegram already gets a fast ACK; adds operational surface.
- **D1** — new binding and schema for problems KV + DO already solve.
- **Skipping KV re-encrypt after delivery** — small CPU win, weakens “ciphertext at rest” consistency.
- **Raising inbox cap without Phase 2** — array model degrades linearly.

---

## Global invariants (every phase)

These must remain true across all migrations:

1. `POST /bot` protected by `BOT_SECRET_KEY` webhook secret.
2. `ticketId` / `conversationId` HKDF derivation unchanged — or versioned with dual-decrypt during transition.
3. No plaintext message bodies in KV or DO storage.
4. Block checks before accepting send and reply.
5. Rate limits (`checkRateLimit`) preserved on send/reply.
6. Inbox cap enforced server-side (currently 50).
7. Inline keyboard `ref` stable after delivery (`rpl:`, `blk:`, `ubl:`, `nnk:` callbacks).
8. User-facing errors stay generic Persian copy — no internal errors in Telegram replies.
9. Never log `ticketId`, `APP_SECURE_KEY`, decrypted payloads, or Telegram tokens.

---

## Migration checklists

### Checklist A — Phase 0 baseline (required before Phase 1+)

- [ ] Manual regression on current `master`: `/start`, deep-link send, `/inbox`, reply, block, unblock, nickname, settings, pause/resume
- [ ] Record p50/p95 webhook duration (dashboard or local)
- [ ] Snapshot test user: DO inbox shape + KV conversation key count (no secrets in notes)
- [ ] `pnpm check` green
- [ ] Note deploy commit SHA / tag before any migration deploy

---

### Checklist B — Phase 1 stats totals

**Pre-deploy**

- [ ] Add `stats:total:newUser` and `stats:total:newConversation`
- [ ] Backfill totals from existing daily keys (script or one-off admin)
- [ ] `getTotalStats` reads totals first; falls back to sum of dailies

**Deploy verification**

- [ ] Homepage numbers match pre-deploy (±0)
- [ ] One new message increments daily key **and** total
- [ ] One new `/start` increments daily newUser **and** total

**Rollback**

- [ ] Revert read path to list-only; daily keys unchanged

---

### Checklist C — Phase 2 SQLite inbox

**Design**

- [x] Wrangler SQLite DO class configured (`InboxSqliteDurableObject`)
- [x] `_sql_schema_migrations` table + version 1 schema applied in constructor
- [x] External routes unchanged (`/add`, `/list`, `/entry`, `/mark-delivered`, `/purge`)
- [x] No legacy KV-array import (fresh SQLite inboxes after migration)

**Test matrix (must pass)**

- [ ] Send text → recipient notification count correct (`pendingCount` from `/add`)
- [ ] Send photo → `/inbox` delivers media + inline keyboard
- [ ] Inbox full (50) → `429` to sender; **no orphan** KV `conversation:*` key
- [ ] `/inbox` on empty pending → correct empty message
- [ ] After delivery: sender receives “seen” notification
- [ ] Reply (`rpl:`) on **delivered** message
- [ ] Block / unblock on delivered message
- [ ] Nickname (`nnk:`) on delivered message
- [ ] Account delete → `/purge` clears SQL inbox
- [ ] Two rapid sends → both queued, order preserved

**Deploy**

- [ ] Deploy during low traffic
- [ ] Monitor DO errors 24–48 h

**Rollback**

- [ ] Revert `inboxDU.ts` and Wrangler migration; redeploy previous Worker version

---

### Checklist D — Phase 3 single ciphertext store

**Pre-conditions**

- [ ] Phase 0 metrics justify effort (document threshold)
- [ ] Phase 2 stable **or** consciously skipped
- [ ] Authority model (KV vs DO) chosen and written in this doc’s appendix

**Implementation**

- [ ] Send path writes authority store only (+ optional mirror one release)
- [ ] `loadConversationForAction` dual-read: authority → fallback for old rows
- [ ] Failed `addInboxEntry` still removes KV conversation (no orphans)

**Test matrix (Phase C +)**

- [ ] Reply after delivery when DO ciphertext cleared
- [ ] Block after delivery
- [ ] Pre-migration messages still support callbacks via fallback
- [ ] Media send + deliver + reply end-to-end

**Rollback**

- [ ] Flag restores duplicate ciphertext on send

---

## Recommended sequencing

```
Today ──► Phase 0 (metrics) ──► optional Phase 1 (stats)
                                    │
                                    ▼ (only if DO/inbox metrics bad)
                              Phase 2 (SQLite inbox)
                                    │
                                    ▼ (only if media/storage metrics bad)
                              Phase 3 (dedupe ciphertext)
```

**Default for a healthy bot:** stop after Phase 0; implement Phase 1 only if homepage stats listing becomes slow.

---

## Related project docs

- `AGENTS.md` — agent rules, crypto flow, KV/DO contracts (update when a phase ships)
- `src/utils/ticket.ts` — encryption implementation
- `src/bot/inboxDU.ts` — `InboxSqliteDurableObject`
- `tools/verify-crypto.ts` — crypto smoke tests (`pnpm test:crypto`)

---

## Appendix — authority model decision (fill before Phase 3)

**Chosen model:** _[ KV authority | DO authority ]_  
**Date decided:** _  
**Threshold that triggered Phase 3:** _  
**Dual-read end date:** _
