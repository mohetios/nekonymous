import type { AssessmentProfileRow } from "../assessment/assessment-profile-service";
import { scoresFromJson } from "../assessment/assessment-scores";
import { ASSESSMENT_VERSION } from "../assessment/question-bank";
import type { AssessmentDimension, AssessmentScores } from "../assessment/scoring";
import { getMatchQualityLabel } from "./match-quality";
import type { MatchCandidate, MatchExplanation } from "./match-types";

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

export const MATCHING_SIGNAL_GROUPS = {
  directionalSafety: [
    "boundaryRespect",
    "honestyTransparency",
    "warmthEmpathy",
    "reliabilityConsistency",
    "emotionalRegulation",
  ],
  similarityPreference: [
    "depthPreference",
    "replyPacePreference",
    "directnessPreference",
    "socialEnergy",
    "curiosityDepth",
    "anonymityComfort",
  ],
  supportCompatibility: [
    "supportPreference",
    "warmthEmpathy",
    "emotionalSensitivity",
    "emotionalRegulation",
  ],
  repairCompatibility: [
    "conflictRepair",
    "directnessPreference",
    "emotionalRegulation",
  ],
} as const satisfies Record<string, AssessmentDimension[]>;

const similarity = (a: number, b: number): number =>
  clamp(100 - Math.abs(a - b));

const average = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const groupSimilarity = (
  requester: AssessmentScores,
  candidate: AssessmentScores,
  keys: ReadonlyArray<AssessmentDimension>
): number => {
  const values = keys.map((key) => similarity(requester[key], candidate[key]));
  return average(values);
};

const directionalAverage = (
  scores: AssessmentScores,
  keys: ReadonlyArray<AssessmentDimension>
): number => average(keys.map((key) => scores[key]));

export const normalizeVectorScore = (score: number | undefined): number => {
  if (score === undefined || Number.isNaN(score)) {
    return 50;
  }
  if (score <= 1) {
    return clamp(score * 100);
  }
  return clamp(score);
};

const computeEmotionalSupportFit = (
  requester: AssessmentScores,
  candidate: AssessmentScores
): number => {
  const supportSim = similarity(
    requester.supportPreference,
    candidate.supportPreference
  );

  if (requester.emotionalSensitivity >= 60) {
    const warmthFit = candidate.warmthEmpathy;
    const regulationFit = candidate.emotionalRegulation;
    return clamp(0.35 * supportSim + 0.35 * warmthFit + 0.3 * regulationFit);
  }

  return groupSimilarity(
    requester,
    candidate,
    MATCHING_SIGNAL_GROUPS.supportCompatibility
  );
};

const computePenalties = (
  requester: AssessmentScores,
  candidate: AssessmentScores,
  candidateProfile: AssessmentProfileRow
): number => {
  let penalty = 0;

  if (candidate.boundaryRespect < 35) {
    penalty += 15;
  }
  if (candidate.warmthEmpathy < 35) {
    penalty += 10;
  }
  if (candidate.reliabilityConsistency < 30) {
    penalty += 10;
  }
  if (
    requester.emotionalSensitivity > 70 &&
    candidate.warmthEmpathy < 50
  ) {
    penalty += 12;
  }
  if (
    Math.abs(requester.replyPacePreference - candidate.replyPacePreference) > 55
  ) {
    penalty += 8;
  }
  if (
    Math.abs(requester.directnessPreference - candidate.directnessPreference) >
    55
  ) {
    penalty += 6;
  }

  if (candidateProfile.safety_tier === "limited") {
    penalty += 10;
  }

  return penalty;
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
    (requester.warmthEmpathy + candidate.warmthEmpathy) / 2;
  const pace =
    (requester.replyPacePreference + candidate.replyPacePreference) / 2;

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
    Math.abs(requester.replyPacePreference - candidate.replyPacePreference) <=
      25 &&
    Math.abs(requester.warmthEmpathy - candidate.warmthEmpathy) <= 30
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
    Math.abs(requester.boundaryRespect - candidate.boundaryRespect) <= 25
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

  if (
    Math.abs(requester.replyPacePreference - candidate.replyPacePreference) >=
    35
  ) {
    cautions.push(
      "سرعت پاسخ‌دهی ممکن است کمی متفاوت باشد؛ شروع آرام بهتر است."
    );
  }

  if (
    Math.abs(requester.depthPreference - candidate.depthPreference) >= 40
  ) {
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

export const isCurrentAssessmentProfile = (profile: AssessmentProfileRow): boolean =>
  profile.version === ASSESSMENT_VERSION;

export const scoreMatchPair = (params: {
  requesterProfile: AssessmentProfileRow;
  candidateProfile: AssessmentProfileRow;
  vectorScore?: number;
}): MatchCandidate | null => {
  if (
    !isCurrentAssessmentProfile(params.requesterProfile) ||
    !isCurrentAssessmentProfile(params.candidateProfile)
  ) {
    return null;
  }

  const requesterScores = scoresFromJson(
    params.requesterProfile.dimension_scores_json,
    params.requesterProfile.user_id
  );
  const candidateScores = scoresFromJson(
    params.candidateProfile.dimension_scores_json,
    params.candidateProfile.user_id
  );

  const hasVector =
    params.vectorScore !== undefined && !Number.isNaN(params.vectorScore);
  const vectorSemantic = hasVector
    ? normalizeVectorScore(params.vectorScore)
    : undefined;

  const preferenceSimilarity = groupSimilarity(
    requesterScores,
    candidateScores,
    MATCHING_SIGNAL_GROUPS.similarityPreference
  );

  const safetyReadiness = directionalAverage(
    candidateScores,
    MATCHING_SIGNAL_GROUPS.directionalSafety
  );

  const emotionalSupportFit = computeEmotionalSupportFit(
    requesterScores,
    candidateScores
  );

  const repairFit = groupSimilarity(
    requesterScores,
    candidateScores,
    MATCHING_SIGNAL_GROUPS.repairCompatibility
  );

  const reliabilityFit = candidateScores.reliabilityConsistency;

  const penalties = computePenalties(
    requesterScores,
    candidateScores,
    params.candidateProfile
  );

  const deterministicScore = clamp(
    0.35 * preferenceSimilarity +
      0.25 * safetyReadiness +
      0.25 * emotionalSupportFit +
      0.1 * repairFit +
      0.05 * reliabilityFit -
      penalties
  );

  const finalScore = hasVector
    ? clamp(
        0.2 * (vectorSemantic ?? 0) +
          0.25 * preferenceSimilarity +
          0.2 * safetyReadiness +
          0.2 * emotionalSupportFit +
          0.1 * repairFit +
          0.05 * reliabilityFit -
          penalties
      )
    : deterministicScore;

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

export const compareCandidateRanking = (
  requesterVersion: string,
  candidateAVersion: string,
  candidateBVersion: string
): number => {
  const sameA = candidateAVersion === requesterVersion ? 1 : 0;
  const sameB = candidateBVersion === requesterVersion ? 1 : 0;
  return sameB - sameA;
};
