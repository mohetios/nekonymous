/**
 * Conversation reciprocal ranking tests (pure deterministic layer).
 * Run: pnpm test:conversation-ranking
 */

import { CONVERSATION_DIMENSIONS } from "../src/features/conversation/profile/constants.ts";
import { buildConversationProfile } from "../src/features/conversation/profile/profile-builder.ts";
import type {
  ConversationIntent,
  ProfileAnswers,
} from "../src/contracts/conversation/profile";
import { computeDirectionalFit } from "../src/features/conversation/suggestions/directional-fit.ts";
import {
  buildSuggestionExplanation,
  computeIntentAdjustment,
  intentsCanCoexist,
} from "../src/features/conversation/suggestions/explanations.ts";
import { fuseReciprocalScore } from "../src/features/conversation/suggestions/reciprocal-fit.ts";
import { rankCandidateProfiles } from "../src/features/conversation/suggestions/ranking.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const buildAnswers = (
  selfValue: number,
  desiredValue: number,
  intent: ConversationIntent = "open"
): ProfileAnswers => {
  const answers: ProfileAnswers = { intent_current: intent };
  for (const dimension of CONVERSATION_DIMENSIONS) {
    answers[`self_${dimension}_1`] = selfValue;
    answers[`self_${dimension}_2`] = selfValue;
    answers[`desired_${dimension}`] = desiredValue;
  }
  return answers;
};

const requester = buildConversationProfile(buildAnswers(4, 4), "fa", 1).profile;
const closeCandidate = buildConversationProfile(buildAnswers(4, 4), "fa", 1).profile;
const farCandidate = buildConversationProfile(buildAnswers(1, 5), "fa", 1).profile;

const closeFit = computeDirectionalFit(requester, closeCandidate);
const farFit = computeDirectionalFit(requester, farCandidate);
if (closeFit <= farFit) {
  fail("closer self/desired overlap must score higher");
}

const harmonic = fuseReciprocalScore(0.8, 0.2);
if (harmonic >= 0.8 || harmonic <= 0.2) {
  fail("harmonic mean must be conservative between directions");
}
if (fuseReciprocalScore(0, 0.9) !== 0) {
  fail("zero directional fit must collapse reciprocal score");
}

const explanation = buildSuggestionExplanation(requester, closeCandidate, "fa");
if (!explanation || explanation.includes("%") || explanation.includes("مچ")) {
  fail("explanation must avoid forbidden fit copy");
}

if (!intentsCanCoexist("open", "deep") || !intentsCanCoexist("light", "exploration")) {
  fail("intents that can coexist misclassified");
}

const intentPenalty = computeIntentAdjustment(
  buildConversationProfile(buildAnswers(4, 4, "light"), "fa", 1).profile,
  buildConversationProfile(buildAnswers(4, 4, "deep"), "fa", 1).profile
);
if (intentPenalty >= 0) {
  fail("clearly mismatched intents should receive penalty");
}

const pairTags = new Map<string, string>([
  ["candidate-close", "pair-close"],
  ["candidate-far", "pair-far"],
]);

const ranked = rankCandidateProfiles(
  requester,
  [
    {
      profileHash: "candidate-far",
      revision: 1,
      profile: farCandidate,
      channels: ["desired_to_self"],
    },
    {
      profileHash: "candidate-close",
      revision: 1,
      profile: closeCandidate,
      channels: ["desired_to_self", "self_to_desired"],
    },
  ],
  pairTags
);

if (ranked[0]?.profileHash !== "candidate-close") {
  fail("ranking must be deterministic and prefer closer reciprocal fit");
}
if (ranked.some((entry) => entry.explanation.length === 0)) {
  fail("ranked candidates must include explanations");
}

console.log("verify-conversation-ranking: OK");
