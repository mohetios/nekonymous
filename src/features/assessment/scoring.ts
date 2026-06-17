import {
  ASSESSMENT_QUESTIONS,
  type AssessmentDimension,
  type AssessmentQuestion,
} from "./question-bank";

export type AssessmentScores = {
  honestyBoundaryRespect: number;
  emotionalReactivity: number;
  socialEnergy: number;
  warmthCooperation: number;
  reliabilityConsistency: number;
  curiosityDepth: number;
  depthPreference: number;
  replyPace: number;
  directness: number;
  conflictReflectiveness: number;
  supportNeed: number;
  anonymityComfort: number;
};

export type AssessmentResultSummary = {
  title: string;
  shortDescription: string;
  highlights: string[];
  cautions: string[];
};

const DIMENSION_KEYS: AssessmentDimension[] = [
  "honestyBoundaryRespect",
  "emotionalReactivity",
  "socialEnergy",
  "warmthCooperation",
  "reliabilityConsistency",
  "curiosityDepth",
  "depthPreference",
  "replyPace",
  "directness",
  "conflictReflectiveness",
  "supportNeed",
  "anonymityComfort",
];

const scoredValue = (question: AssessmentQuestion, answer: number): number =>
  question.reverse ? 6 - answer : answer;

const dimensionAverage = (
  questions: AssessmentQuestion[],
  answers: Record<string, number>,
  dimension: AssessmentDimension
): number => {
  const items = questions.filter((q) => q.dimension === dimension);
  if (items.length === 0) {
    return 50;
  }

  let sum = 0;
  for (const item of items) {
    const raw = answers[item.id];
    if (raw === undefined || raw < 1 || raw > 5) {
      continue;
    }
    sum += scoredValue(item, raw);
  }

  return sum / items.length;
};

const toPercent = (average: number): number =>
  Math.round(((average - 1) / 4) * 100);

export const computeAssessmentScores = (
  answers: Record<string, number>
): AssessmentScores => {
  const scores = {} as AssessmentScores;

  for (const dimension of DIMENSION_KEYS) {
    const avg = dimensionAverage(ASSESSMENT_QUESTIONS, answers, dimension);
    scores[dimension] = toPercent(avg);
  }

  return scores;
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
  const warmth = scores.warmthCooperation;
  const energy = scores.socialEnergy;

  if (depth >= 70 && warmth >= 60) {
    return "گفت‌وگوی عمیق و گرم";
  }
  if (depth >= 70) {
    return "کنجکاو و متفکر";
  }
  if (energy >= 70 && warmth >= 60) {
    return "اجتماعی و دعوت‌کننده";
  }
  if (scores.anonymityComfort >= 70 && scores.honestyBoundaryRespect >= 60) {
    return "صادق در فضای ناشناس";
  }
  if (scores.reliabilityConsistency >= 70) {
    return "پیگیر و قابل اتکا";
  }
  if (scores.replyPace >= 65 && depth >= 55) {
    return "آرام و صبور";
  }
  return "متعادل و سازگار";
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

  if (level(scores.warmthCooperation) === "high") {
    parts.push("معمولاً با حسن‌نیت و همکاری وارد گفت‌وگو می‌شوی");
  }

  if (parts.length === 0) {
    return "سبک گفت‌وگوی تو ترکیبی از صبر، احترام و انعطاف است.";
  }

  return `${parts.join(" و ")}.`;
};

const buildHighlights = (scores: AssessmentScores): string[] => {
  const ranked = [
    { key: "honestyBoundaryRespect", label: "احترام به مرزها و صداقت" },
    { key: "warmthCooperation", label: "گرمی و همکاری" },
    { key: "curiosityDepth", label: "کنجکاوی و عمق" },
    { key: "reliabilityConsistency", label: "پیگیری و ثبات" },
    { key: "anonymityComfort", label: "راحتی در گفت‌وگوی ناشناس" },
    { key: "directness", label: "وضوح و صراحت" },
  ] as const;

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

  if (scores.emotionalReactivity >= 67) {
    notes.push(
      "ممکن است در گفت‌وگوهای مبهم یا دیرپاسخ، ذهنت بیشتر درگیر شود — مکث کوتاه می‌تواند کمک کند."
    );
  }
  if (scores.replyPace <= 33) {
    notes.push(
      "فاصله زیاد بین پیام‌ها برایت سخت‌تر است — بهتر است انتظاراتت را زودتر روشن کنی."
    );
  }
  if (scores.honestyBoundaryRespect <= 40) {
    notes.push(
      "مراقب باش فشار برای ادامه گفت‌وگو، حریم طرف مقابل را فراموش نکند."
    );
  }
  if (scores.supportNeed >= 67) {
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

export const buildResultSummary = (scores: AssessmentScores): AssessmentResultSummary => ({
  title: pickTitle(scores),
  shortDescription: pickDescription(scores),
  highlights: buildHighlights(scores),
  cautions: buildCautions(scores),
});

export const computePrimaryIntent = (scores: AssessmentScores): string => {
  const depth = (scores.depthPreference + scores.curiosityDepth) / 2;
  if (depth >= 65) {
    return "deep-talk";
  }
  if (scores.socialEnergy >= 65 && scores.warmthCooperation >= 55) {
    return "light-chat";
  }
  if (scores.supportNeed >= 65) {
    return "support";
  }
  return "deep-talk";
};

export const computeSafetyTier = (
  scores: AssessmentScores
): "normal" | "limited" => {
  if (scores.honestyBoundaryRespect < 35) {
    return "limited";
  }
  return "normal";
};

export const computeProfileBucket = (scores: AssessmentScores): number => {
  const avg =
    DIMENSION_KEYS.reduce((sum, key) => sum + scores[key], 0) /
    DIMENSION_KEYS.length;
  return Math.min(9, Math.floor(avg / 10));
};

export const CORE_DIMENSION_LABELS: Record<
  | "honestyBoundaryRespect"
  | "emotionalReactivity"
  | "socialEnergy"
  | "warmthCooperation"
  | "reliabilityConsistency"
  | "curiosityDepth",
  string
> = {
  honestyBoundaryRespect: "مرزبانی و احترام",
  emotionalReactivity: "واکنش‌پذیری احساسی",
  socialEnergy: "انرژی اجتماعی",
  warmthCooperation: "گرمی و همکاری",
  reliabilityConsistency: "ثبات و پیگیری",
  curiosityDepth: "کنجکاوی و عمق",
};
