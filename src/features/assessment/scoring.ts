import {
  ASSESSMENT_DIMENSIONS,
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_QUESTIONS,
  type AssessmentDimension,
  type AssessmentQuestion,
} from "./question-bank";

export type { AssessmentDimension } from "./question-bank";

export type AssessmentScores = Record<AssessmentDimension, number>;

export type AssessmentProfileQuality = {
  completedQuestions: number;
  expectedQuestions: number;
  responseVariance: number;
  straightLine: boolean;
  confidence: number;
  matchEligible: boolean;
};

export type AssessmentResultSummary = {
  title: string;
  shortDescription: string;
  highlights: string[];
  cautions: string[];
  matchNotes: string[];
  quality?: AssessmentProfileQuality;
};

export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

export const normalizeLikertAnswer = (
  raw: number,
  reverse: boolean
): number => {
  if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
    throw new Error("Invalid Likert answer");
  }

  return reverse ? 6 - raw : raw;
};

export const scoreDimension = (values: number[]): number => {
  if (values.length === 0) {
    throw new Error("Missing dimension answers");
  }

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clamp01((avg - 1) / 4);
};

export const scoredValue = (question: AssessmentQuestion, answer: number): number =>
  normalizeLikertAnswer(answer, question.reverse === true);

const dimensionAverage = (
  questions: AssessmentQuestion[],
  answers: Record<string, number>,
  dimension: AssessmentDimension
): number => {
  const items = questions.filter((q) => q.dimension === dimension);
  if (items.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const item of items) {
    const raw = answers[item.id];
    if (raw === undefined || raw < 1 || raw > 5) {
      throw new Error("Invalid Likert answer");
    }
    sum += scoredValue(item, raw);
  }

  return sum / items.length;
};

export const hasCompleteAnswers = (answers: Record<string, number>): boolean =>
  ASSESSMENT_QUESTIONS.every(
    (q) => Number.isInteger(answers[q.id]) && answers[q.id] >= 1 && answers[q.id] <= 5
  );

export const computeAssessmentScores = (
  answers: Record<string, number>
): AssessmentScores => {
  const scores = {} as AssessmentScores;

  for (const dimension of ASSESSMENT_DIMENSIONS) {
    const avg = dimensionAverage(ASSESSMENT_QUESTIONS, answers, dimension);
    if (!Number.isFinite(avg)) {
      throw new Error(`Missing answers for dimension: ${dimension}`);
    }
    scores[dimension] = scoreDimension([avg]);
  }

  return scores;
};

export const mostRepeatedAnswerRatio = (rawAnswers: number[]): number => {
  if (rawAnswers.length === 0) {
    return 1;
  }

  const counts = new Map<number, number>();
  for (const answer of rawAnswers) {
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }

  return Math.max(...counts.values()) / rawAnswers.length;
};

export const scoreConfidence = (params: {
  pairConsistency: number;
  rawAnswers: number[];
}): number => {
  const repeatedRatio = mostRepeatedAnswerRatio(params.rawAnswers);
  const straightlinePenalty = clamp01((repeatedRatio - 0.55) / 0.35);

  return clamp01(
    0.25 + 0.55 * params.pairConsistency + 0.2 * (1 - straightlinePenalty)
  );
};

export const computeProfileQuality = (
  answers: Record<string, number>
): AssessmentProfileQuality => {
  const values = ASSESSMENT_QUESTIONS.map((q) => answers[q.id]).filter(
    (value): value is number => value !== undefined && value >= 1 && value <= 5
  );
  const completedQuestions = values.length;
  const expectedQuestions = ASSESSMENT_QUESTION_COUNT;

  if (completedQuestions === 0) {
    return {
      completedQuestions: 0,
      expectedQuestions,
      responseVariance: 0,
      straightLine: false,
      confidence: 0,
      matchEligible: false,
    };
  }

  const mean =
    values.reduce((sum, value) => sum + value, 0) / completedQuestions;
  const responseVariance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    completedQuestions;
  const straightLine = values.every((value) => value === values[0]);
  const confidence = scoreConfidence({
    pairConsistency: 0.75,
    rawAnswers: values,
  });

  return {
    completedQuestions,
    expectedQuestions,
    responseVariance,
    straightLine,
    confidence,
    matchEligible: confidence >= 0.5,
  };
};

const level = (score: number): "low" | "mid" | "high" => {
  if (score >= 0.67) {
    return "high";
  }
  if (score <= 0.33) {
    return "low";
  }
  return "mid";
};

const pickTitle = (scores: AssessmentScores): string => {
  const depth = (scores.depthPreference + scores.curiosityDepth) / 2;
  const warmth = scores.warmthEmpathy;
  const energy = scores.socialEnergy;
  const boundary = scores.boundaryRespect;

  if (depth >= 0.7 && warmth >= 0.6) {
    return "گفت‌وگوی آرام و عمیق";
  }
  if (warmth >= 0.65 && scores.emotionalRegulation >= 0.55) {
    return "گفت‌وگوی گرم و انسانی";
  }
  if (energy >= 0.65 && depth <= 0.45 && scores.replyPacePreference <= 0.45) {
    return "گفت‌وگوی سبک، سریع و کم‌فشار";
  }
  if (boundary >= 0.65 && scores.anonymityComfort <= 0.55) {
    return "گفت‌وگوی محتاط و مرزدار";
  }
  if (scores.curiosityDepth >= 0.65) {
    return "گفت‌وگوی کنجکاو و فکری";
  }
  return "گفت‌وگوی متعادل";
};

