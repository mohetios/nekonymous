import type { Environment } from "../../types";

const nowMs = (): number => Date.now();

export const upsertConversationSummary = async (
  env: Environment,
  conversationId: string,
  userAId: string,
  userBId: string
): Promise<void> => {
  const now = nowMs();
  await env.DB.prepare(
    `INSERT INTO conversations (
      id, type, user_a_id, user_b_id, status,
      message_count, report_count, last_event_at,
      created_at, updated_at
    ) VALUES (?, 'anonymous_relay', ?, ?, 'active', 1, 0, ?, ?, ?)
    ON CONFLICT(user_a_id, user_b_id, type) DO UPDATE SET
      message_count = message_count + 1,
      last_event_at = excluded.last_event_at,
      updated_at = excluded.updated_at`
  )
    .bind(conversationId, userAId, userBId, now, now, now)
    .run();
};

export const getPublicStats = async (
  env: Environment
): Promise<{
  usersCount: number;
  conversationsCount: number;
  assessmentProfilesCount: number;
  discoverableProfilesCount: number;
  matchRequestsCount: number;
}> => {
  const count = async (sql: string): Promise<number> => {
    try {
      const row = await env.DB.prepare(sql).first<{ count: number }>();
      return row?.count ?? 0;
    } catch {
      return 0;
    }
  };

  const [
    usersCount,
    conversationsCount,
    assessmentProfilesCount,
    discoverableProfilesCount,
    matchRequestsCount,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
    count("SELECT COALESCE(SUM(message_count), 0) AS count FROM conversations"),
    count("SELECT COUNT(*) AS count FROM assessment_profiles WHERE status = 'completed'"),
    count("SELECT COUNT(*) AS count FROM assessment_profiles WHERE discoverable = 1"),
    count("SELECT COUNT(*) AS count FROM match_requests"),
  ]);

  return {
    usersCount,
    conversationsCount,
    assessmentProfilesCount,
    discoverableProfilesCount,
    matchRequestsCount,
  };
};
