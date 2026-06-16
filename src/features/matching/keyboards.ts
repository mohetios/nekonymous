import { InlineKeyboard } from "grammy";
import { MATCH_CALLBACK } from "./constants";
import type { MatchQualityLabel } from "./match-types";
import { assertCallbackData } from "../../utils/telegram-limits";
import { convertToPersianNumbers, escapeHtml } from "../../utils/tools";
import {
  MATCH_LIMITED_SIMILARITY_NOTE,
  MATCH_QUALITY_COPY,
  MATCH_SIMILARITY_DISCLAIMER,
  formatMatchRequestSimilarityLine,
} from "./match-quality";
import {
  MATCH_PENDING_INCOMING_LABEL,
  MATCH_PENDING_OUTGOING_LABEL,
} from "./match-copy";

/** Inline search trigger when the user is ready to match. */
export const buildMatchSearchKeyboard = (): InlineKeyboard =>
  new InlineKeyboard().text("پیدا کردن ۵ مچ نزدیک", MATCH_CALLBACK.search);

export const buildIncomingMatchRequestKeyboard = (
  requestId: string
): InlineKeyboard => {
  const acceptData = MATCH_CALLBACK.accept(requestId);
  const declineData = MATCH_CALLBACK.decline(requestId);
  assertCallbackData(acceptData);
  assertCallbackData(declineData);
  return new InlineKeyboard()
    .text("قبول می‌کنم", acceptData)
    .text("رد می‌کنم", declineData);
};

export const buildOutgoingMatchRequestKeyboard = (
  requestId: string
): InlineKeyboard => {
  const cancelData = MATCH_CALLBACK.cancel(requestId);
  assertCallbackData(cancelData);
  return new InlineKeyboard().text("لغو درخواست", cancelData);
};

const formatMatchRequestReasons = (reasons: string[]): string =>
  reasons
    .slice(0, 2)
    .map((r) => `- ${escapeHtml(r)}`)
    .join("\n");

export const formatIncomingMatchRequestMessage = (params: {
  score: number;
  qualityLabel: MatchQualityLabel;
  explanation: { reasons: string[] };
  introText: string;
}): string => {
  const scoreText = convertToPersianNumbers(String(Math.round(params.score)));
  const similarityLine = escapeHtml(
    formatMatchRequestSimilarityLine(scoreText, params.qualityLabel)
  );

  return (
    `${MATCH_PENDING_INCOMING_LABEL}\n\n` +
    `${similarityLine}\n\n` +
    `<i>${escapeHtml(MATCH_SIMILARITY_DISCLAIMER)}</i>\n\n` +
    "<b>چرا ممکن است مناسب باشد؟</b>\n" +
    `${formatMatchRequestReasons(params.explanation.reasons)}\n\n` +
    "<b>پیام شروع:</b>\n" +
    `«${escapeHtml(params.introText)}»\n\n` +
    "اگر قبول کنی، این پیام به شکل یک گفت‌وگوی ناشناس وارد صندوقت می‌شود.\n" +
    "اگر رد کنی، هویت هیچ‌کدام نمایش داده نمی‌شود."
  );
};

export const formatOutgoingMatchRequestMessage = (params: {
  score: number;
  qualityLabel: MatchQualityLabel;
  explanation: { reasons: string[] };
  introText: string;
}): string => {
  const scoreText = convertToPersianNumbers(String(Math.round(params.score)));
  const similarityLine = escapeHtml(
    formatMatchRequestSimilarityLine(scoreText, params.qualityLabel)
  );

  return (
    `${MATCH_PENDING_OUTGOING_LABEL}\n\n` +
    `${similarityLine}\n\n` +
    "<b>پیام شروع:</b>\n" +
    `«${escapeHtml(params.introText)}»\n\n` +
    "منتظر پاسخ طرف مقابل هستی.\n" +
    "اگر دیگر نمی‌خواهی منتظر بمانی، می‌توانی درخواست را لغو کنی."
  );
};

export const buildMatchResultsKeyboard = (
  suggestionIds: string[]
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  suggestionIds.forEach((id, index) => {
    const data = MATCH_CALLBACK.request(id);
    assertCallbackData(data);
    keyboard.text(`درخواست گفت‌وگو با ${index + 1}`, data).row();
  });

  return keyboard;
};

export const formatMatchCandidatesMessage = (
  candidates: Array<{
    score: number;
    qualityLabel: MatchQualityLabel;
    explanation: { title: string; reasons: string[] };
  }>
): string => {
  const count = candidates.length;
  let text =
    "🔎 نزدیک‌ترین پیشنهادهای فعلی\n\n" +
    `در حال حاضر ${convertToPersianNumbers(String(count))} گزینه پیدا شد.\n` +
    "این درصدها تقریبی‌اند و فقط برای شروع گفت‌وگوی بهتر استفاده می‌شوند.\n";

  if (count === 1) {
    text += "\nفعلاً فقط یک گزینه قابل پیشنهاد پیدا شد.\n";
  }

  text += "\n";

  candidates.forEach((candidate, index) => {
    const reasons = candidate.explanation.reasons
      .slice(0, 2)
      .map((r) => `- ${r}`)
      .join("\n");

    const qualityLabel = MATCH_QUALITY_COPY[candidate.qualityLabel];

    text +=
      `${convertToPersianNumbers(String(index + 1))}) ${qualityLabel} — ${convertToPersianNumbers(String(candidate.score))}٪\n\n` +
      `${candidate.explanation.title}\n\n` +
      "چرا ممکن است مناسب باشد؟\n" +
      `${reasons}\n`;

    if (candidate.qualityLabel === "limited") {
      text += `\n${MATCH_LIMITED_SIMILARITY_NOTE}\n`;
    }

    text += "\n";
  });

  return escapeHtml(text.trim());
};
