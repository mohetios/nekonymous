import { CONVERSATION_DIMENSIONS } from "../profile/constants.ts";
import type {
  ConversationDimension,
  ConversationProfile,
  ProfileLocale,
} from "../../../contracts/conversation/profile";
import {
  DIMENSION_FIT_ALIGNED,
  DIMENSION_FIT_DIFFERENCE,
  INTENT_MATCH_BOOST,
  INTENT_MISMATCH_PENALTY,
  MAX_ALIGNED_DIMENSIONS,
  MAX_DIFFERENCE_DIMENSIONS,
} from "./ranking-constants.ts";

const DIMENSION_REASON_FA: Record<ConversationDimension, string> = {
  depth: "هر دوتون گفت‌وگوی عمیق‌تر رو دوست دارین.",
  replyPace: "ریتم جواب‌دادنتون به هم نزدیکه.",
  directness: "هر دوتون با حرف روشن راحت‌تر هستین.",
  energy: "انرژی گفت‌وگوتون به هم نزدیکه.",
  playfulness: "هر دوتون از شوخی توی گفت‌وگو لذت می‌برین.",
  supportStyle: "سبک حمایت‌کردنتون شبیه همه.",
  disclosurePace: "برای بازکردن بحث‌های شخصی تقریباً یک ریتم دارین.",
  repairStyle: "بعد از سوءتفاهم تقریباً یک مدل برگشتن به گفت‌وگو رو دوست دارین.",
};

const DIMENSION_DIFFERENCE_FA: Record<ConversationDimension, string> = {
  depth: "یکی‌تون گفت‌وگوی عمیق‌تری دوست داره.",
  replyPace: "یکی‌تون معمولاً سریع‌تر جواب می‌ده.",
  directness: "یکی‌تون کمی مستقیم‌تر حرف می‌زنه.",
  energy: "یکی‌تون گفت‌وگوی پرپیام‌تری دوست داره.",
  playfulness: "یکی‌تون شوخی بیشتری توی گفت‌وگو دوست داره.",
  supportStyle: "یکی‌تون بیشتر شنیدن رو می‌پسنده و یکی‌تون راه‌حل‌دادن رو.",
  disclosurePace: "یکی‌تون زودتر وارد موضوع‌های شخصی می‌شه.",
  repairStyle: "یکی‌تون زودتر برای ترمیم سوءتفاهم برمی‌گرده.",
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
        `Aligned on ${aligned
          .map((entry) => DIMENSION_LABELS_EN[entry.dimension])
          .join(" and ")}.`
      );
    }
    if (differences.length > 0) {
      parts.push(
        `Different pace on ${DIMENSION_LABELS_EN[differences[0].dimension]}.`
      );
    }
    if (parts.length === 0) {
      parts.push("A balanced conversation-style overlap.");
    }
    return parts.join(" ");
  }

  const parts: string[] = [];
  if (aligned.length > 0) {
    parts.push(...aligned.map((entry) => `• ${DIMENSION_REASON_FA[entry.dimension]}`));
  }
  if (differences.length > 0) {
    parts.push(`\nیک تفاوت احتمالی:\n• ${DIMENSION_DIFFERENCE_FA[differences[0].dimension]}`);
  }
  if (parts.length === 0) {
    parts.push("• سبک گفت‌وگوتون چند نقطه‌ی مشترک قابل شروع داره.");
  }
  return parts.join("\n");
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
