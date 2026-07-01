import type { Environment } from "../types";
import { isStatsEventName, type StatsEvent } from "./events";

const dayKey = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

const safeStatKey = (statKey?: string): string | undefined => {
  if (!statKey) {
    return undefined;
  }
  const normalized = statKey.trim().slice(0, 64);
  return normalized.length > 0 ? normalized : undefined;
};

const safeUniqueHash = (uniqueHash?: string): string | undefined => {
  if (!uniqueHash) {
    return undefined;
  }
  const normalized = uniqueHash.trim().slice(0, 128);
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
  return {
    eventName: record.eventName,
    at: record.at,
    ...(safeStatKey(record.statKey) ? { statKey: safeStatKey(record.statKey) } : {}),
    ...(safeUniqueHash(record.uniqueHash)
      ? { uniqueHash: safeUniqueHash(record.uniqueHash) }
      : {}),
  };
};

export const handleStatsBatch = async (
  batch: MessageBatch<StatsEvent>,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  const counters = new Map<string, number>();
  const keyedCounters = new Map<string, number>();
  const uniques: Array<{
    day: string;
    eventName: string;
    uniqueHash: string;
    createdAt: number;
  }> = [];

  for (const message of batch.messages) {
    const event = parseStatEvent(message.body);
    if (!event) {
      message.ack();
      continue;
    }

    const day = dayKey(event.at);
    const counterKey = `${day}\0${event.eventName}`;
    counters.set(counterKey, (counters.get(counterKey) ?? 0) + 1);

    if (event.statKey) {
      const keyed = `${day}\0${event.eventName}\0${event.statKey}`;
      keyedCounters.set(keyed, (keyedCounters.get(keyed) ?? 0) + 1);
    }

    if (event.uniqueHash) {
      uniques.push({
        day,
        eventName: event.eventName,
        uniqueHash: event.uniqueHash,
        createdAt: now,
      });
    }
  }

  const statements: D1PreparedStatement[] = [];

  for (const [compoundKey, count] of counters) {
    const [day, eventName] = compoundKey.split("\0");
    statements.push(
      env.DB.prepare(
        `INSERT INTO platform_daily_stats (day, event_name, count, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(day, event_name)
         DO UPDATE SET
           count = count + excluded.count,
           updated_at = excluded.updated_at`
      ).bind(day, eventName, count, now)
    );
  }

  for (const [compoundKey, count] of keyedCounters) {
    const [day, eventName, statKey] = compoundKey.split("\0");
    statements.push(
      env.DB.prepare(
        `INSERT INTO platform_daily_stats_by_key (day, event_name, stat_key, count, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(day, event_name, stat_key)
         DO UPDATE SET
           count = count + excluded.count,
           updated_at = excluded.updated_at`
      ).bind(day, eventName, statKey, count, now)
    );
  }

  for (const unique of uniques) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO platform_daily_unique_stats (day, event_name, unique_hash, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(unique.day, unique.eventName, unique.uniqueHash, unique.createdAt)
    );
  }

  if (statements.length > 0) {
    try {
      await env.DB.batch(statements);
      batch.ackAll();
    } catch {
      for (const message of batch.messages) {
        message.retry();
      }
    }
    return;
  }

  batch.ackAll();
};
