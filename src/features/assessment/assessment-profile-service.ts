import type { Environment } from "../../types";
import { generateOpaqueId } from "../../crypto/crypto-service";
import type { AssessmentResultSummary, AssessmentScores } from "./scoring";
import {
  computePrimaryIntent,
  computeProfileBucket,
  computeSafetyTier,
} from "./scoring";
import { scoresFromJson, scoresToJson } from "./assessment-scores";

export type AssessmentProfileRow = {
  user_id: string;
  version: string;
  status: string;
  dimension_scores_json: string;
  result_summary_json: string;
  profile_summary_text: string | null;
  vector_id: string | null;
  vector_status: string;
  discoverable: number;
  safety_tier: string;
  primary_intent: string;
  profile_bucket: number;
  completed_at: number;
  updated_at?: number;
};

export { scoresToJson, parseDimensionScores } from "./assessment-scores";

export const createAssessmentAttempt = async (
  userId: string,
  version: string,
  totalQuestions: number,
  env: Environment
): Promise<string> => {
  const id = generateOpaqueId(16);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO assessment_attempts (
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
    `UPDATE assessment_attempts
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
      `INSERT INTO assessment_answers (attempt_id, user_id, question_id, answer_value, answered_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id, question_id) DO UPDATE SET
         answer_value = excluded.answer_value,
         answered_at = excluded.answered_at`
    ).bind(attemptId, userId, questionId, answerValue, now),
    env.DB.prepare(
      `UPDATE assessment_attempts
       SET answered_questions = (
         SELECT COUNT(*) FROM assessment_answers WHERE attempt_id = ?
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
    `UPDATE assessment_attempts
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
    `INSERT INTO assessment_profiles (
      user_id, version, status,
      dimension_scores_json, result_summary_json, profile_summary_text,
      vector_status, discoverable, safety_tier, primary_intent, profile_bucket,
      completed_at, updated_at
    ) VALUES (
      ?, ?, 'completed',
      ?, ?, ?,
      'not_indexed', 0, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(user_id) DO UPDATE SET
      version = excluded.version,
      status = excluded.status,
      dimension_scores_json = excluded.dimension_scores_json,
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
      scoresToJson(scores),
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
    `UPDATE assessment_profiles
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
  return env.DB.prepare("SELECT * FROM assessment_profiles WHERE user_id = ?")
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
    `UPDATE assessment_profiles
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
  await env.DB.prepare("DELETE FROM assessment_profiles WHERE user_id = ?")
    .bind(userId)
    .run();
};

export const parseResultSummary = (
  row: AssessmentProfileRow
): AssessmentResultSummary => {
  try {
    const parsed = JSON.parse(row.result_summary_json) as AssessmentResultSummary;
    return {
      title: parsed.title ?? "سبک گفت‌وگو",
      shortDescription: parsed.shortDescription ?? "نتیجه ارزیابی ذخیره شده است.",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions : [],
      matchNotes: Array.isArray(parsed.matchNotes) ? parsed.matchNotes : [],
      quality: parsed.quality,
    };
  } catch {
    return {
      title: "سبک گفت‌وگو",
      shortDescription: "نتیجه ارزیابی ذخیره شده است.",
      highlights: [],
      cautions: [],
      matchNotes: [],
    };
  }
};

export const profileScoresFromRow = (row: AssessmentProfileRow): AssessmentScores =>
  scoresFromJson(row.dimension_scores_json, row.user_id);
