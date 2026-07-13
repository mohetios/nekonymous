/**
 * Conversation profile engine tests.
 * Run: pnpm test:conversation-profile
 */

import {
  CONVERSATION_DIMENSIONS,
  DIMENSION_IMPORTANCE_WEIGHT,
  NO_PREFERENCE_VALUE,
  PROFILE_QUESTION_COUNT,
} from "../src/features/conversation/profile/constants.ts";
import {
  assertProfileQuestionBank,
  buildConversationProfile,
  profileHasSafetyState,
} from "../src/features/conversation/profile/profile-builder.ts";
import { PROFILE_QUESTIONS } from "../src/features/conversation/profile/question-bank.ts";
import {
  hasCompleteAnswers,
  validateAnswerForQuestion,
  validateDesiredAnswer,
  validateSelfAnswer,
} from "../src/features/conversation/profile/validation.ts";
import type {
  ConversationIntent,
  ProfileAnswers,
} from "../src/contracts/conversation/profile";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

assertProfileQuestionBank();
if (PROFILE_QUESTIONS.length !== PROFILE_QUESTION_COUNT) {
  fail("question bank must contain 25 questions");
}

const dimensionSet = new Set(
  PROFILE_QUESTIONS.flatMap((question) =>
    question.dimension ? [question.dimension] : []
  )
);
for (const dimension of CONVERSATION_DIMENSIONS) {
  const selfCount = PROFILE_QUESTIONS.filter(
    (question) => question.kind === "self" && question.dimension === dimension
  ).length;
  const desiredCount = PROFILE_QUESTIONS.filter(
    (question) => question.kind === "desired" && question.dimension === dimension
  ).length;
  if (selfCount !== 2 || desiredCount !== 1) {
    fail(`dimension coverage mismatch for ${dimension}`);
  }
}

if (!validateSelfAnswer(3) || validateSelfAnswer(0) || validateSelfAnswer(6)) {
  fail("self answer validation failed");
}

if (!validateDesiredAnswer(0) || !validateDesiredAnswer(4) || validateDesiredAnswer(6)) {
  fail("desired answer validation failed");
}

const intentQuestion = PROFILE_QUESTIONS.find((question) => question.kind === "intent");
if (!intentQuestion) {
  fail("intent question missing");
}

const buildCompleteAnswers = (): ProfileAnswers => {
  const answers: ProfileAnswers = {};
  for (const question of PROFILE_QUESTIONS) {
    if (question.kind === "intent") {
      answers[question.id] = "open";
      continue;
    }
    if (question.kind === "desired" && question.dimension === "playfulness") {
      answers[question.id] = NO_PREFERENCE_VALUE;
      continue;
    }
    answers[question.id] = 3;
  }
  return answers;
};

const completeAnswers = buildCompleteAnswers();
if (!hasCompleteAnswers(completeAnswers)) {
  fail("complete fixture answers rejected");
}

const incomplete = { ...completeAnswers };
delete incomplete[PROFILE_QUESTIONS[0].id];
if (hasCompleteAnswers(incomplete)) {
  fail("incomplete answers should be rejected");
}

for (const question of PROFILE_QUESTIONS) {
  const badValue = question.kind === "intent" ? 3 : "open";
  if (validateAnswerForQuestion(question, badValue as never)) {
    fail(`invalid value accepted for ${question.id}`);
  }
}

const built = buildConversationProfile(completeAnswers, "fa", 1);
for (const dimension of CONVERSATION_DIMENSIONS) {
  const self = built.profile.selfStyle[dimension];
  if (self < 0 || self > 1) {
    fail(`self style not normalized for ${dimension}`);
  }
  const desired = built.profile.desiredStyle[dimension];
  if (dimension === "playfulness") {
    if (
      desired !== NO_PREFERENCE_VALUE ||
      built.profile.importance[dimension] !== 0
    ) {
      fail("no-preference should zero importance");
    }
  } else if (desired < 0 || desired > 1) {
    fail(`desired style not normalized for ${dimension}`);
  } else if (built.profile.importance[dimension] !== DIMENSION_IMPORTANCE_WEIGHT[dimension]) {
    fail(`importance weight mismatch for ${dimension}`);
  }
}

if (profileHasSafetyState(built.profile)) {
  fail("profile builder must not create safety state");
}

const retakeRevision = buildConversationProfile(completeAnswers, "fa", 2);
if (retakeRevision.profile.revision !== 2) {
  fail("retake revision not applied");
}

const intents: ConversationIntent[] = [
  "light",
  "deep",
  "support",
  "exploration",
  "open",
];
if (built.profile.currentIntent !== "open" || intents.length !== 5) {
  fail("intent selection missing");
}

console.log("verify-conversation-profile: ok");
