import type { Environment } from "../types";

type DailyStatRow = {
  event_name: string;
  count: number;
};

export const getDashboardStats = async (
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
      `SELECT event_name, SUM(count) AS count
       FROM platform_daily_stats
       WHERE event_name IN ('messages_relayed', 'assessment_completions', 'match_requests')
       GROUP BY event_name`
    )
      .all<DailyStatRow>()
      .then((result) => result.results ?? [])
      .catch(() => []),
  ]);

  const counts = new Map<string, number>();
  for (const row of aggregateRows) {
    counts.set(row.event_name, row.count ?? 0);
  }

  return {
    usersCount: usersCountRow?.count ?? 0,
    conversationsCount: counts.get("messages_relayed") ?? 0,
    assessmentProfilesCount: counts.get("assessment_completions") ?? 0,
    discoverableProfilesCount: discoverableProfilesRow?.count ?? 0,
    matchRequestsCount: counts.get("match_requests") ?? 0,
  };
};
