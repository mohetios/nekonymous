import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import { profileScoresFromRow } from "../assessment/assessment-profile-service";
import type { AssessmentScores } from "../assessment/scoring";
import { getMatchQualityLabel } from "./match-quality";
import type { MatchCandidate, MatchExplanation } from "./match-types";

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const traitDistance = (a: AssessmentScores, b: AssessmentScores): number => {
  const keys: Array<keyof AssessmentScores> = [
    "honestyBoundaryRespect",
    "emotionalReactivity",
    "socialEnergy",
    "warmthCooperation",
    "reliabilityConsistency",
    "curiosityDepth",
  ];

  let sum = 0;
  for (const key of keys) {
    sum += Math.abs(a[key] - b[key]);
  }
  return sum / keys.length;
};

const communicationDistance = (a: AssessmentScores, b: AssessmentScores): number => {
  const keys: Array<keyof AssessmentScores> = [
    "depthPreference",
    "replyPace",
    "directness",
    "conflictReflectiveness",
    "supportNeed",
    "anonymityComfort",
  ];

  let sum = 0;
  for (const key of keys) {
    sum += Math.abs(a[key] - b[key]);
  }
  return sum / keys.length;
};

const boundaryDistance = (a: AssessmentScores, b: AssessmentScores): number => {
  const boundary = Math.abs(a.honestyBoundaryRespect - b.honestyBoundaryRespect);
  const supportDirect =
    Math.abs(a.supportNeed - b.supportNeed) +
    Math.abs(a.directness - b.directness);
  return boundary * 0.6 + (supportDirect / 2) * 0.4;
};

const intentCompatibility = (
  requesterIntent: string,
  candidateIntent: string
): number => {
  if (requesterIntent === candidateIntent) {
    return 85;
  }
  const pairs: Record<string, string[]> = {
    "deep-talk": ["support"],
    support: ["deep-talk"],
    "light-chat": ["deep-talk"],
  };
  if (pairs[requesterIntent]?.includes(candidateIntent)) {
    return 72;
  }
  return 65;
};

const distanceToCompatibility = (distance: number): number =>
  clamp(100 - distance);

export const normalizeVectorScore = (score: number | undefined): number => {
  if (score === undefined || Number.isNaN(score)) {
    return 50;
  }
  if (score <= 1) {
    return clamp(score * 100);
  }
  return clamp(score);
};

const pickExplanationTitle = (
  requester: AssessmentScores,
  candidate: AssessmentScores
): string => {
  const depth =
    (requester.depthPreference +
      requester.curiosityDepth +
      candidate.depthPreference +
      candidate.curiosityDepth) /
    4;
  const warmth =
    (requester.warmthCooperation + candidate.warmthCooperation) / 2;
  const pace = (requester.replyPace + candidate.replyPace) / 2;

  if (depth >= 65 && warmth >= 58) {
    return "گفت‌وگوی آرام و عمیق";
  }
  if (pace >= 60 && depth >= 55) {
    return "شروع آرام و محترمانه";
  }
  if (warmth >= 62) {
    return "گفت‌وگوی گرم و کم‌فشار";
  }
  return "گفت‌وگوی متعادل و ناشناس";
};

const buildReasons = (
  requester: AssessmentScores,
  candidate: AssessmentScores
): string[] => {
  const reasons: string[] = [];

  if (
    Math.abs(requester.replyPace - candidate.replyPace) <= 25 &&
    Math.abs(requester.warmthCooperation - candidate.warmthCooperation) <= 30
  ) {
    reasons.push("هر دو گفت‌وگوی کم‌فشار و محترمانه را ترجیح می‌دهید.");
  }

  if (
    Math.abs(requester.curiosityDepth - candidate.curiosityDepth) <= 25 ||
    Math.abs(requester.depthPreference - candidate.depthPreference) <= 25
  ) {
    reasons.push("شباهت خوبی در عمق گفت‌وگو و کنجکاوی دیده می‌شود.");
  }

  if (
    Math.abs(
      requester.honestyBoundaryRespect - candidate.honestyBoundaryRespect
    ) <= 25
  ) {
    reasons.push("هر دو به مرزهای گفت‌وگو اهمیت می‌دهید.");
  }

  if (reasons.length === 0) {
    reasons.push("چند نقطه مشترک در سبک ارتباطی دیده می‌شود.");
  }

  return reasons.slice(0, 3);
};

