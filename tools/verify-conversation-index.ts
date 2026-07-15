/**
 * Conversation profile indexing pipeline tests (pure projection layer).
 * Run: pnpm test:conversation-index
 */

import {
  QUANTIZATION_LEVELS,
  VECTOR_DIMENSION,
  VECTOR_INDEX_DIMENSION,
  padVectorForIndex,
  namespaceFor,
  projectDesiredVector,
  projectSelfVector,
  quantize,
} from "../src/features/conversation/profile/vector-projection.ts";
import { CONVERSATION_DIMENSIONS } from "../src/features/conversation/profile/constants.ts";
import { buildConversationProfile } from "../src/features/conversation/profile/profile-builder.ts";
import type {
  ConversationIntent,
  ProfileAnswers,
} from "../src/contracts/conversation/profile";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const allowed = new Set<number>(QUANTIZATION_LEVELS);

if (VECTOR_DIMENSION !== CONVERSATION_DIMENSIONS.length) {
  fail("vector dimension must equal dimension count");
}
if (VECTOR_INDEX_DIMENSION < VECTOR_DIMENSION) {
  fail("vector index dimension must be at least semantic dimension count");
}

for (const [input, expected] of [
  [0, 0],
  [0.1, 0],
  [0.13, 0.25],
  [0.5, 0.5],
  [0.62, 0.5],
  [0.63, 0.75],
  [1, 1],
  [1.4, 1],
  [-0.2, 0],
] as const) {
  if (quantize(input) !== expected) {
    fail(`quantize(${input}) expected ${expected}, got ${quantize(input)}`);
  }
}

const buildAnswers = (desiredNoPreference: boolean): ProfileAnswers => {
  const answers: ProfileAnswers = { intent_current: "open" as ConversationIntent };
  for (const dimension of CONVERSATION_DIMENSIONS) {
    answers[`self_${dimension}_1`] = 4;
    answers[`self_${dimension}_2`] = 2;
    answers[`desired_${dimension}`] = desiredNoPreference ? 0 : 5;
  }
  return answers;
};

const { profile } = buildConversationProfile(buildAnswers(false), "fa", 1);
const selfVector = projectSelfVector(profile);
const desiredVector = projectDesiredVector(profile);

if (selfVector.length !== VECTOR_DIMENSION) {
  fail("self vector wrong dimension");
}
const padded = padVectorForIndex(selfVector);
if (padded.length !== VECTOR_INDEX_DIMENSION) {
  fail("padded vector must match index dimension");
}
if (!padded.slice(0, VECTOR_DIMENSION).every((value, index) => value === selfVector[index])) {
  fail("padded vector must preserve semantic dimensions");
}
if (!padded.slice(VECTOR_DIMENSION).every((value) => value === 0)) {
  fail("padded vector tail must be zero");
}
if (desiredVector.length !== VECTOR_DIMENSION) {
  fail("desired vector wrong dimension");
}
for (const value of [...selfVector, ...desiredVector]) {
  if (!allowed.has(value)) {
    fail(`vector value ${value} is not a quantization level`);
  }
}

const noPref = buildConversationProfile(buildAnswers(true), "en", 1).profile;
const noPrefDesired = projectDesiredVector(noPref);
if (!noPrefDesired.every((value) => value === 0.5)) {
  fail("no-preference desired vector must be neutral 0.5");
}

if (
  namespaceFor("self", "fa") !== "self-fa" ||
  namespaceFor("desired", "fa") !== "desired-fa" ||
  namespaceFor("self", "en") !== "self-en" ||
  namespaceFor("desired", "en") !== "desired-en"
) {
  fail("namespace mapping mismatch");
}

console.log("verify-conversation-index: OK");
