import type { Environment } from "../../types";
import { emitStat } from "../../stats/emit-stat";
import { STAT_EVENTS, type StatsEventName } from "../../stats/events";

type LegacyPlatformStatField =
  | "messages_relayed"
  | "assessment_completions"
  | "match_requests";

type PlatformStatField =
  | LegacyPlatformStatField
  | typeof STAT_EVENTS.MESSAGE_CREATED
  | typeof STAT_EVENTS.ASSESSMENT_COMPLETED
  | typeof STAT_EVENTS.REQUEST_SENT;

const LEGACY_EVENT_MAP: Record<LegacyPlatformStatField, StatsEventName> = {
  messages_relayed: STAT_EVENTS.MESSAGE_CREATED,
  assessment_completions: STAT_EVENTS.ASSESSMENT_COMPLETED,
  match_requests: STAT_EVENTS.REQUEST_SENT,
};

const resolveEventName = (field: PlatformStatField): StatsEventName => {
  if (field in LEGACY_EVENT_MAP) {
    return LEGACY_EVENT_MAP[field as LegacyPlatformStatField];
  }
  return field;
};

export const incrementPlatformStat = async (
  env: Environment,
  field: PlatformStatField,
  amount = 1
): Promise<void> => {
  if (amount <= 0) {
    return;
  }
  const eventName = resolveEventName(field);
  for (let i = 0; i < amount; i += 1) {
    await emitStat(env, eventName);
  }
};

export const getPlatformStats = async (
  env: Environment
): Promise<{
  usersCount: number;
  conversationsCount: number;
  assessmentProfilesCount: number;
  discoverableProfilesCount: number;
  matchRequestsCount: number;
}> => {
  const [usersCountRow, discoverableProfilesRow, aggregateRows] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users WHERE status = 'active'"
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM assessment_profiles WHERE discoverable = 1"
    ).first<{ count: number }>(),
    env.DB.prepare(
      `SELECT event_name, SUM(count) AS total
       FROM platform_daily_stats
       WHERE event_name IN (?, ?, ?, ?, ?, ?)
       GROUP BY event_name`
    )
      .bind(
        STAT_EVENTS.MESSAGES_RELAYED,
        STAT_EVENTS.MESSAGE_CREATED,
        STAT_EVENTS.ASSESSMENT_COMPLETIONS,
        STAT_EVENTS.ASSESSMENT_COMPLETED,
        STAT_EVENTS.MATCH_REQUESTS,
        STAT_EVENTS.REQUEST_SENT
      )
      .all<{ event_name: string; total: number }>()
      .then((result) => result.results ?? [])
      .catch(() => []),
  ]);

  const counts = new Map<string, number>();
  for (const row of aggregateRows) {
    counts.set(row.event_name, row.total ?? 0);
  }

  const messages =
    (counts.get(STAT_EVENTS.MESSAGE_CREATED) ?? 0) +
    (counts.get(STAT_EVENTS.MESSAGES_RELAYED) ?? 0);
  const assessments =
    (counts.get(STAT_EVENTS.ASSESSMENT_COMPLETED) ?? 0) +
    (counts.get(STAT_EVENTS.ASSESSMENT_COMPLETIONS) ?? 0);
  const matchRequests =
    (counts.get(STAT_EVENTS.REQUEST_SENT) ?? 0) +
    (counts.get(STAT_EVENTS.MATCH_REQUESTS) ?? 0);

  return {
    usersCount: usersCountRow?.count ?? 0,
    conversationsCount: messages,
    assessmentProfilesCount: assessments,
    discoverableProfilesCount: discoverableProfilesRow?.count ?? 0,
    matchRequestsCount: matchRequests,
  };
};