const buildCautions = (
  requester: AssessmentScores,
  candidate: AssessmentScores
): string[] => {
  const cautions: string[] = [];

  if (Math.abs(requester.replyPace - candidate.replyPace) >= 35) {
    cautions.push(
      "سرعت پاسخ‌دهی ممکن است کمی متفاوت باشد؛ شروع آرام بهتر است."
    );
  }

  if (Math.abs(requester.depthPreference - candidate.depthPreference) >= 40) {
    cautions.push(
      "ترجیح عمق گفت‌وگو ممکن است متفاوت باشد؛ بهتر است انتظارات را زود روشن کنید."
    );
  }

  if (cautions.length === 0) {
    cautions.push(
      "در گفت‌وگوی ناشناس، روشن گفتن انتظاراتت (سرعت، عمق، موضوع) مفید است."
    );
  }

  return cautions.slice(0, 2);
};

const computePenalties = (
  requester: AssessmentProfileRow,
  candidate: AssessmentProfileRow,
  requesterScores: AssessmentScores,
  candidateScores: AssessmentScores
): number => {
  let penalty = 0;

  if (Math.abs(requesterScores.replyPace - candidateScores.replyPace) >= 45) {
    penalty += 15;
  }

  if (
    requesterScores.honestyBoundaryRespect < 35 ||
    candidateScores.honestyBoundaryRespect < 35
  ) {
    penalty += 20;
  }

  if (
    Math.abs(
      requesterScores.depthPreference - candidateScores.depthPreference
    ) >= 50
  ) {
    penalty += 10;
  }

  if (candidate.safety_tier === "limited") {
    penalty += 15;
  }

  if (requester.safety_tier === "limited") {
    penalty += 8;
  }

  return penalty;
};

export const scoreMatchPair = (params: {
  requesterProfile: AssessmentProfileRow;
  candidateProfile: AssessmentProfileRow;
  vectorScore?: number;
}): MatchCandidate => {
  const requesterScores = profileScoresFromRow(params.requesterProfile);
  const candidateScores = profileScoresFromRow(params.candidateProfile);

  const hasVector =
    params.vectorScore !== undefined && !Number.isNaN(params.vectorScore);
  const vectorSemantic = hasVector
    ? normalizeVectorScore(params.vectorScore)
    : undefined;

  const traitCompat = distanceToCompatibility(
    traitDistance(requesterScores, candidateScores)
  );
  const communicationCompat = distanceToCompatibility(
    communicationDistance(requesterScores, candidateScores)
  );
  const boundaryCompat = distanceToCompatibility(
    boundaryDistance(requesterScores, candidateScores)
  );
  const intentCompat = intentCompatibility(
    params.requesterProfile.primary_intent,
    params.candidateProfile.primary_intent
  );

  const penalties = computePenalties(
    params.requesterProfile,
    params.candidateProfile,
    requesterScores,
    candidateScores
  );

  const deterministicScore = clamp(
    0.25 * traitCompat +
      0.28 * communicationCompat +
      0.22 * boundaryCompat +
      0.25 * intentCompat -
      penalties
  );

  const finalScore = hasVector
    ? clamp(
        0.25 * (vectorSemantic ?? 0) +
          0.3 * traitCompat +
          0.25 * communicationCompat +
          0.1 * boundaryCompat +
          0.1 * intentCompat -
          penalties
      )
    : clamp(
        0.4 * traitCompat +
          0.35 * communicationCompat +
          0.15 * boundaryCompat +
          0.1 * intentCompat -
          penalties
      );

  const roundedScore = Math.round(finalScore);

  const explanation: MatchExplanation = {
    title: pickExplanationTitle(requesterScores, candidateScores),
    reasons: buildReasons(requesterScores, candidateScores),
    cautions: buildCautions(requesterScores, candidateScores),
  };

  return {
    userId: params.candidateProfile.user_id,
    score: roundedScore,
    vectorScore: vectorSemantic,
    deterministicScore: Math.round(deterministicScore),
    qualityLabel: getMatchQualityLabel(roundedScore),
    explanation,
  };
};

export const parseMatchExplanation = (raw: string): MatchExplanation => {
  try {
    const parsed = JSON.parse(raw) as MatchExplanation;
    if (parsed?.title && Array.isArray(parsed.reasons)) {
      return {
        title: parsed.title,
        reasons: parsed.reasons,
        cautions: Array.isArray(parsed.cautions) ? parsed.cautions : [],
      };
    }
  } catch {
    // fall through
  }
  return {
    title: "گفت‌وگوی ناشناس",
    reasons: ["چند نقطه مشترک در سبک ارتباطی دیده می‌شود."],
    cautions: [],
  };
};
