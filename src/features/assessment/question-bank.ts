export const ASSESSMENT_VERSION = "v1";

export type AssessmentDimension =
  | "boundaryRespect"
  | "honestyTransparency"
  | "emotionalSensitivity"
  | "emotionalRegulation"
  | "socialEnergy"
  | "warmthEmpathy"
  | "reliabilityConsistency"
  | "curiosityDepth"
  | "depthPreference"
  | "replyPacePreference"
  | "directnessPreference"
  | "conflictRepair"
  | "supportPreference"
  | "anonymityComfort";

export type AssessmentQuestion = {
  id: string;
  dimension: AssessmentDimension;
  reverse?: boolean;
  text: string;
};

export const ASSESSMENT_DIMENSION_LABELS: Record<AssessmentDimension, string> = {
  boundaryRespect: "مرزبانی و احترام",
  honestyTransparency: "صداقت و شفافیت",
  emotionalSensitivity: "حساسیت احساسی",
  emotionalRegulation: "تنظیم هیجان",
  socialEnergy: "انرژی اجتماعی",
  warmthEmpathy: "گرمی و همدلی",
  reliabilityConsistency: "ثبات و پیگیری",
  curiosityDepth: "کنجکاوی و عمق",
  depthPreference: "ترجیح گفت‌وگوی عمیق",
  replyPacePreference: "ریتم پاسخ‌دهی",
  directnessPreference: "شفافیت و مستقیم‌بودن",
  conflictRepair: "ترمیم سوءتفاهم",
  supportPreference: "نیاز به شنیده‌شدن",
  anonymityComfort: "راحتی با ناشناس‌بودن",
};

export const ASSESSMENT_DIMENSIONS: AssessmentDimension[] = [
  "boundaryRespect",
  "honestyTransparency",
  "emotionalSensitivity",
  "emotionalRegulation",
  "socialEnergy",
  "warmthEmpathy",
  "reliabilityConsistency",
  "curiosityDepth",
  "depthPreference",
  "replyPacePreference",
  "directnessPreference",
  "conflictRepair",
  "supportPreference",
  "anonymityComfort",
];

