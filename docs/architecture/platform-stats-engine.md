# Platform stats engine

**Status:** current architecture reference — implemented in V2.

Anonymous aggregate counters for product health. No message bodies, ticket routes, Telegram ids, or per-user timelines.

For privacy limits see [threat-model.md](../security/threat-model.md).

## Pipeline

```text
Handler / middleware
  → record*() in src/stats/product-events.ts
  → emitStat() → NEKO_STATS_QUEUE (neko-stats)
  → handleStatsBatch() in src/stats/stats-consumer.ts
  → D1 upsert (platform_daily_stats, platform_daily_stats_by_key, platform_daily_unique_stats)
  → getPublicBotStats() in src/stats/stats-reader.ts (+ 60s KV cache)
  → formatPublicBotStatsMessage() → settings stats page
```

Queue consumer: `src/index.ts` routes `neko-stats` → `handleStatsBatch`.

Wrangler: batch size 50, 5s timeout, DLQ `neko-dlq`.

## Design rules

- **Best-effort:** `emitStat` swallows queue failures; stats must never break user flows.
- **No DO reads in public stats:** reader queries D1 aggregates + KV cache only.
- **No forbidden KV keys:** public cache uses `cache:public-bot-stats:v2:{day}` — not `stats:`.
- **Unique daily actives:** `user_active` uses HMAC(`stats:active:{day}:{telegram_user_hash}`) → `platform_daily_unique_stats`.
- **Keyed reports:** `report_created` may include optional `statKey` (e.g. `inbox_report`) → `platform_daily_stats_by_key`.
- **UserStateDO is not the stats authority:** inbox/state lives in DO; counters live in D1 via queue.

## Event catalog

| Event | Emitter | Public stats page |
|-------|---------|-------------------|
| `user_created` | `identity-service` | Yes — new users |
| `user_active` | rate-limit middleware (`emit-user-active`) | Yes — unique DAU |
| `link_created` | `identity-service` | Yes |
| `link_opened` | `messaging-commands` (`/start {slug}`) | Internal only |
| `message_created` | `create-sealed-ticket` | Yes — messages sent |
| `message_delivered` | `render-inbox` | Yes — reply rate input |
| `message_expired` | `render-inbox` (inbox pointer cleanup) | Yes |
| `inbox_opened` | `render-inbox` | Yes |
| `reply_sent` | `messaging-commands` | Yes |
| `block_created` | `messaging-actions` | Yes (bucketed) |
| `report_created` | `messaging-actions` | Yes (bucketed) |
| `profile_started` | `profile-handlers` | Internal only |
| `profile_completed` | `profile-handlers` | Yes — assessments |
| `profile_index_requested` | `profile-service` | Internal only |
| `profile_indexed` | `profile-index-consumer` | Internal only |
| `profile_index_failed` | `profile-index-consumer` | Internal only |
| `discoverability_enabled` / `disabled` | `profile-service` | Internal only |
| `suggestion_search` / `shown` / `dismissed` | suggestion handlers/service | Search only on public page |
| `request_sent` / `accepted` / `declined` / `canceled` | `request-service` | Internal only |
| `pause_enabled` / `disabled`, `hard_reset` | `settings-handlers` | Internal only |

Legacy names kept for pre-V2 D1 rows: `assessment_started`, `assessment_completed` (reader sums `profile_completed` + `assessment_completed`).

**Not counted:** lazy expiry of suggestion/request capabilities (no durable transition event). Terminal actions (`dismissed`, `declined`, `canceled`) are counted instead.

## Module map

| File | Role |
|------|------|
| `src/stats/events.ts` | Event name constants |
| `src/stats/emit-stat.ts` | Queue producer |
| `src/stats/product-events.ts` | `record*()` helpers — **single entry point for features** |
| `src/stats/emit-user-active.ts` | Daily unique active hash |
| `src/stats/stats-consumer.ts` | Queue batch → D1 |
| `src/stats/stats-reader.ts` | D1 + KV → `PublicBotStats` |
| `src/stats/stats-format.ts` | Persian HTML for `/settings` stats |
| `src/features/settings/render-stats-page.ts` | Telegram stats screen |

## D1 tables

Defined in `migrations/0001_init.sql`:

- `platform_daily_stats(day, event_name, count)` — primary counters
- `platform_daily_stats_by_key(day, event_name, stat_key, count)` — optional breakdown
- `platform_daily_unique_stats(day, event_name, unique_hash)` — daily uniques (`INSERT OR IGNORE`)

## Verification

```bash
pnpm test:stats
```

Static checks in `tools/verify-stats.ts`: formatter privacy, reader isolation, product-event wiring, profile completion ↔ reader alignment.

## Adding a new stat

1. Add name to `STAT_EVENTS` in `events.ts`.
2. Add `recordFoo()` in `product-events.ts`.
3. Call `recordFoo(env)` from the feature handler (never call `emitStat` directly outside `src/stats/`).
4. If the stat should appear on the public settings page, extend `getPublicBotStats` + `formatPublicBotStatsMessage`.
5. Extend `tools/verify-stats.ts` if the wiring is non-obvious.
