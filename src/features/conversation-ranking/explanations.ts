import { CONVERSATION_DIMENSIONS } from "../conversation-profile/constants.ts";
import type {
  ConversationDimension,
  ConversationProfile,
  ProfileLocale,
} from "../conversation-profile/types.ts";
import {
  DIMENSION_FIT_ALIGNED,
  DIMENSION_FIT_DIFFERENCE,
  INTENT_MATCH_BOOST,
  INTENT_MISMATCH_PENALTY,
  MAX_ALIGNED_DIMENSIONS,
  MAX_DIFFERENCE_DIMENSIONS,
} from "./constants.ts";
import { computeDirectionalFit } from "./directional-fit.ts";

const DIMENSION_LABELS_FA: Record<ConversationDimension, string> = {
  depth: "عمق گفت‌وگو",
  replyPace: "ریتم پاسخ",
  directness: "مستقیم‌بودن",
  energy: "انرژی گفت‌وگو",
  playfulness: "سبک و شوخی",
  supportStyle: "همراهی احساسی",
  disclosurePace: "سرعت باز شدن",
  repairStyle: "ترمیم سوءتفاهم",
};

const DIMENSION_LABELS_EN: Record<ConversationDimension, string> = {
  depth: "conversation depth",
  replyPace: "reply pace",
  directness: "directness",
  energy: "chat energy",
  playfulness: "playfulness",
  supportStyle: "support style",
  disclosurePace: "disclosure pace",
  repairStyle: "repair style",
};

const dimensionFit = (
  requester: ConversationProfile,
  candidate: ConversationProfile,
  dimension: ConversationDimension
): number | null => {
  const importance = requester.importance[dimension];
  if (importance <= 0) {
    return null;
  }

  const desired = requester.desiredStyle[dimension];
  const candidateSelf = candidate.selfStyle[dimension];
  return 1 - Math.abs(desired - candidateSelf);
};

export const buildSuggestionExplanation = (
  requester: ConversationProfile,
  candidate: ConversationProfile,
  locale: ProfileLocale
): string => {
  const labels = locale === "en" ? DIMENSION_LABELS_EN : DIMENSION_LABELS_FA;

  const scored = CONVERSATION_DIMENSIONS.map((dimension) => {
    const fit = dimensionFit(requester, candidate, dimension);
    if (fit === null) {
      return null;
    }
    return {
      dimension,
      fit,
      weight: requester.importance[dimension],
    };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const aligned = scored
    .filter((entry) => entry.fit >= DIMENSION_FIT_ALIGNED)
    .sort((left, right) => right.fit - left.fit || right.weight - left.weight)
    .slice(0, MAX_ALIGNED_DIMENSIONS);

  const differences = scored
    .filter((entry) => entry.fit <= DIMENSION_FIT_DIFFERENCE)
    .sort((left, right) => left.fit - right.fit || right.weight - left.weight)
    .slice(0, MAX_DIFFERENCE_DIMENSIONS);

  if (locale === "en") {
    const parts: string[] = [];
    if (aligned.length > 0) {
      parts.push(
        `Aligned on ${aligned.map((entry) => labels[entry.dimension]).join(" and ")}.`
      );
    }
    if (differences.length > 0) {
      parts.push(
        `Different pace on ${labels[differences[0].dimension]}.`
      );
    }
    if (parts.length === 0) {
      parts.push("A balanced conversation-style overlap.");
    }
    return parts.join(" ");
  }

  const parts: string[] = [];
  if (aligned.length > 0) {
    parts.push(
      `هم‌راستایی در ${aligned.map((entry) => labels[entry.dimension]).join(" و ")}.`
    );
  }
  if (differences.length > 0) {
    parts.push(`تفاوت معنادار در ${labels[differences[0].dimension]}.`);
  }
  if (parts.length === 0) {
    parts.push("هم‌پوشانی متوازن در سبک گفت‌وگو.");
  }
  return parts.join(" ");
};

export const intentsAreCompatible = (
  left: ConversationProfile["currentIntent"],
  right: ConversationProfile["currentIntent"]
): boolean => {
  if (left === "open" || right === "open") {
    return true;
  }
  if (left === right) {
    return true;
  }

  const softPairs = new Set([
    "light:exploration",
    "exploration:light",
    "deep:support",
    "support:deep",
    "deep:exploration",
    "exploration:deep",
    "support:exploration",
    "exploration:support",
  ]);

  return softPairs.has(`${left}:${right}`);
};

export const computeIntentAdjustment = (
  requester: ConversationProfile,
  candidate: ConversationProfile
): number => {
  if (requester.currentIntent === candidate.currentIntent) {
    return INTENT_MATCH_BOOST;
  }
  if (intentsAreCompatible(requester.currentIntent, candidate.currentIntent)) {
    return 0;
  }
  return INTENT_MISMATCH_PENALTY;
};

/** Guardrail for tests: explanation must come from profile geometry only. */
export const explanationUsesProfilesOnly = (
  requester: ConversationProfile,
  candidate: ConversationProfile
): boolean => {
  const directional = computeDirectionalFit(requester, candidate);
  return directional >= 0 && directional <= 1;
};