export const EXPECTED_QUESTIONS_PER_DIMENSION = 4;

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "br1",
    dimension: "boundaryRespect",
    text: "قبل از پرسیدن سؤال شخصی، معمولاً به حس و آمادگی طرف مقابل توجه می‌کنم.",
  },
  {
    id: "br2",
    dimension: "boundaryRespect",
    text: "اگر کسی بگوید فعلاً نمی‌خواهد درباره موضوعی حرف بزند، همان‌جا مکث می‌کنم.",
  },
  {
    id: "br3",
    dimension: "boundaryRespect",
    text: "در گفت‌وگوی ناشناس هم برایم مهم است طرف مقابل احساس امنیت کند.",
  },
  {
    id: "br4",
    dimension: "boundaryRespect",
    reverse: true,
    text: "اگر کنجکاو شوم، گاهی حتی وقتی طرف مقابل راحت نیست، سؤال را ادامه می‌دهم.",
  },

  {
    id: "ht1",
    dimension: "honestyTransparency",
    text: "وقتی قصد ادامه‌دادن یک گفت‌وگو را ندارم، ترجیح می‌دهم محترمانه روشنش کنم.",
  },
  {
    id: "ht2",
    dimension: "honestyTransparency",
    text: "اگر باعث سوءبرداشت شوم، سعی می‌کنم توضیح بدهم منظورم چه بوده است.",
  },
  {
    id: "ht3",
    dimension: "honestyTransparency",
    text: "در معرفی خودم یا حال‌وهوایم اغراق نمی‌کنم تا جذاب‌تر به نظر برسم.",
  },
  {
    id: "ht4",
    dimension: "honestyTransparency",
    reverse: true,
    text: "گاهی برای بهتر پیش‌رفتن گفت‌وگو، چیزهایی را طوری می‌گویم که دقیقاً واقعیت ندارد.",
  },

  {
    id: "es1",
    dimension: "emotionalSensitivity",
    text: "لحن سرد یا کوتاه می‌تواند سریع ذهنم را درگیر کند.",
  },
  {
    id: "es2",
    dimension: "emotionalSensitivity",
    text: "اگر جوابم دیر برسد، ممکن است چند بار به معنی‌اش فکر کنم.",
  },
  {
    id: "es3",
    dimension: "emotionalSensitivity",
    text: "در گفت‌وگوهای احساسی، زود تحت تأثیر حال طرف مقابل قرار می‌گیرم.",
  },
  {
    id: "es4",
    dimension: "emotionalSensitivity",
    reverse: true,
    text: "پیام‌های مبهم یا سرد معمولاً تأثیر زیادی روی حالم نمی‌گذارند.",
  },

  {
    id: "er1",
    dimension: "emotionalRegulation",
    text: "وقتی ناراحت می‌شوم، قبل از جواب‌دادن کمی مکث می‌کنم.",
  },
  {
    id: "er2",
    dimension: "emotionalRegulation",
    text: "اگر گفت‌وگو تنش پیدا کند، سعی می‌کنم لحنم را آرام‌تر کنم.",
  },
  {
    id: "er3",
    dimension: "emotionalRegulation",
    text: "وقتی احساساتم شدید است، ترجیح می‌دهم اول مرتبشان کنم و بعد حرف بزنم.",
  },
  {
    id: "er4",
    dimension: "emotionalRegulation",
    reverse: true,
    text: "وقتی ناراحت می‌شوم، معمولاً همان لحظه جواب تند می‌دهم.",
  },

  {
    id: "se1",
    dimension: "socialEnergy",
    text: "شروع گفت‌وگو با آدم‌های جدید معمولاً برایم انرژی‌بخش است.",
  },
  {
    id: "se2",
    dimension: "socialEnergy",
    text: "اگر گفت‌وگو خوب پیش برود، دوست دارم بیشتر ادامه پیدا کند.",
  },
  {
    id: "se3",
    dimension: "socialEnergy",
    text: "از شوخی سبک و بازی‌گوشی در گفت‌وگو لذت می‌برم.",
  },
  {
    id: "se4",
    dimension: "socialEnergy",
    reverse: true,
    text: "معمولاً بعد از چند پیام کوتاه، دلم می‌خواهد گفت‌وگو را جمع کنم.",
  },

  {
    id: "we1",
    dimension: "warmthEmpathy",
    text: "معمولاً حرف طرف مقابل را با حسن‌نیت تفسیر می‌کنم.",
  },
  {
    id: "we2",
    dimension: "warmthEmpathy",
    text: "وقتی کسی آسیب‌پذیر حرف می‌زند، با دقت و ملایمت بیشتری جواب می‌دهم.",
  },
  {
    id: "we3",
    dimension: "warmthEmpathy",
    text: "حتی وقتی مخالفم، سعی می‌کنم طرف مقابل احساس تحقیرشدن نکند.",
  },
  {
    id: "we4",
    dimension: "warmthEmpathy",
    reverse: true,
    text: "اگر کسی زیادی احساسی حرف بزند، سریع حوصله‌ام کم می‌شود.",
  },

  {
    id: "rc1",
    dimension: "reliabilityConsistency",
    text: "اگر بگویم بعداً جواب می‌دهم، معمولاً واقعاً برمی‌گردم و جواب می‌دهم.",
  },
  {
    id: "rc2",
    dimension: "reliabilityConsistency",
    text: "دوست دارم ارتباط‌ها حد و ریتم قابل‌پیش‌بینی داشته باشند.",
  },
  {
    id: "rc3",
    dimension: "reliabilityConsistency",
    text: "وقتی نمی‌توانم ادامه بدهم، ترجیح می‌دهم کوتاه توضیح بدهم تا بی‌خبر ناپدید شوم.",
  },
  {
    id: "rc4",
    dimension: "reliabilityConsistency",
    reverse: true,
    text: "زیاد پیش می‌آید گفت‌وگویی را بدون توضیح رها کنم.",
  },

  {
    id: "cd1",
    dimension: "curiosityDepth",
    text: "دوست دارم از گفت‌وگو چیزی تازه درباره آدم‌ها یا زندگی بفهمم.",
  },
  {
    id: "cd2",
    dimension: "curiosityDepth",
    text: "زاویه‌دید متفاوت طرف مقابل برایم جذاب است، حتی اگر کاملاً موافق نباشم.",
  },
  {
    id: "cd3",
    dimension: "curiosityDepth",
    text: "سؤال خوب برایم گاهی از جواب آماده جذاب‌تر است.",
  },
  {
    id: "cd4",
    dimension: "curiosityDepth",
    reverse: true,
    text: "معمولاً ترجیح می‌دهم گفت‌وگو خیلی وارد فکر و معنا نشود.",
  },

  {
    id: "dp1",
    dimension: "depthPreference",
    text: "گفت‌وگوی آرام و عمیق را به چت سریع و سطحی ترجیح می‌دهم.",
  },
  {
    id: "dp2",
    dimension: "depthPreference",
    text: "اگر اعتماد شکل بگیرد، دوست دارم درباره تجربه‌های واقعی و شخصی‌تر حرف بزنم.",
  },
  {
    id: "dp3",
    dimension: "depthPreference",
    text: "از گفت‌وگوهایی که فقط چند جمله کوتاه و گذرا هستند کمتر لذت می‌برم.",
  },
  {
    id: "dp4",
    dimension: "depthPreference",
    reverse: true,
    text: "بیشتر وقت‌ها گفت‌وگوی سبک و روزمره برایم کافی است.",
  },

  {
    id: "rp1",
    dimension: "replyPacePreference",
    text: "با فاصله افتادن بین جواب‌ها مشکلی ندارم.",
  },
  {
    id: "rp2",
    dimension: "replyPacePreference",
    text: "ترجیح می‌دهم طرف مقابل به‌جای جواب فوری، با دقت جواب بدهد.",
  },
  {
    id: "rp3",
    dimension: "replyPacePreference",
    text: "اگر کسی خیلی سریع و پشت‌سرهم پیام بدهد، ممکن است فشار حس کنم.",
  },
  {
    id: "rp4",
    dimension: "replyPacePreference",
    reverse: true,
    text: "معمولاً دوست دارم گفت‌وگو ریتم سریع و جواب‌های پشت‌سرهم داشته باشد.",
  },

  {
    id: "di1",
    dimension: "directnessPreference",
    text: "دوست دارم طرف مقابل واضح بگوید چه می‌خواهد یا چه حسی دارد.",
  },
  {
    id: "di2",
    dimension: "directnessPreference",
    text: "حرف مستقیم را اگر محترمانه باشد، بیشتر از اشاره‌های مبهم می‌پسندم.",
  },
  {
    id: "di3",
    dimension: "directnessPreference",
    text: "وقتی چیزی ناراحتم می‌کند، بهتر است بتوانیم روشن درباره‌اش حرف بزنیم.",
  },
  {
    id: "di4",
    dimension: "directnessPreference",
    reverse: true,
    text: "ترجیح می‌دهم حرف‌های حساس غیرمستقیم و با اشاره گفته شوند.",
  },

  {
    id: "cr1",
    dimension: "conflictRepair",
    text: "اگر سوءتفاهم شود، دوست دارم راهی برای روشن‌کردن آن پیدا کنیم.",
  },
  {
    id: "cr2",
    dimension: "conflictRepair",
    text: "بعد از ناراحتی، اگر فضا امن باشد، می‌توانم درباره اتفاق حرف بزنم.",
  },
  {
    id: "cr3",
    dimension: "conflictRepair",
    text: "وقتی اختلاف پیش می‌آید، فهمیدن طرف مقابل برایم مهم‌تر از بردن بحث است.",
  },
  {
    id: "cr4",
    dimension: "conflictRepair",
    reverse: true,
    text: "وقتی دلخور می‌شوم، معمولاً ترجیح می‌دهم دیگر ادامه ندهم.",
  },

  {
    id: "sp1",
    dimension: "supportPreference",
    text: "وقتی ناراحتم، بیشتر از راه‌حل فوری به شنیده‌شدن نیاز دارم.",
  },
  {
    id: "sp2",
    dimension: "supportPreference",
    text: "دوست دارم طرف مقابل قبل از نصیحت، کمی حالم را بفهمد.",
  },
  {
    id: "sp3",
    dimension: "supportPreference",
    text: "اگر کسی فقط منطقی و خشک جواب بدهد، ممکن است احساس فاصله کنم.",
  },
  {
    id: "sp4",
    dimension: "supportPreference",
    reverse: true,
    text: "وقتی مشکلی را تعریف می‌کنم، بیشتر دنبال راه‌حل سریع هستم تا همدلی.",
  },

  {
    id: "ac1",
    dimension: "anonymityComfort",
    text: "در گفت‌وگوی ناشناس راحت‌تر می‌توانم صادق باشم.",
  },
  {
    id: "ac2",
    dimension: "anonymityComfort",
    text: "ناشناس‌بودن کمک می‌کند بدون فشار تصویر بیرونی‌ام حرف بزنم.",
  },
  {
    id: "ac3",
    dimension: "anonymityComfort",
    text: "در گفت‌وگوی ناشناس هم می‌توانم آرام‌آرام اعتماد بسازم.",
  },
  {
    id: "ac4",
    dimension: "anonymityComfort",
    reverse: true,
    text: "در فضای ناشناس معمولاً بیشتر محتاطم و سخت‌تر خودم را باز می‌کنم.",
  },
];

