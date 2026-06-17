import type { Environment } from "../../types";
import { logBotError } from "../../utils/logs";
import { buildProfileVectorId } from "../assessment/profile-vector-service";
import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import { MATCH_SEARCH_TOP_K } from "./constants";

type VectorMatch = {
  userId: string;
  vectorScore: number;
};

const metadataAsRecord = (metadata: unknown): Record<string, unknown> | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  return metadata as Record<string, unknown>;
};

const extractUserId = (metadata: unknown): string | null => {
  const record = metadataAsRecord(metadata);
  if (!record) {
    return null;
  }
  const userId = record.userId;
  return typeof userId === "string" ? userId : null;
};

export const queryVectorCandidates = async (
  requesterProfile: AssessmentProfileRow,
  locale: string,
  env: Environment
): Promise<VectorMatch[]> => {
  const vectorId =
    requesterProfile.vector_id ??
    buildProfileVectorId(requesterProfile.user_id, requesterProfile.version);

  const stored = await env.PROFILE_VECTORS.getByIds([vectorId]);
  const vector = stored[0];
  if (!vector?.values?.length) {
    return [];
  }

  const filter: Record<string, string | boolean> = {
    discoverable: true,
    locale: locale === "en" ? "en" : "fa",
    safetyTier: "normal",
  };

  let result: Awaited<ReturnType<Environment["PROFILE_VECTORS"]["query"]>>;
  try {
    result = await env.PROFILE_VECTORS.query(vector.values, {
      topK: MATCH_SEARCH_TOP_K,
      returnValues: false,
      returnMetadata: "indexed",
      filter,
    });
  } catch (error) {
    logBotError("queryVectorCandidates", error);
    return [];
  }

  const matches: VectorMatch[] = [];
  for (const match of result.matches) {
    const userId = extractUserId(match.metadata);
    if (!userId || userId === requesterProfile.user_id) {
      continue;
    }
    matches.push({
      userId,
      vectorScore: match.score,
    });
  }

  return matches;
};
