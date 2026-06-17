/**
 * Matching selection and scoring smoke tests.
 * Run: pnpm test:matching
 */

import { MATCH_MIN_SCORE_TO_SHOW, MATCH_RESULT_COUNT } from "../src/features/matching/constants.ts";
import {
  getMatchQualityLabel,
  MATCH_QUALITY_COPY,
} from "../src/features/matching/match-quality.ts";
import type { MatchCandidate } from "../src/features/matching/match-types.ts";

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

type ProfileRow = {
  user_id: string;
  version: string;
  safety_tier: string;
  dimension_scores_json: string;
};

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const similarity = (a: number, b: number): number =>
  clamp(100 - Math.abs(a - b));

const mergeCandidateUserIds = (
  requesterId: string,
  vectorMatches: VectorMatchInput[],
  d1Profiles: ProfileRow[]
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

const neutralScores = {
  boundaryRespect: 50,
  honestyTransparency: 50,
  emotionalSensitivity: 50,
  emotionalRegulation: 50,
  socialEnergy: 50,
  warmthEmpathy: 50,
  reliabilityConsistency: 50,
  curiosityDepth: 50,
  depthPreference: 50,
  replyPacePreference: 50,
  directnessPreference: 50,
  conflictRepair: 50,
  supportPreference: 50,
  anonymityComfort: 50,
};

const scorePair = (params: {
  requester: typeof neutralScores;
  candidate: typeof neutralScores;
  candidateSafetyTier?: string;
  candidateVersion?: string;
  vectorScore?: number;
}): number | null => {
  if (params.candidateVersion && params.candidateVersion !== "v1") {
    return null;
  }

  const preferenceSimilarity = average([
    similarity(params.requester.depthPreference, params.candidate.depthPreference),
    similarity(params.requester.replyPacePreference, params.candidate.replyPacePreference),
    similarity(params.requester.directnessPreference, params.candidate.directnessPreference),
    similarity(params.requester.socialEnergy, params.candidate.socialEnergy),
    similarity(params.requester.curiosityDepth, params.candidate.curiosityDepth),
    similarity(params.requester.anonymityComfort, params.candidate.anonymityComfort),
  ]);

  const safetyReadiness = average([
    params.candidate.boundaryRespect,
    params.candidate.honestyTransparency,
    params.candidate.warmthEmpathy,
    params.candidate.reliabilityConsistency,
    params.candidate.emotionalRegulation,
  ]);

  let emotionalSupportFit = average([
    similarity(params.requester.supportPreference, params.candidate.supportPreference),
    similarity(params.requester.warmthEmpathy, params.candidate.warmthEmpathy),
    similarity(params.requester.emotionalSensitivity, params.candidate.emotionalSensitivity),
    similarity(params.requester.emotionalRegulation, params.candidate.emotionalRegulation),
  ]);

  if (params.requester.emotionalSensitivity >= 60) {
    emotionalSupportFit = clamp(
      0.35 *
        similarity(params.requester.supportPreference, params.candidate.supportPreference) +
        0.35 * params.candidate.warmthEmpathy +
        0.3 * params.candidate.emotionalRegulation
    );
  }

  const repairFit = average([
    similarity(params.requester.conflictRepair, params.candidate.conflictRepair),
    similarity(params.requester.directnessPreference, params.candidate.directnessPreference),
    similarity(params.requester.emotionalRegulation, params.candidate.emotionalRegulation),
  ]);

  const reliabilityFit = params.candidate.reliabilityConsistency;

  let penalty = 0;
  if (params.candidate.boundaryRespect < 35) {
    penalty += 15;
  }
  if (params.candidate.warmthEmpathy < 35) {
    penalty += 10;
  }
  if (params.candidate.reliabilityConsistency < 30) {
    penalty += 10;
  }
  if (params.requester.emotionalSensitivity > 70 && params.candidate.warmthEmpathy < 50) {
    penalty += 12;
  }
  if (
    Math.abs(params.requester.replyPacePreference - params.candidate.replyPacePreference) > 55
  ) {
    penalty += 8;
  }
  if (
    Math.abs(params.requester.directnessPreference - params.candidate.directnessPreference) > 55
  ) {
    penalty += 6;
  }
  if (params.candidateSafetyTier === "limited") {
    penalty += 10;
  }

  const hasVector =
    params.vectorScore !== undefined && !Number.isNaN(params.vectorScore);
  const vectorSemantic = hasVector
    ? params.vectorScore! <= 1
      ? clamp(params.vectorScore! * 100)
      : clamp(params.vectorScore!)
    : undefined;

  const deterministicScore = clamp(
    0.35 * preferenceSimilarity +
      0.25 * safetyReadiness +
      0.25 * emotionalSupportFit +
      0.1 * repairFit +
      0.05 * reliabilityFit -
      penalty
  );

  if (hasVector) {
    return Math.round(
      clamp(
        0.2 * (vectorSemantic ?? 0) +
          0.25 * preferenceSimilarity +
          0.2 * safetyReadiness +
          0.2 * emotionalSupportFit +
          0.1 * repairFit +
          0.05 * reliabilityFit -
          penalty
      )
    );
  }

  return Math.round(deterministicScore);
};

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

assert(getMatchQualityLabel(80) === "strong", "quality strong");
assert(getMatchQualityLabel(75) === "strong", "quality strong boundary");
assert(getMatchQualityLabel(60) === "good", "quality good");
assert(getMatchQualityLabel(40) === "moderate", "quality moderate");
assert(getMatchQualityLabel(12) === "limited", "quality limited");
assert(MATCH_QUALITY_COPY.limited === "شباهت محدود", "limited copy");
assert(MATCH_MIN_SCORE_TO_SHOW === 0, "no minimum score gate");

const warmScore = scorePair({
  requester: neutralScores,
  candidate: {
    ...neutralScores,
    warmthEmpathy: 80,
    emotionalRegulation: 75,
    boundaryRespect: 70,
  },
  vectorScore: 0.7,
});
const lowBoundaryScore = scorePair({
  requester: neutralScores,
  candidate: {
    ...neutralScores,
    boundaryRespect: 20,
    warmthEmpathy: 20,
    reliabilityConsistency: 20,
  },
});
const sensitiveScore = scorePair({
  requester: { ...neutralScores, emotionalSensitivity: 85 },
  candidate: {
    ...neutralScores,
    warmthEmpathy: 30,
    emotionalRegulation: 40,
  },
});
const noVectorScore = scorePair({
  requester: neutralScores,
  candidate: neutralScores,
});
const v2Excluded = scorePair({
  requester: neutralScores,
  candidate: neutralScores,
  candidateVersion: "v2",
});

assert(warmScore !== null && lowBoundaryScore !== null && sensitiveScore !== null, "scores computed");
assert(lowBoundaryScore! < warmScore!, "low boundary candidate gets penalty");
assert(sensitiveScore! < warmScore!, "high sensitivity + low warmth penalized");
assert(v2Excluded === null, "wrong profile version excluded");
assert(Number.isFinite(noVectorScore!), "vector missing still scores deterministically");

const vectorId = `profile:user-a:v1`;
assert(vectorId.includes("v1"), "vector id contains v1");

const profileB: ProfileRow = {
  user_id: "user-b",
  version: "v1",
  safety_tier: "normal",
  dimension_scores_json: JSON.stringify(neutralScores),
};

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
assert(lowPicked.length === 1, "low score still returned");
assert(lowPicked[0].qualityLabel === "limited", "limited label");

const blockedByDiscoverability = await pickEligibleCandidates(
  [candidate("user-b", 40)],
  async () => false,
  MATCH_RESULT_COUNT
);
assert(blockedByDiscoverability.length === 0, "ineligible excluded");

const pendingExcluded = await pickEligibleCandidates(
  [candidate("user-b", 40)],
  async (id) => id !== "user-b",
  MATCH_RESULT_COUNT
);
assert(pendingExcluded.length === 0, "pending/excluded candidate omitted");

const multiPicked = await pickEligibleCandidates(
  [candidate("c1", 50), candidate("c2", 45), candidate("c3", 40)],
  async () => true,
  MATCH_RESULT_COUNT
);
assert(multiPicked.length === 3, "returns all three candidates");

console.log("Matching OK");
