import type { Environment } from "../../types";
import { buildProfileEmbeddingText } from "./profile-summary";
import { indexCompletedProfileSafe } from "./profile-vector-service";
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_VERSION,
} from "./question-bank";
import {
  buildResultSummary,
  computePrimaryIntent,
  computeProfileBucket,
  computeSafetyTier,
  computeAssessmentScores,
  hasCompleteAnswers,
} from "./scoring";
import {
  completeAssessmentAttempt,
  saveAssessmentProfile,
  saveAssessmentAnswer as persistAssessmentAnswer,
} from "./assessment-profile-service";
import {
  completeAssessmentSession,
  getAssessmentSession,
  type AssessmentSession,
} from "../../storage/user-state-client";


export const completeAssessmentFlow = async (
  userId: string,
  locale: string,
  env: Environment
): Promise<{
  summary: ReturnType<typeof buildResultSummary>;
  scores: ReturnType<typeof computeAssessmentScores>;
  profileSummaryText: string;
  version: string;
}> => {
  const session = await getAssessmentSession(userId, env);
  if (!session || !session.attemptId) {
    throw new Error("No active assessment session");
  }

  if (!hasCompleteAnswers(session.answers)) {
    throw new Error("Incomplete assessment answers");
  }

  const scores = computeAssessmentScores(session.answers);
  const summary = buildResultSummary(scores, session.answers);
  const profileVersion = session.version || ASSESSMENT_VERSION;
  const profileSummaryText = buildProfileEmbeddingText(
    scores,
    summary,
    locale === "en" ? "en" : "fa",
    profileVersion
  );

  await finalizeAssessmentFromSession(
    userId,
    locale,
    session,
    env,
    scores,
    summary,
    profileSummaryText
  );

  return {
    summary,
    scores,
    profileSummaryText,
    version: session.version || ASSESSMENT_VERSION,
  };
};

export const finalizeAssessmentFromSession = async (
  userId: string,
  locale: string,
  session: AssessmentSession,
  env: Environment,
  scores?: ReturnType<typeof computeAssessmentScores>,
  summary?: ReturnType<typeof buildResultSummary>,
  profileSummaryText?: string
): Promise<void> => {
  if (!session.attemptId) {
    throw new Error("Missing attempt id");
  }

  for (const question of ASSESSMENT_QUESTIONS) {
    const value = session.answers[question.id];
    if (value !== undefined) {
      await persistAssessmentAnswer(
        session.attemptId,
        userId,
        question.id,
        value,
        env
      );
    }
  }

  const resolvedScores = scores ?? computeAssessmentScores(session.answers);
  const resolvedSummary =
    summary ?? buildResultSummary(resolvedScores, session.answers);
  const profileVersion = session.version || ASSESSMENT_VERSION;
  const resolvedProfileText =
    profileSummaryText ??
    buildProfileEmbeddingText(
      resolvedScores,
      resolvedSummary,
      locale === "en" ? "en" : "fa",
      profileVersion
    );

  await saveAssessmentProfile(
    userId,
    session.version || ASSESSMENT_VERSION,
    resolvedScores,
    resolvedSummary,
    resolvedProfileText,
    env
  );
  await completeAssessmentAttempt(session.attemptId, userId, env);
  await completeAssessmentSession(userId, env);
};

export const scheduleProfileIndexing = (
  params: {
    userId: string;
    version: string;
    locale: "fa" | "en";
    scores: ReturnType<typeof computeAssessmentScores>;
    summary: ReturnType<typeof buildResultSummary>;
    profileSummaryText: string;
    env: Environment;
  },
  defer?: (promise: Promise<unknown>) => void
): void => {
  const job = indexCompletedProfileSafe({
    userId: params.userId,
    version: params.version,
    locale: params.locale,
    scores: params.scores,
    resultSummary: params.summary,
    profileSummaryText: params.profileSummaryText,
    discoverable: false,
    safetyTier: computeSafetyTier(params.scores),
    primaryIntent: computePrimaryIntent(params.scores),
    profileBucket: computeProfileBucket(params.scores),
    env: params.env,
  });

  if (defer) {
    defer(job);
  } else {
    void job;
  }
};

export const firstUnansweredIndex = (session: AssessmentSession): number => {
  for (let i = 0; i < ASSESSMENT_QUESTION_COUNT; i++) {
    const q = ASSESSMENT_QUESTIONS[i];
    if (session.answers[q.id] === undefined) {
      return i;
    }
  }
  return Math.min(session.currentIndex, ASSESSMENT_QUESTION_COUNT - 1);
};

export const resumeQuestionIndex = (session: AssessmentSession): number => {
  const unanswered = firstUnansweredIndex(session);
  if (session.answers[ASSESSMENT_QUESTIONS[unanswered]?.id ?? ""] === undefined) {
    return unanswered;
  }
  return Math.min(session.currentIndex, ASSESSMENT_QUESTION_COUNT - 1);
};
