import type { TestProfileRow } from "../test/test-profile-service";
import type { MatchCandidate } from "./match-types";
import { scoreMatchPair } from "./match-scoring";

export type VectorMatchInput = {
  userId: string;
  vectorScore: number;
};

export const mergeCandidateUserIds = (
  requesterId: string,
  vectorMatches: VectorMatchInput[],
  d1Profiles: TestProfileRow[]
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

export const scoreCandidatePool = (
  requesterProfile: TestProfileRow,
  pool: Map<string, number | undefined>,
  profilesById: Map<string, TestProfileRow>
): MatchCandidate[] => {
  const scored: MatchCandidate[] = [];

  for (const [userId, vectorScore] of pool) {
    const profile = profilesById.get(userId);
    if (!profile) {
      continue;
    }

    scored.push(
      scoreMatchPair({
        requesterProfile,
        candidateProfile: profile,
        vectorScore,
      })
    );
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
};

export const pickEligibleCandidates = async (
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
