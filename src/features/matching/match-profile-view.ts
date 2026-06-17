import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import { parseResultSummary, profileScoresFromRow } from "../assessment/assessment-profile-service";
import { ASSESSMENT_DIMENSION_LABELS } from "../assessment/question-bank";
import type { AssessmentDimension, AssessmentScores } from "../assessment/scoring";
import { convertToPersianNumbers, escapeHtml } from "../../utils/tools";
import {
  MATCH_PROFILE_NO_ASSESSMENT,
  MATCH_PROFILE_PRIVACY_NOTE,
  MATCH_PROFILE_VECTOR_PENDING,
} from "./match-system-callbacks";

const PREFERENCE_DIMENSIONS: AssessmentDimension[] = [
  "depthPreference",
  "replyPacePreference",
  "directnessPreference",
  "conflictRepair",
  "supportPreference",
  "anonymityComfort",
];

const pct = (value: number): string =>
  convertToPersianNumbers(`${Math.round(value)}٪`);

const formatScoreBlock = (
  scores: AssessmentScores,
  keys: AssessmentDimension[]
): string =>
  keys
    .map((key) => `${ASSESSMENT_DIMENSION_LABELS[key]}: ${pct(scores[key])}`)
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
      text: MATCH_PROFILE_NO_ASSESSMENT,
      hasProfile: false,
    };
  }

  const summary = parseResultSummary(profile);
  const scores = profileScoresFromRow(profile);

  const coreKeys: AssessmentDimension[] = [
    "boundaryRespect",
    "honestyTransparency",
    "emotionalSensitivity",
    "emotionalRegulation",
    "socialEnergy",
    "warmthEmpathy",
    "reliabilityConsistency",
    "curiosityDepth",
  ];

  let text =
    "👤 <b>پروفایل مچ‌یابی من</b>\n\n" +
    `نسخه ارزیابی: ${escapeHtml(convertToPersianNumbers(profile.version))}\n` +
    `وضعیت: ${escapeHtml(completedStatusLabel(profile))}\n` +
    `آماده برای مچ‌یابی: ${escapeHtml(readyForMatchingLabel(profile))}\n` +
    `مچ‌یابی ناشناس: ${escapeHtml(discoverableLabel(profile))}\n\n` +
    `<b>خلاصه:</b>\n${escapeHtml(summary.title)}\n\n` +
    `${escapeHtml(summary.shortDescription)}\n\n` +
    `<b>امتیازها:</b>\n${escapeHtml(formatScoreBlock(scores, coreKeys))}\n\n` +
    `<b>ترجیح‌های گفت‌وگو:</b>\n${escapeHtml(formatScoreBlock(scores, PREFERENCE_DIMENSIONS))}\n\n` +
    `<i>${escapeHtml(MATCH_PROFILE_PRIVACY_NOTE)}</i>`;

  if (
    profile.vector_status === "failed" ||
    profile.vector_status === "not_indexed"
  ) {
    text += `\n\n<i>${escapeHtml(MATCH_PROFILE_VECTOR_PENDING)}</i>`;
  }

  return { text, hasProfile: true };
};
