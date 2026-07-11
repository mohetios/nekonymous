import {
  CONVERSATION_DIMENSIONS,
  DIMENSION_IMPORTANCE_WEIGHT,
  NO_PREFERENCE_VALUE,
  PROFILE_SCHEMA_VERSION,
} from "./constants.ts";
import {
  computeAxisAgreement,
  isNoPreferenceDesired,
  normalizeLikert,
} from "./normalization.ts";
import { PROFILE_QUESTIONS } from "./question-bank.ts";
import { buildProfileSummaryText } from "./profile-summary.ts";
import { hasCompleteAnswers } from "./validation.ts";
import type {
  ConversationDimension,
  ConversationIntent,
  ConversationProfile,
  ProfileAnswers,
  ProfileBuildResult,
  ProfileLocale,
} from "./types.ts";

const readSelfAnswers = (
  answers: ProfileAnswers,
  dimension: ConversationDimension
): [number, number] => {
  const first = answers[`self_${dimension}_1`];
  const second = answers[`self_${dimension}_2`];
  if (typeof first !== "number" || typeof second !== "number") {
    throw new Error(`Missing self answers for ${dimension}`);
  }
  return [first, second];
};

const readDesiredAnswer = (
  answers: ProfileAnswers,
  dimension: ConversationDimension
): number => {
  const value = answers[`desired_${dimension}`];
  if (typeof value !== "number") {
    throw new Error(`Missing desired answer for ${dimension}`);
  }
  return value;
};

const readIntent = (answers: ProfileAnswers): ConversationIntent => {
  const value = answers.intent_current;
  if (
    value !== "light" &&
    value !== "deep" &&
    value !== "support" &&
    value !== "exploration" &&
    value !== "open"
  ) {
    throw new Error("Missing intent answer");
  }
  return value;
};

export const buildConversationProfile = (
  answers: ProfileAnswers,
  locale: ProfileLocale,
  revision: number
): ProfileBuildResult => {
  if (!hasCompleteAnswers(answers)) {
    throw new Error("Incomplete profile answers");
  }

  const selfStyle = {} as Record<ConversationDimension, number>;
  const desiredStyle = {} as Record<ConversationDimension, number>;
  const importance = {} as Record<ConversationDimension, number>;
  const axisAgreement = {} as Record<ConversationDimension, number>;

  for (const dimension of CONVERSATION_DIMENSIONS) {
    const [selfA, selfB] = readSelfAnswers(answers, dimension);
    selfStyle[dimension] =
      (normalizeLikert(selfA) + normalizeLikert(selfB)) / 2;
    axisAgreement[dimension] = computeAxisAgreement(selfA, selfB);

    const desiredRaw = readDesiredAnswer(answers, dimension);
    if (isNoPreferenceDesired(desiredRaw)) {
      desiredStyle[dimension] = NO_PREFERENCE_VALUE;
      importance[dimension] = 0;
    } else {
      desiredStyle[dimension] = normalizeLikert(desiredRaw);
      importance[dimension] = DIMENSION_IMPORTANCE_WEIGHT[dimension];
    }
  }

  const profile: ConversationProfile = {
    selfStyle,
    desiredStyle,
    importance,
    axisAgreement,
    currentIntent: readIntent(answers),
    locale,
    revision,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };

  return {
    profile,
    summaryText: buildProfileSummaryText(profile, locale),
  };
};

export const profileHasSafetyState = (_profile: ConversationProfile): boolean =>
  false;

export const assertProfileQuestionBank = (): void => {
  if (PROFILE_QUESTIONS.length !== 25) {
    throw new Error("Profile question bank size mismatch");
  }
};
