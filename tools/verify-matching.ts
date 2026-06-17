/**
 * Matching selection smoke tests.
 * Run: pnpm test:matching
 */

import { MATCH_MIN_SCORE_TO_SHOW, MATCH_RESULT_COUNT } from "../src/features/matching/constants.ts";
import {
  getMatchQualityLabel,
  MATCH_QUALITY_COPY,
} from "../src/features/matching/match-quality.ts";
import type { MatchCandidate } from "../src/features/matching/match-types.ts";
import type { AssessmentProfileRow } from "../src/features/assessment/assessment-profile-service.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    fail(message);
  }
};

type VectorMatchInput = { userId: string; vectorScore: number };

const mergeCandidateUserIds = (
  requesterId: string,
  vectorMatches: VectorMatchInput[],
  d1Profiles: AssessmentProfileRow[]
): Map<string, number | undefined> => {
  const pool = new Map<string, number | undefined>();

  for (const match of vectorMatches) {
    if (match.userId === requesterId) {
      continue;
    }
    pool.set(match.userId, match.vectorScore);
  }

  for (const profile of d1Profiles) {
    if (profile.user_id === requesterId) {
      continue;
    }
    if (!pool.has(profile.user_id)) {
      pool.set(profile.user_id, undefined);
    }
  }

  return pool;
};

const pickEligibleCandidates = async (
  scored: MatchCandidate[],
  isEligible: (candidateId: string) => Promise<boolean>,
  limit: number
): Promise<MatchCandidate[]> => {
  const result: MatchCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of scored) {
    if (seen.has(candidate.userId)) {
      continue;
    }
    if (!(await isEligible(candidate.userId))) {
      continue;
    }
    seen.add(candidate.userId);
    result.push(candidate);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
};

const candidate = (
  userId: string,
  score: number,
  overrides: Partial<MatchCandidate> = {}
): MatchCandidate => ({
  userId,
  score,
  deterministicScore: score,
  qualityLabel: getMatchQualityLabel(score),
  explanation: {
    title: "گفت‌وگوی ناشناس",
    reasons: ["چند نقطه مشترک در سبک ارتباطی دیده می‌شود."],
    cautions: [],
  },
  ...overrides,
});

const baseProfile = (
  userId: string,
  overrides: Partial<AssessmentProfileRow> = {}
): AssessmentProfileRow => ({
  user_id: userId,
  version: "v1",
  status: "completed",
  honesty_boundary_respect: 55,
  emotional_reactivity: 50,
  social_energy: 50,
  warmth_cooperation: 55,
  reliability_consistency: 50,
  curiosity_depth: 50,
  depth_preference: 50,
  reply_pace: 50,
  directness: 50,
  conflict_reflectiveness: 50,
  support_need: 50,
  anonymity_comfort: 50,
  result_summary_json: "{}",
  profile_summary_text: "summary",
  vector_id: `profile:${userId}:v1`,
  vector_status: "indexed",
  discoverable: 1,
  safety_tier: "normal",
  primary_intent: "deep-talk",
  profile_bucket: 1,
  completed_at: Date.now(),
  ...overrides,
});

const profileB = baseProfile("user-b");

assert(getMatchQualityLabel(80) === "strong", "quality strong");
assert(getMatchQualityLabel(75) === "strong", "quality strong boundary");
assert(getMatchQualityLabel(60) === "good", "quality good");
assert(getMatchQualityLabel(40) === "moderate", "quality moderate");
assert(getMatchQualityLabel(12) === "limited", "quality limited");
assert(MATCH_QUALITY_COPY.limited === "شباهت محدود", "limited copy");
assert(MATCH_MIN_SCORE_TO_SHOW === 0, "no minimum score gate");

const selfPool = mergeCandidateUserIds(
  "user-a",
  [{ userId: "user-a", vectorScore: 0.99 }, { userId: "user-b", vectorScore: 0.4 }],
  []
);
assert(selfPool.size === 1, "self excluded from pool");
assert(selfPool.has("user-b"), "other user kept");

const fallbackPool = mergeCandidateUserIds("user-a", [], [profileB]);
assert(fallbackPool.size === 1 && fallbackPool.has("user-b"), "d1 fallback pool");

const aFindsB = await pickEligibleCandidates(
  [candidate("user-b", 22)],
  async () => true,
  MATCH_RESULT_COUNT
);
const bFindsA = await pickEligibleCandidates(
  [candidate("user-a", 22)],
  async () => true,
  MATCH_RESULT_COUNT
);
assert(aFindsB.length === 1 && aFindsB[0].userId === "user-b", "case 1 A -> B");
assert(bFindsA.length === 1 && bFindsA[0].userId === "user-a", "case 1 B -> A");

const lowPicked = await pickEligibleCandidates(
  [candidate("user-b", 12)],
  async () => true,
  MATCH_RESULT_COUNT
);
assert(lowPicked.length === 1, "case 2 low score still returned");
assert(lowPicked[0].qualityLabel === "limited", "case 2 limited label");

const blockedByDiscoverability = await pickEligibleCandidates(
  [candidate("user-b", 40)],
  async () => false,
  MATCH_RESULT_COUNT
);
assert(blockedByDiscoverability.length === 0, "case 3 ineligible excluded");

const pendingExcluded = await pickEligibleCandidates(
  [candidate("user-b", 40)],
  async (id) => id !== "user-b",
  MATCH_RESULT_COUNT
);
assert(pendingExcluded.length === 0, "case 6 pending/excluded candidate omitted");

const multiPicked = await pickEligibleCandidates(
  [candidate("c1", 50), candidate("c2", 45), candidate("c3", 40)],
  async () => true,
  MATCH_RESULT_COUNT
);
assert(multiPicked.length === 3, "case 7 returns all three candidates");

console.log("Matching selection OK");
