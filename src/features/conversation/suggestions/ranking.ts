import type { ConversationProfile } from "../../../contracts/conversation/profile";
import type { CandidateProfile } from "../../../contracts/conversation/retrieval";
import { computeDirectionalFit } from "./directional-fit.ts";
import {
  buildSuggestionExplanation,
  computeIntentAdjustment,
} from "./explanations.ts";
import { fuseReciprocalScore } from "./reciprocal-fit.ts";
import type { RankedCandidate } from "./ranking-types.ts";

export const rankCandidateProfiles = (
  requester: ConversationProfile,
  candidates: CandidateProfile[],
  pairTags: Map<string, string>
): RankedCandidate[] => {
  const ranked = candidates
    .map((candidate) => {
      const requesterToCandidate = computeDirectionalFit(
        requester,
        candidate.profile
      );
      const candidateToRequester = computeDirectionalFit(
        candidate.profile,
        requester
      );
      const reciprocalScore = fuseReciprocalScore(
        requesterToCandidate,
        candidateToRequester
      );
      const intentAdjustment = computeIntentAdjustment(
        requester,
        candidate.profile
      );
      const finalScore = Math.max(
        0,
        Math.min(1, reciprocalScore + intentAdjustment)
      );
      const pairTag = pairTags.get(candidate.profileHash);
      if (!pairTag) {
        return null;
      }

      return {
        profileHash: candidate.profileHash,
        revision: candidate.revision,
        profile: candidate.profile,
        pairTag,
        channels: candidate.channels,
        requesterToCandidate,
        candidateToRequester,
        reciprocalScore,
        intentAdjustment,
        finalScore,
        explanation: buildSuggestionExplanation(
          requester,
          candidate.profile,
          requester.locale
        ),
      } satisfies RankedCandidate;
    })
    .filter((entry): entry is RankedCandidate => entry !== null);

  return ranked.sort((left, right) => {
    if (right.finalScore !== left.finalScore) {
      return right.finalScore - left.finalScore;
    }
    return left.profileHash.localeCompare(right.profileHash);
  });
};
