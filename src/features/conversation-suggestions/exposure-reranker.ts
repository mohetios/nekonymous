import { MIN_RECIPROCAL_SCORE } from "../conversation-ranking/constants.ts";
import type { RankedCandidate } from "../conversation-ranking/types.ts";
import {
  EXPOSURE_LOW_BOOST,
  EXPOSURE_RECENT_PENALTY,
  MAX_SUGGESTION_RESULTS,
} from "./constants.ts";

const clampScore = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

export const applyExposureAdjustments = (
  ranked: RankedCandidate[],
  recentExposureTokenHashes: Set<string>,
  exposureTokenByPairTag: Map<string, string>
): RankedCandidate[] =>
  ranked
    .map((candidate) => {
      const exposureToken = exposureTokenByPairTag.get(candidate.pairTag);
      const recentlyShown =
        !!exposureToken && recentExposureTokenHashes.has(exposureToken);
      const exposureDelta = recentlyShown
        ? -EXPOSURE_RECENT_PENALTY
        : EXPOSURE_LOW_BOOST;

      return {
        ...candidate,
        finalScore: clampScore(candidate.finalScore + exposureDelta),
      };
    })
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) {
        return right.finalScore - left.finalScore;
      }
      return left.profileHash.localeCompare(right.profileHash);
    });

export const selectSuggestionResults = (
  ranked: RankedCandidate[]
): RankedCandidate[] => {
  const aboveThreshold = ranked.filter(
    (candidate) => candidate.reciprocalScore >= MIN_RECIPROCAL_SCORE
  );
  const belowThreshold = ranked.filter(
    (candidate) => candidate.reciprocalScore < MIN_RECIPROCAL_SCORE
  );

  const selected = [...aboveThreshold];

  if (
    aboveThreshold.length > 0 &&
    belowThreshold.length > 0 &&
    selected.length < MAX_SUGGESTION_RESULTS
  ) {
    const exploration =
      belowThreshold.find((candidate) => candidate.channels.length >= 2) ??
      belowThreshold[0];
    if (
      exploration &&
      !selected.some(
        (candidate) => candidate.profileHash === exploration.profileHash
      )
    ) {
      selected.push(exploration);
    }
  }

  return selected.slice(0, MAX_SUGGESTION_RESULTS);
};

export const rerankWithExposure = (
  ranked: RankedCandidate[],
  recentExposureTokenHashes: Set<string>,
  exposureTokenByPairTag: Map<string, string>
): RankedCandidate[] => {
  const adjusted = applyExposureAdjustments(
    ranked,
    recentExposureTokenHashes,
    exposureTokenByPairTag
  );
  return selectSuggestionResults(adjusted);
};
