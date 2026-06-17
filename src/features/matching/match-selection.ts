import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import type { MatchCandidate } from "./match-types";
import { compareCandidateRanking, scoreMatchPair } from "./match-scoring";

export type VectorMatchInput = {
  userId: string;
  vectorScore: number;
};

export const mergeCandidateUserIds = (
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

export const scoreCandidatePool = (
  requesterProfile: AssessmentProfileRow,
  pool: Map<string, number | undefined>,
  profilesById: Map<string, AssessmentProfileRow>
): MatchCandidate[] => {
  const scored: MatchCandidate[] = [];

  for (const [userId, vectorScore] of pool) {
    const profile = profilesById.get(userId);
    if (!profile) {
      continue;
    }

    const candidate = scoreMatchPair({
      requesterProfile,
      candidateProfile: profile,
      vectorScore,
    });
    if (!candidate) {
      continue;
    }

    scored.push(candidate);
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const profileA = profilesById.get(a.userId);
    const profileB = profilesById.get(b.userId);
    if (!profileA || !profileB) {
      return 0;
    }

    return compareCandidateRanking(
      requesterProfile.version,
      profileA.version,
      profileB.version
    );
  });
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
