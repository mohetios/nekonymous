import type { Environment } from "../../types";
import { generateOpaqueId } from "../../crypto/crypto-service";
import type { AssessmentResultSummary, AssessmentScores } from "./scoring";
import {
  computePrimaryIntent,
  computeProfileBucket,
  computeSafetyTier,
} from "./scoring";

export type AssessmentProfileRow = {
  user_id: string;
  version: string;
  status: string;
  honesty_boundary_respect: number;
  emotional_reactivity: number;
  social_energy: number;
  warmth_cooperation: number;
  reliability_consistency: number;
  curiosity_depth: number;
  depth_preference: number;
  reply_pace: number;
  directness: number;
  conflict_reflectiveness: number;
  support_need: number;
  anonymity_comfort: number;
  result_summary_json: string;
  profile_summary_text: string | null;
  vector_id: string | null;
  vector_status: string;
  discoverable: number;
  safety_tier: string;
  primary_intent: string;
  profile_bucket: number;
  completed_at: number;
};

export const createAssessmentAttempt = async (
  userId: string,
  version: string,
  totalQuestions: number,
  env: Environment
): Promise<string> => {
  const id = generateOpaqueId(16);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO test_attempts (
      id, user_id, version, status, started_at, total_questions, answered_questions
    ) VALUES (?, ?, ?, 'started', ?, ?, 0)`
  )
    .bind(id, userId, version, now, totalQuestions)
    .run();

  return id;
};

export const abandonActiveAssessmentAttempts = async (
  userId: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE test_attempts
     SET status = 'abandoned', abandoned_at = ?
     WHERE user_id = ? AND status = 'started'`
  )
    .bind(now, userId)
    .run();
};

export const saveAssessmentAnswer = async (
  attemptId: string,
  userId: string,
  questionId: string,
  answerValue: number,
  env: Environment
): Promise<void> => {
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO test_answers (attempt_id, user_id, question_id, answer_value, answered_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id, question_id) DO UPDATE SET
         answer_value = excluded.answer_value,
         answered_at = excluded.answered_at`
    ).bind(attemptId, userId, questionId, answerValue, now),
    env.DB.prepare(
      `UPDATE test_attempts
       SET answered_questions = (
         SELECT COUNT(*) FROM test_answers WHERE attempt_id = ?
       )
       WHERE id = ?`
    ).bind(attemptId, attemptId),
  ]);
};

export const completeAssessmentAttempt = async (
  attemptId: string,
  userId: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE test_attempts
     SET status = 'completed', completed_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(now, attemptId, userId)
    .run();
};

export const saveAssessmentProfile = async (
  userId: string,
  version: string,
  scores: AssessmentScores,
  summary: AssessmentResultSummary,
  profileSummaryText: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  const primaryIntent = computePrimaryIntent(scores);
  const safetyTier = computeSafetyTier(scores);
  const profileBucket = computeProfileBucket(scores);

  await env.DB.prepare(
    `INSERT INTO test_profiles (
      user_id, version, status,
      honesty_boundary_respect, emotional_reactivity, social_energy,
      warmth_cooperation, reliability_consistency, curiosity_depth,
      depth_preference, reply_pace, directness,
      conflict_reflectiveness, support_need, anonymity_comfort,
      values_json, interests_json, boundaries_json, intents_json,
      result_summary_json, profile_summary_text,
      vector_status, discoverable, safety_tier, primary_intent, profile_bucket,
      completed_at, updated_at
    ) VALUES (
      ?, ?, 'completed',
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      '[]', '[]', '{}', '[]',
      ?, ?, 'not_indexed', 0, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(user_id) DO UPDATE SET
      version = excluded.version,
      status = excluded.status,
      honesty_boundary_respect = excluded.honesty_boundary_respect,
      emotional_reactivity = excluded.emotional_reactivity,
      social_energy = excluded.social_energy,
      warmth_cooperation = excluded.warmth_cooperation,
      reliability_consistency = excluded.reliability_consistency,
      curiosity_depth = excluded.curiosity_depth,
      depth_preference = excluded.depth_preference,
      reply_pace = excluded.reply_pace,
      directness = excluded.directness,
      conflict_reflectiveness = excluded.conflict_reflectiveness,
      support_need = excluded.support_need,
      anonymity_comfort = excluded.anonymity_comfort,
      result_summary_json = excluded.result_summary_json,
      profile_summary_text = excluded.profile_summary_text,
      vector_status = 'not_indexed',
      vector_id = NULL,
      vector_updated_at = NULL,
      safety_tier = excluded.safety_tier,
      primary_intent = excluded.primary_intent,
      profile_bucket = excluded.profile_bucket,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at`
  )
    .bind(
      userId,
      version,
      scores.honestyBoundaryRespect,
      scores.emotionalReactivity,
      scores.socialEnergy,
      scores.warmthCooperation,
      scores.reliabilityConsistency,
      scores.curiosityDepth,
      scores.depthPreference,
      scores.replyPace,
      scores.directness,
      scores.conflictReflectiveness,
      scores.supportNeed,
      scores.anonymityComfort,
      JSON.stringify(summary),
      profileSummaryText,
      safetyTier,
      primaryIntent,
      profileBucket,
      now,
      now
    )
    .run();
};

export const updateProfileVectorStatus = async (
  userId: string,
  vectorId: string,
  status: "indexed" | "failed" | "not_indexed",
  profileSummaryText: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE test_profiles
     SET vector_id = ?, vector_status = ?, vector_updated_at = ?,
         profile_summary_text = COALESCE(?, profile_summary_text),
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(vectorId, status, now, profileSummaryText, now, userId)
    .run();
};

export const getLatestAssessmentProfile = async (
  userId: string,
  env: Environment
): Promise<AssessmentProfileRow | null> => {
  return env.DB.prepare("SELECT * FROM test_profiles WHERE user_id = ?")
    .bind(userId)
    .first<AssessmentProfileRow>();
};

export const getMatchProfile = async (
  userId: string,
  env: Environment
): Promise<AssessmentProfileRow | null> => getLatestAssessmentProfile(userId, env);

export const setDiscoverable = async (
  userId: string,
  enabled: boolean,
  env: Environment
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE test_profiles
     SET discoverable = ?, updated_at = ?
     WHERE user_id = ? AND status = 'completed'`
  )
    .bind(enabled ? 1 : 0, now, userId)
    .run();
};

export const resetUserAssessmentProfile = async (
  userId: string,
  env: Environment
): Promise<void> => {
  await env.DB.prepare("DELETE FROM test_profiles WHERE user_id = ?")
    .bind(userId)
    .run();
};

export const parseResultSummary = (
  row: AssessmentProfileRow
): AssessmentResultSummary => {
  try {
    return JSON.parse(row.result_summary_json) as AssessmentResultSummary;
  } catch {
    return {
      title: "سبک گفت‌وگو",
      shortDescription: "نتیجه تست ذخیره شده است.",
      highlights: [],
      cautions: [],
    };
  }
};

export const profileScoresFromRow = (row: AssessmentProfileRow): AssessmentScores => ({
  honestyBoundaryRespect: row.honesty_boundary_respect,
  emotionalReactivity: row.emotional_reactivity,
  socialEnergy: row.social_energy,
  warmthCooperation: row.warmth_cooperation,
  reliabilityConsistency: row.reliability_consistency,
  curiosityDepth: row.curiosity_depth,
  depthPreference: row.depth_preference,
  replyPace: row.reply_pace,
  directness: row.directness,
  conflictReflectiveness: row.conflict_reflectiveness,
  supportNeed: row.support_need,
  anonymityComfort: row.anonymity_comfort,
});