const pickDescription = (scores: AssessmentScores): string => {
  const parts: string[] = [];

  if (level(scores.curiosityDepth) === "high") {
    parts.push("به گفت‌وگوهای عمیق و کشف‌محور علاقه داری");
  } else if (level(scores.curiosityDepth) === "low") {
    parts.push("گفت‌وگوهای ساده و روزمره برایت راحت‌تر است");
  }

  if (level(scores.socialEnergy) === "high") {
    parts.push("انرژی اجتماعی خوبی در شروع و ادامه گفت‌وگو داری");
  } else if (level(scores.socialEnergy) === "low") {
    parts.push("ترجیح می‌دهی ارتباط‌ها کم‌تعداد و آرام باشند");
  }

  if (level(scores.warmthEmpathy) === "high") {
    parts.push("معمولاً با حسن‌نیت و گرمی وارد گفت‌وگو می‌شوی");
  }

  if (parts.length === 0) {
    return "سبک گفت‌وگوی تو ترکیبی از صبر، احترام و انعطاف است.";
  }

  return `${parts.join(" و ")}.`;
};

const buildHighlights = (scores: AssessmentScores): string[] => {
  const ranked = [
    { key: "boundaryRespect" as const, label: "مرزبانی و احترام" },
    { key: "warmthEmpathy" as const, label: "گرمی و همدلی" },
    { key: "curiosityDepth" as const, label: "کنجکاوی و عمق" },
    { key: "reliabilityConsistency" as const, label: "ثبات و پیگیری" },
    { key: "anonymityComfort" as const, label: "راحتی در گفت‌وگوی ناشناس" },
    { key: "directnessPreference" as const, label: "وضوح و صراحت" },
  ];

  const sorted = [...ranked].sort(
    (a, b) => scores[b.key] - scores[a.key]
  );

  return sorted.slice(0, 3).map((item) => {
    const score = scores[item.key];
    if (score >= 0.67) {
      return `${item.label} — نقطه قوت نسبی`;
    }
    if (score >= 0.45) {
      return `${item.label} — در محدوده متعادل`;
    }
    return `${item.label} — ترجیح ملایم‌تر`;
  });
};

const buildCautions = (scores: AssessmentScores): string[] => {
  const notes: string[] = [];

  if (scores.emotionalSensitivity >= 0.67) {
    notes.push(
      "ممکن است در گفت‌وگوهای مبهم یا دیرپاسخ، ذهنت بیشتر درگیر شود — مکث کوتاه می‌تواند کمک کند."
    );
  }
  if (scores.replyPacePreference <= 0.33) {
    notes.push(
      "فاصله زیاد بین پیام‌ها برایت سخت‌تر است — بهتر است انتظاراتت را زودتر روشن کنی."
    );
  }
  if (scores.boundaryRespect <= 0.4) {
    notes.push(
      "مراقب باش فشار برای ادامه گفت‌وگو، حریم طرف مقابل را فراموش نکند."
    );
  }
  if (scores.supportPreference >= 0.67) {
    notes.push(
      "دوست داری بیشتر شنیده شوی — در گفت‌وگوی ناشناس، درخواست شفاف کمک می‌کند."
    );
  }
  if (notes.length === 0) {
    notes.push(
      "در گفت‌وگوهای ناشناس، روشن گفتن انتظاراتت (سرعت، عمق، موضوع) همیشه مفید است."
    );
  }

  return notes.slice(0, 3);
};

const buildMatchNotes = (scores: AssessmentScores): string[] => {
  const notes: string[] = [];

  if (scores.boundaryRespect >= 0.55 && scores.warmthEmpathy >= 0.5) {
    notes.push("مناسب برای گفت‌وگوی ناشناس کم‌فشار و محترمانه");
  }

  if (scores.replyPacePreference >= 0.6) {
    notes.push("ترجیح می‌دهی ریتم پاسخ‌دهی آرام و بدون فشار باشد");
  }

  if (scores.emotionalSensitivity >= 0.65) {
    notes.push("به لحن گرم و شنیده‌شدن اهمیت می‌دهی");
  }

  if (scores.depthPreference >= 0.65) {
    notes.push("به گفت‌وگوی عمیق‌تر علاقه داری");
  }

  if (notes.length === 0) {
    notes.push("سبک گفت‌وگوی متعادل — با روشن‌کردن انتظارات شروع خوبی دارد");
  }

  return notes.slice(0, 3);
};

export const buildResultSummary = (
  scores: AssessmentScores,
  answers?: Record<string, number>
): AssessmentResultSummary => ({
  title: pickTitle(scores),
  shortDescription: pickDescription(scores),
  highlights: buildHighlights(scores),
  cautions: buildCautions(scores),
  matchNotes: buildMatchNotes(scores),
  quality: answers ? computeProfileQuality(answers) : undefined,
});

export const computePrimaryIntent = (scores: AssessmentScores): string => {
  const depth = (scores.depthPreference + scores.curiosityDepth) / 2;
  if (depth >= 0.65) {
    return "deep-talk";
  }
  if (scores.socialEnergy >= 0.65 && scores.warmthEmpathy >= 0.55) {
    return "light-chat";
  }
  if (scores.supportPreference >= 0.65) {
    return "support";
  }
  return "deep-talk";
};

export const computeSafetyTier = (
  scores: AssessmentScores
): "normal" | "limited" => {
  if (scores.boundaryRespect < 0.35 || scores.honestyTransparency < 0.35) {
    return "limited";
  }
  return "normal";
};

export const computeProfileBucket = (scores: AssessmentScores): number => {
  const values = Object.values(scores);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(9, Math.floor(avg * 10));
};

/** Core dimensions shown in result overview. */
export const CORE_DIMENSION_KEYS: AssessmentDimension[] = [
  "boundaryRespect",
  "emotionalSensitivity",
  "emotionalRegulation",
  "socialEnergy",
  "warmthEmpathy",
  "reliabilityConsistency",
  "curiosityDepth",
];
