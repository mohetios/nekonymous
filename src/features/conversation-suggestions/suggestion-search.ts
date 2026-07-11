import {
  createConversationPairTag,
  createExposureTokenHash,
} from "../ticketing/conversation-keys.ts";
import { getPairStatesBatch } from "../../storage/pair-ledger/pair-ledger.client";
import {
  consumeSuggestionSearchBudget,
  getActiveExposureTokenHashes,
} from "../../storage/user-state-client";
import type { Environment } from "../../types";
import { rankCandidateProfiles } from "../conversation-ranking/rank-candidates.ts";
import type { RankedCandidate } from "../conversation-ranking/types.ts";
import { retrieveConversationCandidates } from "./candidate-retrieval.ts";
import { ELIGIBILITY_MAX_CONCURRENT_PAIR_LOOKUPS } from "./constants.ts";
import { filterEligibleCandidates } from "./eligibility.ts";
import { rerankWithExposure } from "./exposure-reranker.ts";
import type { RetrievalRequest } from "./types.ts";

export type SuggestionSearchResult =
  | { ok: true; results: RankedCandidate[]; remainingSearches?: number }
  | { ok: false; reason: "search_limited" | "no_candidates" };

const mapBounded = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = [];
  let index = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const current = index++;
        results.push(await fn(items[current]));
      }
    })
  );

  return results;
};

const buildPairTagMap = async (
  env: Environment,
  requesterProfileHash: string,
  profileHashes: string[]
): Promise<Map<string, string>> => {
  const entries = await mapBounded(
    profileHashes,
    ELIGIBILITY_MAX_CONCURRENT_PAIR_LOOKUPS,
    async (profileHash) => {
      const pairTag = await createConversationPairTag(
        env.APP_MASTER_KEY,
        requesterProfileHash,
        profileHash
      );
      return [profileHash, pairTag] as const;
    }
  );

  return new Map(entries);
};

const buildExposureTokenMap = async (
  env: Environment,
  pairTags: string[]
): Promise<Map<string, string>> => {
  const entries = await mapBounded(
    pairTags,
    ELIGIBILITY_MAX_CONCURRENT_PAIR_LOOKUPS,
    async (pairTag) => {
      const tokenHash = await createExposureTokenHash(
        env.APP_MASTER_KEY,
        pairTag
      );
      return [pairTag, tokenHash] as const;
    }
  );

  return new Map(entries);
};

export const searchConversationSuggestions = async (
  env: Environment,
  userId: string,
  request: RetrievalRequest
): Promise<SuggestionSearchResult> => {
  const budget = await consumeSuggestionSearchBudget(env, userId);
  if (budget.limited) {
    return { ok: false, reason: "search_limited" };
  }

  const retrieval = await retrieveConversationCandidates(env, request);
  if (retrieval.candidates.length === 0) {
    return { ok: false, reason: "no_candidates" };
  }

  const pairTagsByProfile = await buildPairTagMap(
    env,
    request.requesterProfileHash,
    retrieval.candidates.map((candidate) => candidate.profileHash)
  );

  const pairStates = await getPairStatesBatch(
    env,
    [...pairTagsByProfile.values()],
    ELIGIBILITY_MAX_CONCURRENT_PAIR_LOOKUPS
  );

  const eligible = filterEligibleCandidates(
    retrieval.candidates,
    pairTagsByProfile,
    pairStates
  );
  if (eligible.length === 0) {
    return { ok: false, reason: "no_candidates" };
  }

  const ranked = rankCandidateProfiles(
    request.requesterProfile,
    eligible,
    pairTagsByProfile
  );
  if (ranked.length === 0) {
    return { ok: false, reason: "no_candidates" };
  }

  const exposureTokenByPairTag = await buildExposureTokenMap(
    env,
    ranked.map((candidate) => candidate.pairTag)
  );
  const recentExposure = new Set(
    await getActiveExposureTokenHashes(env, userId)
  );

  const results = rerankWithExposure(
    ranked,
    recentExposure,
    exposureTokenByPairTag
  );

  return {
    ok: true,
    results,
    remainingSearches: budget.remaining,
  };
};
