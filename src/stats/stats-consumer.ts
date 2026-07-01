import type { Environment } from "../types";
import type { StatsEvent } from "./events";

const dayKey = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

const ensureStatsSchema = async (env: Environment): Promise<void> => {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS platform_daily_stats (
         day TEXT NOT NULL,
         event_name TEXT NOT NULL,
         count INTEGER NOT NULL DEFAULT 0,
         updated_at INTEGER NOT NULL,
         PRIMARY KEY (day, event_name)
       )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS platform_daily_stats_by_key (
         day TEXT NOT NULL,
         event_name TEXT NOT NULL,
         stat_key TEXT NOT NULL,
         count INTEGER NOT NULL DEFAULT 0,
         updated_at INTEGER NOT NULL,
         PRIMARY KEY (day, event_name, stat_key)
       )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS platform_daily_unique_stats (
         day TEXT NOT NULL,
         event_name TEXT NOT NULL,
         unique_hash TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         PRIMARY KEY (day, event_name, unique_hash)
       )`
    ),
  ]);
};

export const handleStatsBatch = async (
  batch: MessageBatch<StatsEvent>,
  env: Environment
): Promise<void> => {
  await ensureStatsSchema(env);
  const now = Date.now();

  for (const message of batch.messages) {
    const event = message.body;
    const at = Number.isFinite(event.at) ? event.at : now;
    const day = dayKey(at);

    try {
      const writes: D1PreparedStatement[] = [
        env.DB.prepare(
          `INSERT INTO platform_daily_stats (day, event_name, count, updated_at)
           VALUES (?, ?, 1, ?)
           ON CONFLICT(day, event_name)
           DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`
        ).bind(day, event.eventName, now),
      ];

      if (event.statKey) {
        writes.push(
          env.DB.prepare(
            `INSERT INTO platform_daily_stats_by_key (day, event_name, stat_key, count, updated_at)
             VALUES (?, ?, ?, 1, ?)
             ON CONFLICT(day, event_name, stat_key)
             DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`
          ).bind(day, event.eventName, event.statKey, now)
        );
      }

      if (event.uniqueHash) {
        writes.push(
          env.DB.prepare(
            `INSERT OR IGNORE INTO platform_daily_unique_stats (day, event_name, unique_hash, created_at)
             VALUES (?, ?, ?, ?)`
          ).bind(day, event.eventName, event.uniqueHash, at)
        );
      }

      await env.DB.batch(writes);
      message.ack();
    } catch {
      message.retry();
    }
  }
};
