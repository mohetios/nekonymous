import { CONVERSATION_DIMENSIONS } from "./constants.ts";
import type { ConversationProfile, ProfileLocale } from "./types.ts";

const INTENT_LABELS_FA: Record<ConversationProfile["currentIntent"], string> = {
  light: "گفت‌وگوی سبک و کم‌فشار",
  deep: "گفت‌وگوی عمیق‌تر",
  support: "شنیده‌شدن و همراهی",
  exploration: "کشف موضوع‌های تازه",
  open: "بدون ترجیح مشخص",
};

const INTENT_LABELS_EN: Record<ConversationProfile["currentIntent"], string> = {
  light: "light, low-pressure chat",
  deep: "deeper conversation",
  support: "listening and support",
  exploration: "exploring new topics",
  open: "no strong preference",
};

const DIMENSION_LABELS_FA: Record<(typeof CONVERSATION_DIMENSIONS)[number], string> = {
  depth: "عمق گفت‌وگو",
  replyPace: "ریتم پاسخ",
  directness: "مستقیم‌بودن",
  energy: "انرژی گفت‌وگو",
  playfulness: "سبک و شوخی",
  supportStyle: "همراهی احساسی",
  disclosurePace: "سرعت باز شدن",
  repairStyle: "ترمیم سوءتفاهم",
};

const formatPercent = (value: number): string =>
  `${Math.round(value * 100)}٪`;

export const buildProfileSummaryText = (
  profile: ConversationProfile,
  locale: ProfileLocale
): string => {
  const intentLabel =
    locale === "en"
      ? INTENT_LABELS_EN[profile.currentIntent]
      : INTENT_LABELS_FA[profile.currentIntent];

  const topDimensions = CONVERSATION_DIMENSIONS.map((dimension) => ({
    dimension,
    weight: profile.importance[dimension],
    self: profile.selfStyle[dimension],
  }))
    .filter((entry) => entry.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3);

  if (locale === "en") {
    const lines = [
      `Current openness: ${intentLabel}.`,
      "This is a conversation-style snapshot, not a personality label.",
    ];
    if (topDimensions.length > 0) {
      lines.push(
        "Stronger preferences: " +
          topDimensions
            .map(
              (entry) =>
                `${entry.dimension} (${formatPercent(entry.self)})`
            )
            .join(", ")
      );
    }
    return lines.join("\n");
  }

  const lines = [
    `تمایل فعلی: ${intentLabel}.`,
    "این خلاصه فقط تصویری از سبک گفت‌وگوی توست، نه برچسب شخصیتی.",
  ];

  if (topDimensions.length > 0) {
    lines.push(
      "چند ترجیح پررنگ‌تر: " +
        topDimensions
          .map(
            (entry) =>
              `${DIMENSION_LABELS_FA[entry.dimension]} (${formatPercent(entry.self)})`
          )
          .join("، ")
    );
  }

  return lines.join("\n");
};
