/**
 * Conversation eligibility and exposure rerank tests.
 * Run: pnpm test:conversation-eligibility
 */

import type { PairStateRecord } from "../src/storage/pair-ledger/pair-ledger.types.ts";
import { MIN_RECIPROCAL_SCORE } from "../src/features/conversation/suggestions/ranking-constants.ts";
import type { RankedCandidate } from "../src/features/conversation/suggestions/ranking-types.ts";
import { buildConversationProfile } from "../src/features/conversation/profile/profile-builder.ts";
import type { ConversationIntent, ProfileAnswers } from "../src/contracts/conversation/profile";
import { CONVERSATION_DIMENSIONS } from "../src/features/conversation/profile/constants.ts";
import {
  filterEligibleCandidates,
  isPairStateBlocking,
} from "../src/features/conversation/suggestions/eligibility.ts";
import {
  rerankWithExposure,
  selectSuggestionResults,
} from "../src/features/conversation/suggestions/exposure-reranker.ts";
import { MAX_SUGGESTION_RESULTS } from "../src/features/conversation/suggestions/constants.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const now = Date.now();

const pairState = (
  state: PairStateRecord["state"],
  expiresAt: number | null = now + 60_000
): PairStateRecord => ({
  pairTag: "pair-1",
  state,
  expiresAt,
  updatedAt: now,
});

if (!isPairStateBlocking(pairState("pending"))) {
  fail("pending pair must block");
}
if (!isPairStateBlocking(pairState("blocked", null))) {
  fail("blocked pair must block");
}
if (isPairStateBlocking(pairState("dismiss_cooldown", now - 1))) {
  fail("expired cooldown must not block");
}
if (isPairStateBlocking(null)) {
  fail("missing pair state must not block");
}

const buildAnswers = (intent: ConversationIntent = "open"): ProfileAnswers => {
  const answers: ProfileAnswers = { intent_current: intent };
  for (const dimension of CONVERSATION_DIMENSIONS) {
    answers[`self_${dimension}_1`] = 3;
    answers[`self_${dimension}_2`] = 3;
    answers[`desired_${dimension}`] = 3;
  }
  return answers;
};

const profile = buildConversationProfile(buildAnswers(), "fa", 1).profile;
const candidates = [
  {
    profileHash: "allowed",
    revision: 1,
    profile,
    channels: ["desired_to_self"],
  },
  {
    profileHash: "blocked",
    revision: 1,
    profile,
    channels: ["self_to_desired"],
  },
];

const pairTags = new Map([
  ["allowed", "pair-allowed"],
  ["blocked", "pair-blocked"],
]);
const pairStates = new Map<string, PairStateRecord | null>([
  ["pair-allowed", null],
  ["pair-blocked", pairState("pending")],
]);

const eligible = filterEligibleCandidates(candidates, pairTags, pairStates);
if (eligible.length !== 1 || eligible[0]?.profileHash !== "allowed") {
  fail("hard pair filters must override candidate pool");
}

const rankedCandidate = (
  profileHash: string,
  reciprocalScore: number,
  channels: RankedCandidate["channels"],
  pairTag: string
): RankedCandidate => ({
  profileHash,
  revision: 1,
  profile,
  pairTag,
  channels,
  requesterToCandidate: reciprocalScore,
  candidateToRequester: reciprocalScore,
  reciprocalScore,
  intentAdjustment: 0,
  finalScore: reciprocalScore,
  explanation: "test",
});

const exposureTokens = new Map([
  ["pair-a", "exp-a"],
  ["pair-b", "exp-b"],
  ["pair-c", "exp-c"],
]);

const reranked = rerankWithExposure(
  [
    rankedCandidate("a", 0.8, ["desired_to_self"], "pair-a"),
    rankedCandidate("b", 0.75, ["desired_to_self"], "pair-b"),
    rankedCandidate("c", 0.3, ["desired_to_self", "self_to_desired"], "pair-c"),
  ],
  new Set(["exp-a"]),
  exposureTokens
);

if (reranked[0]?.profileHash === "a") {
  fail("recent exposure must penalize previously shown candidates");
}

const selected = selectSuggestionResults([
  rankedCandidate("strong-1", MIN_RECIPROCAL_SCORE + 0.1, ["desired_to_self"], "pair-1"),
  rankedCandidate("strong-2", MIN_RECIPROCAL_SCORE + 0.05, ["desired_to_self"], "pair-2"),
  rankedCandidate(
    "explore",
    MIN_RECIPROCAL_SCORE - 0.1,
    ["desired_to_self", "self_to_desired"],
    "pair-3"
  ),
]);

if (selected.length > MAX_SUGGESTION_RESULTS) {
  fail("selection must respect max suggestion results");
}
if (!selected.some((entry) => entry.profileHash === "explore")) {
  fail("one exploration slot should be allowed when strong matches exist");
}

console.log("verify-conversation-eligibility: OK");