export const ASSESSMENT_QUESTION_COUNT = ASSESSMENT_QUESTIONS.length;

export const getQuestionAtIndex = (index: number): AssessmentQuestion | undefined =>
  ASSESSMENT_QUESTIONS[index];

export const isCurrentAssessmentVersion = (version: string): boolean =>
  version === ASSESSMENT_VERSION;

export function validateAssessmentQuestionBank(): void {
  const ids = new Set<string>();

  for (const question of ASSESSMENT_QUESTIONS) {
    if (ids.has(question.id)) {
      throw new Error(`Duplicate assessment question id: ${question.id}`);
    }

    ids.add(question.id);

    if (!question.text.trim()) {
      throw new Error(`Empty assessment question text: ${question.id}`);
    }

    if (!ASSESSMENT_DIMENSIONS.includes(question.dimension)) {
      throw new Error(`Unknown dimension for question: ${question.id}`);
    }
  }

  for (const dimension of ASSESSMENT_DIMENSIONS) {
    const count = ASSESSMENT_QUESTIONS.filter((q) => q.dimension === dimension).length;

    if (count !== EXPECTED_QUESTIONS_PER_DIMENSION) {
      throw new Error(
        `Assessment dimension ${dimension} must have ${EXPECTED_QUESTIONS_PER_DIMENSION} questions, got ${count}`
      );
    }
  }
}
