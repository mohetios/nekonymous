import type { Environment } from "../../types";
import { generateOpaqueId } from "../../crypto/crypto-service";
import { getUserById } from "../../features/identity/identity-service";
import {
  checkCanReceive,
  getUserStateSafe,
} from "../../storage/user-state-client";
import {
  getMatchProfile,
  setDiscoverable,
  type AssessmentProfileRow,
} from "../assessment/assessment-profile-service";
import { ASSESSMENT_VERSION } from "../assessment/question-bank";
import { updateVectorDiscoverability } from "../assessment/profile-vector-service";
import {
  MATCH_DISMISS_BLOCK_MS,
  MATCH_RECENT_DECLINE_MS,
  MATCH_REQUEST_LIMIT_PER_DAY,
  MATCH_RESULT_COUNT,
  MATCH_SEARCH_LIMIT_PER_HOUR,
  MATCH_SEARCH_TOP_K,
} from "./constants";
import type {
  MatchCandidate,
  MatchDashboard,
  MatchHubMenuVariant,
  MatchSuggestionRow,
} from "./match-types";
import {
  mergeCandidateUserIds,
  pickEligibleCandidates,
  scoreCandidatePool,
} from "./match-selection";
import { queryVectorCandidates } from "./match-vector-service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const recordMatchEvent = async (
  env: Environment,
  input: {
    type: string;
    userId?: string;
    targetUserId?: string;
    matchRequestId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> => {
  await env.DB.prepare(
    `INSERT INTO match_events (id, type, user_id, target_user_id, match_request_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      generateOpaqueId(12),
      input.type,
      input.userId ?? null,
      input.targetUserId ?? null,
      input.matchRequestId ?? null,
      JSON.stringify(input.metadata ?? {}),
      Date.now()
    )
    .run();
};

const countRecentEvents = async (
  env: Environment,
  type: string,
  userId: string,
  sinceMs: number
): Promise<number> => {
  const since = Date.now() - sinceMs;
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM match_events
     WHERE type = ? AND user_id = ? AND created_at >= ?`
  )
    .bind(type, userId, since)
    .first<{ count: number }>();
  return row?.count ?? 0;
};

export const getMatchDashboard = async (
  userId: string,
  env: Environment
): Promise<MatchDashboard> => {
  const profile = await getMatchProfile(userId, env);
  if (!profile || profile.status !== "completed") {
    return { state: "no_profile", discoverable: false };
  }

  if (profile.version !== ASSESSMENT_VERSION) {
    return {
      state: "opt_in_required",
      discoverable: false,
      profileVersion: profile.version,
      vectorStatus: profile.vector_status,
    };
  }

  if (profile.vector_status === "failed") {
    return {
      state: "vector_failed",
      discoverable: profile.discoverable === 1,
      profileVersion: profile.version,
      vectorStatus: profile.vector_status,
    };
  }

  if (profile.vector_status !== "indexed") {
    return {
      state: "vector_pending",
      discoverable: profile.discoverable === 1,
      profileVersion: profile.version,
      vectorStatus: profile.vector_status,
    };
  }

  if (profile.discoverable !== 1) {
    return {
      state: "opt_in_required",
      discoverable: false,
      profileVersion: profile.version,
      vectorStatus: profile.vector_status,
    };
  }

  if (profile.safety_tier !== "normal") {
    return {
      state: "opt_in_required",
      discoverable: false,
      profileVersion: profile.version,
      vectorStatus: profile.vector_status,
    };
  }

  return {
    state: "ready",
    discoverable: true,
    profileVersion: profile.version,
    vectorStatus: profile.vector_status,
  };
};

export const resolveMatchHubMenuVariant = async (
  userId: string,
  env: Environment
): Promise<MatchHubMenuVariant> => {
  const dashboard = await getMatchDashboard(userId, env);
  if (dashboard.state === "ready" && dashboard.discoverable) {
    return "can_disable";
  }

  if (dashboard.state === "opt_in_required") {
    const profile = await getMatchProfile(userId, env);
    if (
      profile &&
      profile.status === "completed" &&
      profile.vector_status === "indexed" &&
      profile.safety_tier === "normal"
    ) {
      return "can_enable";
    }
  }

  return "default";
};

const canEnableDiscoverability = (profile: AssessmentProfileRow): boolean =>
  profile.status === "completed" &&
  profile.vector_status === "indexed" &&
  profile.safety_tier === "normal";

export const enableDiscoverability = async (
  userId: string,
  env: Environment
): Promise<{ ok: boolean; reason?: string }> => {
  const profile = await getMatchProfile(userId, env);
  if (!profile || !canEnableDiscoverability(profile)) {
    return { ok: false, reason: "not_ready" };
  }

  await setDiscoverable(userId, true, env);
  await updateVectorDiscoverability(userId, true, env);
  await recordMatchEvent(env, {
    type: "discoverable_enabled",
    userId,
  });

  return { ok: true };
};

export const disableDiscoverability = async (
  userId: string,
  env: Environment
): Promise<void> => {
  await setDiscoverable(userId, false, env);
  await updateVectorDiscoverability(userId, false, env);
  await recordMatchEvent(env, {
    type: "discoverable_disabled",
    userId,
  });
};

const loadCandidateProfiles = async (
  userIds: string[],
  env: Environment
): Promise<Map<string, AssessmentProfileRow>> => {
  const map = new Map<string, AssessmentProfileRow>();
  if (userIds.length === 0) {
    return map;
  }

  const placeholders = userIds.map(() => "?").join(", ");
  const rows = await env.DB.prepare(
    `SELECT * FROM assessment_profiles
     WHERE user_id IN (${placeholders})
       AND status = 'completed'
       AND version = ?
       AND discoverable = 1
       AND vector_status = 'indexed'
       AND safety_tier = 'normal'`
  )
    .bind(...userIds, ASSESSMENT_VERSION)
    .all<AssessmentProfileRow>();

  for (const row of rows.results ?? []) {
    map.set(row.user_id, row);
  }
  return map;
};

const fetchD1FallbackProfiles = async (
  requesterId: string,
  env: Environment
): Promise<AssessmentProfileRow[]> => {
  const rows = await env.DB.prepare(
    `SELECT * FROM assessment_profiles
     WHERE discoverable = 1
       AND status = 'completed'
       AND version = ?
       AND user_id != ?
       AND safety_tier = 'normal'
     ORDER BY updated_at DESC
     LIMIT ?`
  )
    .bind(ASSESSMENT_VERSION, requesterId, MATCH_SEARCH_TOP_K)
    .all<AssessmentProfileRow>();

  return rows.results ?? [];
};

const buildProfilesById = async (
  pool: Map<string, number | undefined>,
  d1Profiles: AssessmentProfileRow[],
  env: Environment
): Promise<Map<string, AssessmentProfileRow>> => {
  const profilesById = new Map<string, AssessmentProfileRow>();

  for (const row of d1Profiles) {
    profilesById.set(row.user_id, row);
  }

  const missingIds = [...pool.keys()].filter((id) => !profilesById.has(id));
  if (missingIds.length > 0) {
    const extra = await loadCandidateProfiles(missingIds, env);
    for (const [userId, profile] of extra) {
      profilesById.set(userId, profile);
    }
  }

  return profilesById;
};

/** Declined/accepted cooldown on outbound requests (search + create). */
const hasRecentPairCooldown = async (
  env: Environment,
  requesterId: string,
  candidateId: string
): Promise<boolean> => {
  const since = Date.now() - MATCH_RECENT_DECLINE_MS;
  const row = await env.DB.prepare(
    `SELECT id FROM match_requests
     WHERE requester_user_id = ? AND candidate_user_id = ?
       AND status IN ('declined', 'accepted')
       AND created_at >= ?
     LIMIT 1`
  )
    .bind(requesterId, candidateId, since)
    .first<{ id: string }>();
  return !!row;
};

/** Any pending request between two users (either direction). */
export const hasPendingMatchBetweenUsers = async (
  env: Environment,
  userA: string,
  userB: string,
  excludeRequestId?: string
): Promise<boolean> => {
  if (excludeRequestId) {
    const row = await env.DB.prepare(
      `SELECT id FROM match_requests
       WHERE status = 'pending'
         AND id != ?
         AND (
           (requester_user_id = ? AND candidate_user_id = ?)
           OR (requester_user_id = ? AND candidate_user_id = ?)
         )
       LIMIT 1`
    )
      .bind(excludeRequestId, userA, userB, userB, userA)
      .first<{ id: string }>();
    return !!row;
  }

  const row = await env.DB.prepare(
    `SELECT id FROM match_requests
     WHERE status = 'pending'
       AND (
         (requester_user_id = ? AND candidate_user_id = ?)
         OR (requester_user_id = ? AND candidate_user_id = ?)
       )
     LIMIT 1`
  )
    .bind(userA, userB, userB, userA)
    .first<{ id: string }>();
  return !!row;
};

const isMatchBlocked = async (
  env: Environment,
  userId: string,
  otherUserId: string
): Promise<boolean> => {
  const since = Date.now() - MATCH_DISMISS_BLOCK_MS;
  const row = await env.DB.prepare(
    `SELECT user_id FROM match_blocks
     WHERE user_id = ? AND blocked_user_id = ? AND created_at >= ?`
  )
    .bind(userId, otherUserId, since)
    .first<{ user_id: string }>();
  return !!row;
};

const isMessagingBlocked = async (
  env: Environment,
  requesterId: string,
  candidateId: string,
  requesterState?: Awaited<ReturnType<typeof getUserStateSafe>>
): Promise<boolean> => {
  const requester =
    requesterState ?? (await getUserStateSafe(env, requesterId));
  const candidateReceive = await checkCanReceive(env, candidateId, requesterId);

  if (!candidateReceive.ok) {
    return true;
  }

  if (
    requester.blockedUserIds.includes(candidateId) ||
    candidateReceive.reason === "blocked"
  ) {
    return true;
  }

  const candidateState = await getUserStateSafe(env, candidateId);
  if (candidateState.blockedUserIds.includes(requesterId)) {
    return true;
  }

  return false;
};

const hasOpenReport = async (
  env: Environment,
  userA: string,
  userB: string
): Promise<boolean> => {
  const row = await env.DB.prepare(
    `SELECT id FROM reports
     WHERE status = 'open'
       AND (
         (reporter_user_id = ? AND reported_user_id = ?)
         OR (reporter_user_id = ? AND reported_user_id = ?)
       )
     LIMIT 1`
  )
    .bind(userA, userB, userB, userA)
    .first<{ id: string }>();
  return !!row;
};

export type CandidateEligibilityOptions = {
  /** Existing match request — skip discoverability/profile search gates and cooldown. */
  forAccept?: boolean;
  /** Search diagnostics only — ignore outbound accepted/declined cooldown. */
  ignorePairCooldown?: boolean;
};

export const isCandidateEligible = async (
  env: Environment,
  requesterId: string,
  candidateId: string,
  requesterState?: Awaited<ReturnType<typeof getUserStateSafe>>,
  options?: CandidateEligibilityOptions
): Promise<boolean> => {
  if (requesterId === candidateId) {
    return false;
  }

  const candidateUser = await getUserById(candidateId, env);
  if (!candidateUser || candidateUser.status !== "active") {
    return false;
  }

  if (!options?.forAccept) {
    const candidateProfile = await getMatchProfile(candidateId, env);
    if (
      !candidateProfile ||
      candidateProfile.status !== "completed" ||
      candidateProfile.version !== ASSESSMENT_VERSION ||
      candidateProfile.discoverable !== 1 ||
      candidateProfile.vector_status !== "indexed" ||
      candidateProfile.safety_tier !== "normal"
    ) {
      return false;
    }
  }

  if (
    await isMessagingBlocked(env, requesterId, candidateId, requesterState)
  ) {
    return false;
  }

  if (
    (await isMatchBlocked(env, requesterId, candidateId)) ||
    (await isMatchBlocked(env, candidateId, requesterId))
  ) {
    return false;
  }

  if (
    !options?.forAccept &&
    !options?.ignorePairCooldown &&
    (await hasRecentPairCooldown(env, requesterId, candidateId))
  ) {
    return false;
  }

  if (await hasOpenReport(env, requesterId, candidateId)) {
    return false;
  }

  return true;
};

export const canSearchMatches = async (
  userId: string,
  env: Environment
): Promise<{ ok: boolean; reason?: string }> => {
  const dashboard = await getMatchDashboard(userId, env);
  if (dashboard.state !== "ready") {
    return { ok: false, reason: dashboard.state };
  }

  const searches = await countRecentEvents(
    env,
    "search",
    userId,
    HOUR_MS
  );
  if (searches >= MATCH_SEARCH_LIMIT_PER_HOUR) {
    return { ok: false, reason: "search_limit" };
  }

  return { ok: true };
};

export const findTopMatches = async (
  userId: string,
  env: Environment
): Promise<{ ok: boolean; candidates: MatchCandidate[]; reason?: string }> => {
  const gate = await canSearchMatches(userId, env);
  if (!gate.ok) {
    return { ok: false, candidates: [], reason: gate.reason };
  }

  const requesterProfile = await getMatchProfile(userId, env);
  if (!requesterProfile) {
    return { ok: false, candidates: [], reason: "no_profile" };
  }

  const requesterUser = await getUserById(userId, env);
  const locale = requesterUser?.locale ?? "fa";

  const vectorMatches = await queryVectorCandidates(
    requesterProfile,
    locale,
    env
  );

  const d1Profiles = await fetchD1FallbackProfiles(userId, env);
  const pool = mergeCandidateUserIds(userId, vectorMatches, d1Profiles);
  const profilesById = await buildProfilesById(pool, d1Profiles, env);

  const scored = scoreCandidatePool(requesterProfile, pool, profilesById);
  const requesterState = await getUserStateSafe(env, userId);

  const filtered = await pickEligibleCandidates(
    scored,
    (candidateId) =>
      isCandidateEligible(env, userId, candidateId, requesterState),
    MATCH_RESULT_COUNT
  );

  let emptyReason: string | undefined;
  if (filtered.length === 0 && scored.length > 0) {
    const withoutCooldown = await pickEligibleCandidates(
      scored,
      (candidateId) =>
        isCandidateEligible(env, userId, candidateId, requesterState, {
          ignorePairCooldown: true,
        }),
      MATCH_RESULT_COUNT
    );
    if (withoutCooldown.length > 0) {
      emptyReason = "recent_cooldown";
    }
  }

  await recordMatchEvent(env, {
    type: "search",
    userId,
    metadata: {
      resultCount: filtered.length,
      vectorCount: vectorMatches.length,
      d1PoolCount: d1Profiles.length,
      poolSize: scored.length,
      emptyReason,
    },
  });

  return { ok: true, candidates: filtered, reason: emptyReason };
};

export const countUserMatchHistory = async (
  userId: string,
  env: Environment
): Promise<{ requests: number; blocks: number }> => {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM match_requests
        WHERE requester_user_id = ? OR candidate_user_id = ?) AS requests,
       (SELECT COUNT(*) FROM match_blocks
        WHERE user_id = ? OR blocked_user_id = ?) AS blocks`
  )
    .bind(userId, userId, userId, userId)
    .first<{ requests: number; blocks: number }>();

  return {
    requests: row?.requests ?? 0,
    blocks: row?.blocks ?? 0,
  };
};

/** Clears match requests, blocks, and suggestions involving this user. */
export const resetUserMatchHistory = async (
  userId: string,
  env: Environment
): Promise<{ requests: number; blocks: number; suggestions: number }> => {
  const [requests, blocks, suggestions] = await Promise.all([
    env.DB.prepare(
      `DELETE FROM match_requests
       WHERE requester_user_id = ? OR candidate_user_id = ?`
    )
      .bind(userId, userId)
      .run(),
    env.DB.prepare(
      `DELETE FROM match_blocks
       WHERE user_id = ? OR blocked_user_id = ?`
    )
      .bind(userId, userId)
      .run(),
    env.DB.prepare(
      `DELETE FROM match_suggestions
       WHERE user_id = ? OR candidate_user_id = ?`
    )
      .bind(userId, userId)
      .run(),
  ]);

  await recordMatchEvent(env, {
    type: "match_history_reset",
    userId,
    metadata: {
      requests: requests.meta.changes ?? 0,
      blocks: blocks.meta.changes ?? 0,
      suggestions: suggestions.meta.changes ?? 0,
    },
  });

  return {
    requests: requests.meta.changes ?? 0,
    blocks: blocks.meta.changes ?? 0,
    suggestions: suggestions.meta.changes ?? 0,
  };
};

export const createMatchSuggestionBatch = async (
  userId: string,
  candidates: MatchCandidate[],
  profileVersion: string,
  env: Environment
): Promise<MatchSuggestionRow[]> => {
  const now = Date.now();
  const rows: MatchSuggestionRow[] = [];

  for (const candidate of candidates) {
    const candidateProfile = await getMatchProfile(
      candidate.userId,
      env
    );
    if (!candidateProfile) {
      continue;
    }

    const id = generateOpaqueId(12);
    await env.DB.prepare(
      `INSERT INTO match_suggestions (
        id, user_id, candidate_user_id, profile_version, candidate_profile_version,
        score, vector_score, deterministic_score, explanation_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'shown', ?)
      ON CONFLICT(user_id, candidate_user_id, profile_version) DO UPDATE SET
        score = excluded.score,
        vector_score = excluded.vector_score,
        deterministic_score = excluded.deterministic_score,
        explanation_json = excluded.explanation_json,
        status = 'shown',
        created_at = excluded.created_at,
        action_at = NULL`
    )
      .bind(
        id,
        userId,
        candidate.userId,
        profileVersion,
        candidateProfile.version,
        candidate.score,
        candidate.vectorScore ?? null,
        candidate.deterministicScore,
        JSON.stringify(candidate.explanation),
        now
      )
      .run();

    const row = await env.DB.prepare(
      "SELECT * FROM match_suggestions WHERE user_id = ? AND candidate_user_id = ? AND profile_version = ?"
    )
      .bind(userId, candidate.userId, profileVersion)
      .first<MatchSuggestionRow>();

    if (row) {
      rows.push(row);
    }
  }

  return rows;
};

export const getMatchSuggestion = async (
  suggestionId: string,
  userId: string,
  env: Environment
): Promise<MatchSuggestionRow | null> => {
  const row = await env.DB.prepare(
    "SELECT * FROM match_suggestions WHERE id = ? AND user_id = ?"
  )
    .bind(suggestionId, userId)
    .first<MatchSuggestionRow>();

  if (!row || row.status !== "shown") {
    return null;
  }

  const maxAge = 24 * HOUR_MS;
  if (Date.now() - row.created_at > maxAge) {
    return null;
  }

  return row;
};

export const markSuggestionAction = async (
  suggestionId: string,
  status: string,
  env: Environment
): Promise<void> => {
  await env.DB.prepare(
    `UPDATE match_suggestions SET status = ?, action_at = ? WHERE id = ?`
  )
    .bind(status, Date.now(), suggestionId)
    .run();
};

export const canCreateMatchRequest = async (
  userId: string,
  env: Environment
): Promise<{ ok: boolean; reason?: string }> => {
  const requests = await countRecentEvents(
    env,
    "request_created",
    userId,
    DAY_MS
  );
  if (requests >= MATCH_REQUEST_LIMIT_PER_DAY) {
    return { ok: false, reason: "request_limit" };
  }
  return { ok: true };
};

export const expireOldMatchRequests = async (
  env: Environment
): Promise<number> => {
  const now = Date.now();
  const result = await env.DB.prepare(
    `UPDATE match_requests
     SET status = 'expired', responded_at = ?
     WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?`
  )
    .bind(now, now)
    .run();
  return result.meta.changes ?? 0;
};

export { recordMatchEvent };
