import type { Environment } from "../types";
import { STAT_EVENTS } from "./events";

export type PeriodCounts = {
  today: number;
  days7: number;
  days30: number;
};

export type PublicBotStats = {
  totalUsers: number | null;
  hasDailyData: boolean;
  hasActiveUsers: boolean;
  newUsers: PeriodCounts;
  activeUsers: PeriodCounts;
  messages: PeriodCounts;
  replies: PeriodCounts;
  reports: PeriodCounts;
  linksCreated: PeriodCounts;
  inboxOpens: PeriodCounts;
  assessmentsCompleted: PeriodCounts;
  suggestionSearches: PeriodCounts;
  messagesDelivered7d: number;
  messagesCreated7d: number;
  generatedAt: number;
};

type DailyStatRow = {
  event_name: string;
  total: number;
};

const utcDay = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

const shiftUtcDay = (day: string, deltaDays: number): string => {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + deltaDays));
  return shifted.toISOString().slice(0, 10);
};

const buildPeriodCounts = (
  rows: DailyStatRow[],
  eventNames: string[],
  today: string,
  day7: string,
  day30: string
): PeriodCounts => {
  const sumForRange = (fromDay: string, toDay: string): number => {
    let total = 0;
    for (const row of rows) {
      if (!eventNames.includes(row.event_name)) {
        continue;
      }
      const day = (row as DailyStatRow & { day?: string }).day;
      if (!day || day < fromDay || day > toDay) {
        continue;
      }
      total += row.total ?? 0;
    }
    return total;
  };

  return {
    today: sumForRange(today, today),
    days7: sumForRange(day7, today),
    days30: sumForRange(day30, today),
  };
};

const MESSAGE_EVENT_NAMES = [
  STAT_EVENTS.MESSAGE_CREATED,
  STAT_EVENTS.MESSAGES_RELAYED,
];

const ASSESSMENT_EVENT_NAMES = [
  STAT_EVENTS.ASSESSMENT_COMPLETED,
  STAT_EVENTS.ASSESSMENT_COMPLETIONS,
];

export const getPublicBotStats = async (
  env: Environment
): Promise<PublicBotStats> => {
  const generatedAt = Date.now();
  const today = utcDay(generatedAt);
  const day7 = shiftUtcDay(today, -6);
  const day30 = shiftUtcDay(today, -29);

  const trackedEvents = [
    STAT_EVENTS.USER_CREATED,
    STAT_EVENTS.MESSAGE_CREATED,
    STAT_EVENTS.MESSAGES_RELAYED,
    STAT_EVENTS.MESSAGE_DELIVERED,
    STAT_EVENTS.REPLY_SENT,
    STAT_EVENTS.REPORT_CREATED,
    STAT_EVENTS.LINK_CREATED,
    STAT_EVENTS.INBOX_OPENED,
    STAT_EVENTS.ASSESSMENT_COMPLETED,
    STAT_EVENTS.ASSESSMENT_COMPLETIONS,
    STAT_EVENTS.SUGGESTION_SEARCH,
  ];

  const placeholders = trackedEvents.map(() => "?").join(", ");

  const [usersCountRow, dailyRows, activeTodayRow, active7Row, active30Row] =
    await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM users WHERE status = 'active'"
      ).first<{ count: number }>(),
      env.DB.prepare(
        `SELECT day, event_name, SUM(count) AS total
         FROM platform_daily_stats
         WHERE day >= ? AND day <= ?
           AND event_name IN (${placeholders})
         GROUP BY day, event_name`
      )
        .bind(day30, today, ...trackedEvents)
        .all<DailyStatRow & { day: string }>()
        .then((result) => result.results ?? []),
      env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM platform_daily_unique_stats
         WHERE day = ? AND event_name = ?`
      )
        .bind(today, STAT_EVENTS.USER_ACTIVE)
        .first<{ count: number }>()
        .catch(() => null),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT unique_hash) AS count
         FROM platform_daily_unique_stats
         WHERE day >= ? AND day <= ? AND event_name = ?`
      )
        .bind(day7, today, STAT_EVENTS.USER_ACTIVE)
        .first<{ count: number }>()
        .catch(() => null),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT unique_hash) AS count
         FROM platform_daily_unique_stats
         WHERE day >= ? AND day <= ? AND event_name = ?`
      )
        .bind(day30, today, STAT_EVENTS.USER_ACTIVE)
        .first<{ count: number }>()
        .catch(() => null),
    ]);

  const hasDailyData = dailyRows.length > 0;
  const hasActiveUsers =
    activeTodayRow !== null && active7Row !== null && active30Row !== null;

  const messagesDelivered7d = buildPeriodCounts(
    dailyRows,
    [STAT_EVENTS.MESSAGE_DELIVERED],
    today,
    day7,
    day30
  ).days7;

  const messagesCreated7d = buildPeriodCounts(
    dailyRows,
    MESSAGE_EVENT_NAMES,
    today,
    day7,
    day30
  ).days7;

  return {
    totalUsers: usersCountRow?.count ?? null,
    hasDailyData,
    hasActiveUsers,
    newUsers: buildPeriodCounts(
      dailyRows,
      [STAT_EVENTS.USER_CREATED],
      today,
      day7,
      day30
    ),
    activeUsers: hasActiveUsers
      ? {
          today: activeTodayRow?.count ?? 0,
          days7: active7Row?.count ?? 0,
          days30: active30Row?.count ?? 0,
        }
      : { today: 0, days7: 0, days30: 0 },
    messages: buildPeriodCounts(
      dailyRows,
      MESSAGE_EVENT_NAMES,
      today,
      day7,
      day30
    ),
    replies: buildPeriodCounts(
      dailyRows,
      [STAT_EVENTS.REPLY_SENT],
      today,
      day7,
      day30
    ),
    reports: buildPeriodCounts(
      dailyRows,
      [STAT_EVENTS.REPORT_CREATED],
      today,
      day7,
      day30
    ),
    linksCreated: buildPeriodCounts(
      dailyRows,
      [STAT_EVENTS.LINK_CREATED],
      today,
      day7,
      day30
    ),
    inboxOpens: buildPeriodCounts(
      dailyRows,
      [STAT_EVENTS.INBOX_OPENED],
      today,
      day7,
      day30
    ),
    assessmentsCompleted: buildPeriodCounts(
      dailyRows,
      ASSESSMENT_EVENT_NAMES,
      today,
      day7,
      day30
    ),
    suggestionSearches: buildPeriodCounts(
      dailyRows,
      [STAT_EVENTS.SUGGESTION_SEARCH],
      today,
      day7,
      day30
    ),
    messagesDelivered7d,
    messagesCreated7d,
    generatedAt,
  };
};
