import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import { parseResultSummary, profileScoresFromRow } from "../assessment/assessment-profile-service";
import { CORE_DIMENSION_LABELS } from "../assessment/scoring";
import type { AssessmentScores } from "../assessment/scoring";
import { convertToPersianNumbers, escapeHtml } from "../../utils/tools";
import {
  MATCH_PROFILE_NO_TEST,
  MATCH_PROFILE_PRIVACY_NOTE,
  MATCH_PROFILE_VECTOR_PENDING,
} from "./match-system-callbacks";

const COMMUNICATION_LABELS: Record<
  | "depthPreference"
  | "replyPace"
  | "directness"
  | "conflictReflectiveness"
  | "supportNeed"
  | "anonymityComfort",
  string
> = {
  depthPreference: "عمق گفت‌وگو",
  replyPace: "سرعت پاسخ‌دهی",
  directness: "مستقیم‌بودن",
  conflictReflectiveness: "حل سوءتفاهم",
  supportNeed: "نیاز به شنیده‌شدن",
  anonymityComfort: "راحتی با ناشناس‌بودن",
};

const pct = (value: number): string =>
  convertToPersianNumbers(`${Math.round(value)}٪`);

const formatScoreBlock = (
  labels: Record<string, string>,
  scores: AssessmentScores,
  keys: Array<keyof AssessmentScores>
): string =>
  keys
    .map((key) => `${labels[key] ?? key}: ${pct(scores[key])}`)
    .join("\n");

const discoverableLabel = (profile: AssessmentProfileRow): string => {
  if (profile.discoverable === 1) {
    return "فعال";
  }
  return "غیرفعال";
};

const readyForMatchingLabel = (profile: AssessmentProfileRow): string => {
  if (profile.status !== "completed") {
    return "خیر";
  }
  if (profile.vector_status !== "indexed") {
    return "در انتظار آماده‌سازی";
  }
  if (profile.discoverable !== 1) {
    return "نیاز به فعال‌سازی";
  }
  if (profile.safety_tier !== "normal") {
    return "محدود";
  }
  return "بله";
};

const completedStatusLabel = (profile: AssessmentProfileRow): string => {
  if (profile.status === "completed") {
    return "تکمیل‌شده";
  }
  return "ناقص";
};

export const formatMatchProfileMessage = (
  profile: AssessmentProfileRow | null
): { text: string; hasProfile: boolean } => {
  if (!profile || profile.status !== "completed") {
    return {
      text: MATCH_PROFILE_NO_TEST,
      hasProfile: false,
    };
  }

  const summary = parseResultSummary(profile);
  const scores = profileScoresFromRow(profile);

  const coreKeys = Object.keys(CORE_DIMENSION_LABELS) as Array<
    keyof typeof CORE_DIMENSION_LABELS
  >;
  const commKeys = Object.keys(COMMUNICATION_LABELS) as Array<
    keyof typeof COMMUNICATION_LABELS
  >;

  let text =
    "👤 <b>پروفایل مچ‌یابی من</b>\n\n" +
    `نسخه تست: ${escapeHtml(convertToPersianNumbers(profile.version))}\n` +
    `وضعیت: ${escapeHtml(completedStatusLabel(profile))}\n` +
    `آماده برای مچ‌یابی: ${escapeHtml(readyForMatchingLabel(profile))}\n` +
    `مچ‌یابی ناشناس: ${escapeHtml(discoverableLabel(profile))}\n\n` +
    `<b>خلاصه:</b>\n${escapeHtml(summary.title)}\n\n` +
    `${escapeHtml(summary.shortDescription)}\n\n` +
    `<b>امتیازها:</b>\n${escapeHtml(formatScoreBlock(CORE_DIMENSION_LABELS, scores, coreKeys))}\n\n` +
    `<b>سبک گفت‌وگو:</b>\n${escapeHtml(formatScoreBlock(COMMUNICATION_LABELS, scores, commKeys))}\n\n` +
    `<i>${escapeHtml(MATCH_PROFILE_PRIVACY_NOTE)}</i>`;

  if (
    profile.vector_status === "failed" ||
    profile.vector_status === "not_indexed"
  ) {
    text += `\n\n<i>${escapeHtml(MATCH_PROFILE_VECTOR_PENDING)}</i>`;
  }

  return { text, hasProfile: true };
};
