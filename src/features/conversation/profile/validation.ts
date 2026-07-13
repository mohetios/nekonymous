import {
  LIKERT_MAX,
  LIKERT_MIN,
  NO_PREFERENCE_VALUE,
  PROFILE_QUESTION_COUNT,
} from "./constants.ts";
import { PROFILE_QUESTION_BY_ID, PROFILE_QUESTIONS } from "./question-bank.ts";
import type {
  ConversationIntent,
  ProfileAnswers,
  ProfileQuestion,
} from "../../../contracts/conversation/profile";

const INTENT_VALUES = new Set<ConversationIntent>([
  "light",
  "deep",
  "support",
  "exploration",
  "open",
]);

export const isConversationIntent = (value: string): value is ConversationIntent =>
  INTENT_VALUES.has(value as ConversationIntent);

export const validateSelfAnswer = (value: number): boolean =>
  Number.isInteger(value) && value >= LIKERT_MIN && value <= LIKERT_MAX;

export const validateDesiredAnswer = (value: number): boolean =>
  Number.isInteger(value) &&
  (value === NO_PREFERENCE_VALUE || (value >= LIKERT_MIN && value <= LIKERT_MAX));

export const validateAnswerForQuestion = (
  question: ProfileQuestion,
  value: number | ConversationIntent
): boolean => {
  if (question.kind === "intent") {
    return typeof value === "string" && isConversationIntent(value);
  }

  if (typeof value !== "number") {
    return false;
  }

  return question.kind === "self"
    ? validateSelfAnswer(value)
    : validateDesiredAnswer(value);
};

export const hasCompleteAnswers = (answers: ProfileAnswers): boolean => {
  if (Object.keys(answers).length !== PROFILE_QUESTION_COUNT) {
    return false;
  }

  for (const question of PROFILE_QUESTIONS) {
    const value = answers[question.id];
    if (value === undefined || !validateAnswerForQuestion(question, value)) {
      return false;
    }
  }

  return true;
};

export const countAnsweredQuestions = (answers: ProfileAnswers): number => {
  let count = 0;
  for (const question of PROFILE_QUESTIONS) {
    const value = answers[question.id];
    if (value !== undefined && validateAnswerForQuestion(question, value)) {
      count += 1;
    }
  }
  return count;
};

export const assertValidAnswerPatch = (
  questionId: string,
  value: number | ConversationIntent
): void => {
  const question = PROFILE_QUESTION_BY_ID.get(questionId);
  if (!question) {
    throw new Error("Unknown question");
  }
  if (!validateAnswerForQuestion(question, value)) {
    throw new Error("Invalid answer value");
  }
};
