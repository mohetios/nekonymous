/**
 * Assessment validation tests.
 * Run: pnpm test:assessment
 */

import {
  ASSESSMENT_DIMENSIONS,
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_VERSION,
  EXPECTED_QUESTIONS_PER_DIMENSION,
  type AssessmentDimension,
  type AssessmentQuestion,
  validateAssessmentQuestionBank,
} from "../src/features/assessment/question-bank.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    fail(message);
  }
};

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
};

const scoredValue = (question: AssessmentQuestion, answer: number): number =>
  question.reverse ? 6 - answer : answer;

const computeAssessmentScores = (
  answers: Record<string, number>
): Record<AssessmentDimension, number> => {
  const scores = {} as Record<AssessmentDimension, number>;

  for (const dimension of ASSESSMENT_DIMENSIONS) {
    const items = ASSESSMENT_QUESTIONS.filter((q) => q.dimension === dimension);
    let sum = 0;
    for (const item of items) {
      const raw = answers[item.id];
      if (raw === undefined || raw < 1 || raw > 5) {
        throw new Error(`Missing answers for dimension: ${dimension}`);
      }
      sum += scoredValue(item, raw);
    }
    const avg = sum / items.length;
    scores[dimension] = clampScore(((avg - 1) / 4) * 100);
  }

  return scores;
};

const bucket = (score: number): string => {
  if (score >= 67) {
    return "high";
  }
  if (score >= 34) {
    return "medium";
  }
  return "low";
};

const buildProfileEmbeddingText = (
  scores: Record<AssessmentDimension, number>,
  locale: string,
  version: string
): string => {
  const lines = [
    `Language: ${locale}.`,
    `Assessment version: ${version}.`,
    "Conversation profile:",
    `- ${bucket(scores.boundaryRespect)} boundary respect`,
    `- ${bucket(scores.emotionalSensitivity)} emotional sensitivity`,
    `- ${bucket(scores.emotionalRegulation)} emotional regulation`,
    `- ${bucket(scores.curiosityDepth)} curiosity and depth`,
    "Matching notes:",
    "- good for low-pressure, respectful anonymous conversation",
  ];
  return lines.join("\n");
};

validateAssessmentQuestionBank();

assert(ASSESSMENT_QUESTION_COUNT === 56, "exactly 56 questions");
assert(ASSESSMENT_DIMENSIONS.length === 14, "exactly 14 dimensions");

const ids = new Set<string>();
let reverseCount = 0;
for (const question of ASSESSMENT_QUESTIONS) {
  assert(!ids.has(question.id), `unique id: ${question.id}`);
  ids.add(question.id);
  if (question.reverse) {
    reverseCount += 1;
  }
}

for (const dimension of ASSESSMENT_DIMENSIONS) {
  const count = ASSESSMENT_QUESTIONS.filter((q) => q.dimension === dimension).length;
  assert(
    count === EXPECTED_QUESTIONS_PER_DIMENSION,
    `4 questions per dimension: ${dimension}`
  );
}

assert(reverseCount >= 10 && reverseCount <= 18, "reverse count reasonable");

const minAnswers = Object.fromEntries(
  ASSESSMENT_QUESTIONS.map((q) => [q.id, q.reverse ? 5 : 1])
) as Record<string, number>;

const maxAnswers = Object.fromEntries(
  ASSESSMENT_QUESTIONS.map((q) => [q.id, q.reverse ? 1 : 5])
) as Record<string, number>;

const scoresMin = computeAssessmentScores(minAnswers);
for (const dimension of ASSESSMENT_DIMENSIONS) {
  assert(scoresMin[dimension] === 0, `min normalized -> 0 for ${dimension}`);
}

const scoresMax = computeAssessmentScores(maxAnswers);
for (const dimension of ASSESSMENT_DIMENSIONS) {
  assert(scoresMax[dimension] === 100, `max normalized -> 100 for ${dimension}`);
}

const reverseQuestion = ASSESSMENT_QUESTIONS.find((q) => q.reverse);
assert(!!reverseQuestion, "has reverse question");
if (reverseQuestion) {
  assert(scoredValue(reverseQuestion, 1) === 5, "reverse item: 1 -> 5");
  assert(scoredValue(reverseQuestion, 5) === 1, "reverse item: 5 -> 1");
}

assert(!Number.isNaN(scoresMax.boundaryRespect), "no NaN when complete");
assert(Number.isFinite(scoresMax.boundaryRespect), "no Infinity when complete");

const partialAnswers = { ...minAnswers };
delete partialAnswers[ASSESSMENT_QUESTIONS[0].id];

let threw = false;
try {
  computeAssessmentScores(partialAnswers);
} catch {
  threw = true;
}
assert(threw, "missing answer throws in scoring");

const embeddingText = buildProfileEmbeddingText(scoresMax, "fa", ASSESSMENT_VERSION);
assert(!embeddingText.includes('"br1"'), "summary does not include raw answer ids");
assert(embeddingText.includes("v1"), "summary includes v1");
assert(embeddingText.includes("high boundary respect"), "summary includes bucket labels");
assert(embeddingText.includes("Assessment version: v1"), "summary includes version line");

const vectorId = `profile:user-abc:${ASSESSMENT_VERSION}`;
assert(vectorId === "profile:user-abc:v1", "vector id contains v1");

console.log("Assessment V1 OK");
