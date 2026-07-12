import type { Environment } from "../../../types";
import type { ConversationProfile } from "../profile/types.ts";
import {
  namespaceFor,
  projectDesiredVector,
  projectSelfVector,
  padVectorForIndex,
} from "../profile/vector-projection.ts";
import { RETRIEVAL_TOP_K_PER_CHANNEL } from "./constants.ts";
import { resolveCandidateProfiles } from "./candidate-resolution.ts";
import {
  expectedRoleForChannel,
  mergeVectorHits,
} from "./retrieval-utils.ts";
import type {
  RetrievalRequest,
  RetrievalResult,
  VectorHit,
} from "./types.ts";

const queryChannel = async (
  env: Environment,
  values: number[],
  namespace: string
): Promise<string[]> => {
  const result = await env.CONVERSATION_VECTORS.query(values, {
    topK: RETRIEVAL_TOP_K_PER_CHANNEL,
    namespace,
    returnMetadata: "none",
    returnValues: false,
  });

  return (result.matches ?? []).map((match) => match.id);
};

export const queryDualChannelVectorHits = async (
  env: Environment,
  requesterProfile: ConversationProfile
): Promise<VectorHit[]> => {
  const locale = requesterProfile.locale;
  const desiredValues = padVectorForIndex(projectDesiredVector(requesterProfile));
  const selfValues = padVectorForIndex(projectSelfVector(requesterProfile));

  const [selfNamespaceHits, desiredNamespaceHits] = await Promise.all([
    queryChannel(
      env,
      desiredValues,
      namespaceFor("self", locale)
    ),
    queryChannel(
      env,
      selfValues,
      namespaceFor("desired", locale)
    ),
  ]);

  const desiredChannelHits: VectorHit[] = selfNamespaceHits.map((vectorizeId) => ({
    vectorizeId,
    channel: "desired_to_self",
  }));
  const selfChannelHits: VectorHit[] = desiredNamespaceHits.map((vectorizeId) => ({
    vectorizeId,
    channel: "self_to_desired",
  }));

  return mergeVectorHits(desiredChannelHits, selfChannelHits);
};

export const retrieveConversationCandidates = async (
  env: Environment,
  request: RetrievalRequest
): Promise<RetrievalResult> => {
  const vectorHits = await queryDualChannelVectorHits(
    env,
    request.requesterProfile
  );

  const candidates = await resolveCandidateProfiles(env, {
    requesterProfileHash: request.requesterProfileHash,
    requesterLocale: request.requesterProfile.locale,
    vectorHits,
    expectedRoleForChannel,
  });

  return {
    candidates,
    vectorHits: vectorHits.length,
    resolvedHits: candidates.length,
  };
};
