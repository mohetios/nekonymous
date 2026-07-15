import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleStatsBatch } from "../src/stats/stats-consumer";
import { STAT_EVENTS, type StatsEvent } from "../src/contracts/stats/events";

const TEST_DAY = "2026-01-02";
const TEST_AT = Date.parse(`${TEST_DAY}T00:00:00.000Z`);

const ensureStatsTables = async (): Promise<void> => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS platform_daily_stats (day TEXT NOT NULL, event_name TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (day, event_name))"
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS platform_daily_stats_by_key (day TEXT NOT NULL, event_name TEXT NOT NULL, stat_key TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (day, event_name, stat_key))"
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS platform_daily_unique_stats (day TEXT NOT NULL, event_name TEXT NOT NULL, unique_hash TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (day, event_name, unique_hash))"
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS platform_stats_event_receipts (event_id TEXT PRIMARY KEY, day TEXT NOT NULL, event_name TEXT NOT NULL, created_at INTEGER NOT NULL)"
  );
};

const cleanupStatsDay = async (): Promise<void> => {
  await ensureStatsTables();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM platform_daily_stats WHERE day = ?").bind(
      TEST_DAY
    ),
    env.DB.prepare("DELETE FROM platform_daily_stats_by_key WHERE day = ?").bind(
      TEST_DAY
    ),
    env.DB.prepare("DELETE FROM platform_daily_unique_stats WHERE day = ?").bind(
      TEST_DAY
    ),
    env.DB.prepare("DELETE FROM platform_stats_event_receipts WHERE day = ?").bind(
      TEST_DAY
    ),
  ]);
};

type StatsBatchBody = StatsEvent | Record<string, unknown>;
type TestStatsBatch = {
  readonly acked: number;
} & Pick<
  MessageBatch<StatsEvent>,
  "queue" | "messages" | "ackAll" | "retryAll"
>;

const makeBatch = (events: StatsBatchBody[]): TestStatsBatch => {
  let acked = 0;
  const messages = events.map((event, index) => ({
    id: `stats-${index}`,
    timestamp: new Date(TEST_AT),
    body: event as StatsEvent,
    attempts: 1,
    ack: () => {
      acked += 1;
    },
    retry: () => undefined,
  }));

  return {
    queue: "neko-stats",
    messages,
    ackAll: () => {
      acked = messages.length;
    },
    retryAll: () => undefined,
    get acked() {
      return acked;
    },
  } as TestStatsBatch;
};

describe("stats consumer", () => {
  it("deduplicates repeated queue delivery by event id", async () => {
    await cleanupStatsDay();

    const event: StatsEvent = {
      eventId: "vitest:stats:dedupe",
      eventName: STAT_EVENTS.REPORT_CREATED,
      at: TEST_AT,
      count: 2,
      statKey: "inbox_report",
      uniqueHash: "vitest-unique-reporter",
    };

    await handleStatsBatch(makeBatch([event]) as MessageBatch<StatsEvent>, env);
    await handleStatsBatch(makeBatch([event]) as MessageBatch<StatsEvent>, env);

    const daily = await env.DB.prepare(
      `SELECT count FROM platform_daily_stats
       WHERE day = ? AND event_name = ?`
    )
      .bind(TEST_DAY, STAT_EVENTS.REPORT_CREATED)
      .first<{ count: number }>();

    const keyed = await env.DB.prepare(
      `SELECT count FROM platform_daily_stats_by_key
       WHERE day = ? AND event_name = ? AND stat_key = ?`
    )
      .bind(TEST_DAY, STAT_EVENTS.REPORT_CREATED, "inbox_report")
      .first<{ count: number }>();

    const uniques = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM platform_daily_unique_stats
       WHERE day = ? AND event_name = ? AND unique_hash = ?`
    )
      .bind(TEST_DAY, STAT_EVENTS.REPORT_CREATED, "vitest-unique-reporter")
      .first<{ count: number }>();

    const receipts = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM platform_stats_event_receipts
       WHERE day = ? AND event_id = ?`
    )
      .bind(TEST_DAY, event.eventId)
      .first<{ count: number }>();

    expect(daily?.count).toBe(2);
    expect(keyed?.count).toBe(2);
    expect(uniques?.count).toBe(1);
    expect(receipts?.count).toBe(1);
  });

  it("rejects events without producer event ids", async () => {
    await cleanupStatsDay();

    const batch = makeBatch([
      {
        eventName: STAT_EVENTS.REPORT_CREATED,
        at: TEST_AT,
        count: 1,
      },
    ]);

    await handleStatsBatch(batch as MessageBatch<StatsEvent>, env);

    const daily = await env.DB.prepare(
      `SELECT count FROM platform_daily_stats
       WHERE day = ? AND event_name = ?`
    )
      .bind(TEST_DAY, STAT_EVENTS.REPORT_CREATED)
      .first<{ count: number }>();

    const receipts = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM platform_stats_event_receipts
       WHERE day = ?`
    )
      .bind(TEST_DAY)
      .first<{ count: number }>();

    expect(daily).toBeNull();
    expect(receipts?.count).toBe(0);
    expect(batch.acked).toBe(1);
  });
});
