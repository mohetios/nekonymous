import { CONVERSATION_DIMENSIONS } from "./constants.ts";
import type {
  ConversationProfile,
  ProfileLocale,
} from "./types.ts";
import type { VectorRouteRole } from "../../storage/profile-vault/profile-vault.types";

export const VECTOR_DIMENSION = 8;
/** Vectorize platform minimum; semantic values occupy the first 8 dimensions. */
export const VECTOR_INDEX_DIMENSION = 32;

export const padVectorForIndex = (values: number[]): number[] => {
  if (values.length !== VECTOR_DIMENSION) {
    throw new Error("expected 8-d conversation vector");
  }
  const padding = Array<number>(VECTOR_INDEX_DIMENSION - VECTOR_DIMENSION).fill(0);
  return [...values, ...padding];
};

/** Coarse retrieval only. Full normalized values stay in the encrypted profile. */
export const QUANTIZATION_LEVELS = [0, 0.25, 0.5, 0.75, 1] as const;

const NEUTRAL_LEVEL = 0.5;

export const quantize = (value: number): number => {
  const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
  return Math.round(clamped * 4) / 4;
};

export const projectSelfVector = (profile: ConversationProfile): number[] =>
  CONVERSATION_DIMENSIONS.map((dimension) =>
    quantize(profile.selfStyle[dimension])
  );

export const projectDesiredVector = (profile: ConversationProfile): number[] =>
  CONVERSATION_DIMENSIONS.map((dimension) =>
    profile.importance[dimension] === 0
      ? NEUTRAL_LEVEL
      : quantize(profile.desiredStyle[dimension])
  );

export const namespaceFor = (
  role: VectorRouteRole,
  locale: ProfileLocale
): string => `${role}-v2-${locale}`;
