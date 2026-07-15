import type { Environment } from "../contracts/runtime";
import { isStatsEventName, type StatsEvent } from "../contracts/stats/events";

const STATS_RECEIPT_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;
const STATS_RECEIPT_CLEANUP_LIMIT = 500;

const dayKey = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

const safeStatKey = (statKey?: unknown): string | undefined => {
  if (typeof statKey !== "string") {
    return undefined;
  }
  const normalized = statKey.trim().slice(0, 64);
  return normalized.length > 0 ? normalized : undefined;
};

const safeUniqueHash = (uniqueHash?: unknown): string | undefined => {
  if (typeof uniqueHash !== "string") {
    return undefined;
  }
  const normalized = uniqueHash.trim().slice(0, 128);
  return normalized.length > 0 ? normalized : undefined;
};

const parseCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
};

const safeEventId = (eventId?: unknown): string | undefined => {
  if (typeof eventId !== "string") {
    return undefined;
  }
  const normalized = eventId.trim().slice(0, 128);
  return normalized.length > 0 ? normalized : undefined;
};

const parseStatEvent = (body: unknown): StatsEvent | null => {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as StatsEvent;
  if (!isStatsEventName(record.eventName)) {
    return null;
  }
  if (!Number.isFinite(record.at)) {
    return null;
  }
  const eventId = safeEventId(record.eventId);
  if (!eventId) {
    return null;
  }
  const statKey = safeStatKey(record.statKey);
  const uniqueHash = safeUniqueHash(record.uniqueHash);
  return {
    eventId,
    eventName: record.eventName,
    at: record.at,
    count: parseCount(record.count),
    ...(statKey ? { statKey } : {}),
    ...(uniqueHash ? { uniqueHash } : {}),
  };
};

export const handleStatsBatch = async (
  batch: MessageBatch<StatsEvent>,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  const events: StatsEvent[] = [];
  const retryableMessages: Array<(typeof batch.messages)[number]> = [];

  for (const message of batch.messages) {
    const event = parseStatEvent(message.body);
    if (!event) {
      message.ack();
      continue;
    }
    events.push(event);
    retryableMessages.push(message);
  }

  const statements: D1PreparedStatement[] = [];

  if (events.length > 0) {
    statements.push(
      env.DB.prepare(
        `DELETE FROM platform_stats_event_receipts
         WHERE event_id IN (
           SELECT event_id FROM platform_stats_event_receipts
           WHERE created_at <= ?
           ORDER BY created_at ASC
           LIMIT ${STATS_RECEIPT_CLEANUP_LIMIT}
         )`
      ).bind(now - STATS_RECEIPT_RETENTION_MS)
    );
  }

  for (const event of events) {
    const day = dayKey(event.at);
    const increment = event.count ?? 1;

    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO platform_stats_event_receipts (
           event_id, day, event_name, created_at
         ) VALUES (?, ?, ?, ?)`
      ).bind(event.eventId, day, event.eventName, now)
    );

    // `changes()` is scoped to the immediately preceding receipt insert.
    // Duplicate Queue deliveries therefore skip every counter statement below.
    statements.push(
      env.DB.prepare(
        `INSERT INTO platform_daily_stats (day, event_name, count, updated_at)
         SELECT ?, ?, ?, ?
         WHERE changes() > 0
         ON CONFLICT(day, event_name)
         DO UPDATE SET
           count = count + excluded.count,
           updated_at = excluded.updated_at`
      ).bind(day, event.eventName, increment, now)
    );

    if (event.statKey) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO platform_daily_stats_by_key (
             day, event_name, stat_key, count, updated_at
           )
           SELECT ?, ?, ?, ?, ?
           WHERE changes() > 0
           ON CONFLICT(day, event_name, stat_key)
           DO UPDATE SET
             count = count + excluded.count,
             updated_at = excluded.updated_at`
        ).bind(day, event.eventName, event.statKey, increment, now)
      );
    }

    if (event.uniqueHash) {
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO platform_daily_unique_stats (
             day, event_name, unique_hash, created_at
           )
           SELECT ?, ?, ?, ?
           WHERE changes() > 0`
        ).bind(day, event.eventName, event.uniqueHash, now)
      );
    }
  }

  if (statements.length > 0) {
    try {
      await env.DB.batch(statements);
      batch.ackAll();
    } catch {
      for (const message of retryableMessages) {
        message.retry();
      }
    }
    return;
  }

  batch.ackAll();
};
