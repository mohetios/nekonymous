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
  confidence: "low" | "normal";
};

export type AssessmentResultSummary = {
  title: string;
  shortDescription: string;
  highlights: string[];
  cautions: string[];
  matchNotes: string[];
  quality?: AssessmentProfileQuality;
};

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
};

export const scoredValue = (question: AssessmentQuestion, answer: number): number =>
  question.reverse ? 6 - answer : answer;

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
      return NaN;
    }
    sum += scoredValue(item, raw);
  }

  return sum / items.length;
};

const toPercent = (average: number): number =>
  clampScore(((average - 1) / 4) * 100);

export const hasCompleteAnswers = (answers: Record<string, number>): boolean =>
  ASSESSMENT_QUESTIONS.every(
    (q) => answers[q.id] !== undefined && answers[q.id] >= 1 && answers[q.id] <= 5
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
    scores[dimension] = toPercent(avg);
  }

  return scores;
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
      confidence: "low",
    };
  }

  const mean =
    values.reduce((sum, value) => sum + value, 0) / completedQuestions;
  const responseVariance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    completedQuestions;
  const straightLine = values.every((value) => value === values[0]);
  const confidence =
    straightLine || responseVariance < 0.15 ? "low" : "normal";

  return {
    completedQuestions,
    expectedQuestions,
    responseVariance,
    straightLine,
    confidence,
  };
};

const level = (score: number): "low" | "mid" | "high" => {
  if (score >= 67) {
    return "high";
  }
  if (score <= 33) {
    return "low";
  }
  return "mid";
};

const pickTitle = (scores: AssessmentScores): string => {
  const depth = (scores.depthPreference + scores.curiosityDepth) / 2;
  const warmth = scores.warmthEmpathy;
  const energy = scores.socialEnergy;
  const boundary = scores.boundaryRespect;

  if (depth >= 70 && warmth >= 60) {
    return "گفت‌وگوی آرام و عمیق";
  }
  if (warmth >= 65 && scores.emotionalRegulation >= 55) {
    return "گفت‌وگوی گرم و انسانی";
  }
  if (energy >= 65 && depth <= 45 && scores.replyPacePreference <= 45) {
    return "گفت‌وگوی سبک، سریع و کم‌فشار";
  }
  if (boundary >= 65 && scores.anonymityComfort <= 55) {
    return "گفت‌وگوی محتاط و مرزدار";
  }
  if (scores.curiosityDepth >= 65) {
    return "گفت‌وگوی کنجکاو و فکری";
  }
  return "گفت‌وگوی متعادل و سازگار";
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
    if (score >= 67) {
      return `${item.label} — نقطه قوت نسبی`;
    }
    if (score >= 45) {
      return `${item.label} — در محدوده متعادل`;
    }
    return `${item.label} — ترجیح ملایم‌تر`;
  });
};

const buildCautions = (scores: AssessmentScores): string[] => {
  const notes: string[] = [];

  if (scores.emotionalSensitivity >= 67) {
    notes.push(
      "ممکن است در گفت‌وگوهای مبهم یا دیرپاسخ، ذهنت بیشتر درگیر شود — مکث کوتاه می‌تواند کمک کند."
    );
  }
  if (scores.replyPacePreference <= 33) {
    notes.push(
      "فاصله زیاد بین پیام‌ها برایت سخت‌تر است — بهتر است انتظاراتت را زودتر روشن کنی."
    );
  }
  if (scores.boundaryRespect <= 40) {
    notes.push(
      "مراقب باش فشار برای ادامه گفت‌وگو، حریم طرف مقابل را فراموش نکند."
    );
  }
  if (scores.supportPreference >= 67) {
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

  if (scores.boundaryRespect >= 55 && scores.warmthEmpathy >= 50) {
    notes.push("مناسب برای گفت‌وگوی ناشناس کم‌فشار و محترمانه");
  }

  if (scores.replyPacePreference >= 60) {
    notes.push("ترجیح می‌دهی ریتم پاسخ‌دهی آرام و بدون فشار باشد");
  }

  if (scores.emotionalSensitivity >= 65) {
    notes.push("به لحن گرم و شنیده‌شدن اهمیت می‌دهی");
  }

  if (scores.depthPreference >= 65) {
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
  if (depth >= 65) {
    return "deep-talk";
  }
  if (scores.socialEnergy >= 65 && scores.warmthEmpathy >= 55) {
    return "light-chat";
  }
  if (scores.supportPreference >= 65) {
    return "support";
  }
  return "deep-talk";
};

export const computeSafetyTier = (
  scores: AssessmentScores
): "normal" | "limited" => {
  if (scores.boundaryRespect < 35 || scores.honestyTransparency < 35) {
    return "limited";
  }
  return "normal";
};

export const computeProfileBucket = (scores: AssessmentScores): number => {
  const values = Object.values(scores);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(9, Math.floor(avg / 10));
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
