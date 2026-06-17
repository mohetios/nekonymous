export const ASSESSMENT_VERSION = "v1";

export type AssessmentDimension =
  | "honestyBoundaryRespect"
  | "emotionalReactivity"
  | "socialEnergy"
  | "warmthCooperation"
  | "reliabilityConsistency"
  | "curiosityDepth"
  | "depthPreference"
  | "replyPace"
  | "directness"
  | "conflictReflectiveness"
  | "supportNeed"
  | "anonymityComfort";

export type AssessmentQuestion = {
  id: string;
  dimension: AssessmentDimension;
  reverse?: boolean;
  text: string;
};

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "h1",
    dimension: "honestyBoundaryRespect",
    text: "معمولاً سعی می‌کنم در گفت‌وگوها واضح و صادق باشم، حتی وقتی گفتن حقیقت کمی سخت است.",
  },
  {
    id: "h2",
    dimension: "honestyBoundaryRespect",
    text: "وقتی کسی مرزی برای گفت‌وگو مشخص می‌کند، برایم مهم است به آن احترام بگذارم.",
  },
  {
    id: "h3",
    dimension: "honestyBoundaryRespect",
    text: "اگر بدانم طرف مقابل ناراحت می‌شود، از فشار آوردن برای گرفتن جواب خودداری می‌کنم.",
  },
  {
    id: "h4",
    dimension: "honestyBoundaryRespect",
    text: "در گفت‌وگوی ناشناس هم خودم را مسئول رفتارم می‌دانم.",
  },
  {
    id: "h5",
    dimension: "honestyBoundaryRespect",
    reverse: true,
    text: "اگر کسی مرا نشناسد، کمتر لازم می‌بینم مراقب لحنم باشم.",
  },
  {
    id: "h6",
    dimension: "honestyBoundaryRespect",
    reverse: true,
    text: "گاهی برای گرفتن توجه، حرفی می‌زنم که می‌دانم کاملاً دقیق یا منصفانه نیست.",
  },
  {
    id: "e1",
    dimension: "emotionalReactivity",
    text: "در گفت‌وگوهای احساسی، زود تحت تأثیر قرار می‌گیرم.",
  },
  {
    id: "e2",
    dimension: "emotionalReactivity",
    text: "اگر جوابم دیر داده شود، ممکن است ذهنم درگیر شود.",
  },
  {
    id: "e3",
    dimension: "emotionalReactivity",
    text: "وقتی سوءتفاهم پیش می‌آید، ترجیح می‌دهم قبل از واکنش کمی مکث کنم.",
  },
  {
    id: "e4",
    dimension: "emotionalReactivity",
    text: "در فضای ناشناس، اگر لحن طرف مقابل مبهم باشد ممکن است مضطرب شوم.",
  },
  {
    id: "e5",
    dimension: "emotionalReactivity",
    reverse: true,
    text: "معمولاً حتی در گفت‌وگوهای پرتنش هم آرام می‌مانم.",
  },
  {
    id: "e6",
    dimension: "emotionalReactivity",
    reverse: true,
    text: "حرف‌های تند یا سرد دیگران معمولاً مدت زیادی ذهنم را درگیر نمی‌کند.",
  },
  {
    id: "x1",
    dimension: "socialEnergy",
    text: "از شروع گفت‌وگو با آدم‌های جدید انرژی می‌گیرم.",
  },
  {
    id: "x2",
    dimension: "socialEnergy",
    text: "اگر ارتباط خوب پیش برود، دوست دارم گفت‌وگو طولانی‌تر شود.",
  },
  {
    id: "x3",
    dimension: "socialEnergy",
    reverse: true,
    text: "معمولاً راحت‌ترم طرف مقابل شروع‌کننده گفت‌وگو باشد.",
  },
  {
    id: "x4",
    dimension: "socialEnergy",
    text: "در ارتباط ناشناس، راحت‌تر از ارتباط با هویت واقعی حرف می‌زنم.",
  },
  {
    id: "x5",
    dimension: "socialEnergy",
    reverse: true,
    text: "بعد از چند پیام کوتاه معمولاً انرژی اجتماعی‌ام کم می‌شود.",
  },
  {
    id: "x6",
    dimension: "socialEnergy",
    reverse: true,
    text: "ترجیح می‌دهم ارتباط‌هایم محدود، آرام و کم‌تعداد باشند.",
  },
  {
    id: "a1",
    dimension: "warmthCooperation",
    text: "معمولاً سعی می‌کنم حرف طرف مقابل را با حسن‌نیت تفسیر کنم.",
  },
  {
    id: "a2",
    dimension: "warmthCooperation",
    text: "اگر اختلاف‌نظر پیش بیاید، دنبال فهمیدن طرف مقابل هستم، نه بردن بحث.",
  },
  {
    id: "a3",
    dimension: "warmthCooperation",
    text: "راحت‌ترم با کسی حرف بزنم که لحن آرام و محترمانه دارد.",
  },
  {
    id: "a4",
    dimension: "warmthCooperation",
    text: "اگر حس کنم کسی آسیب‌پذیر حرف می‌زند، مراقب‌تر جواب می‌دهم.",
  },
  {
    id: "a5",
    dimension: "warmthCooperation",
    reverse: true,
    text: "در بحث‌ها معمولاً مهم‌تر است حرفم را ثابت کنم تا اینکه فضا آرام بماند.",
  },
  {
    id: "a6",
    dimension: "warmthCooperation",
    reverse: true,
    text: "اگر کسی اشتباه برداشت کند، معمولاً حوصله توضیح دادن دوباره ندارم.",
  },
  {
    id: "c1",
    dimension: "reliabilityConsistency",
    text: "اگر بگویم جواب می‌دهم، معمولاً سعی می‌کنم واقعاً جواب بدهم.",
  },
  {
    id: "c2",
    dimension: "reliabilityConsistency",
    text: "دوست دارم ارتباط‌هایم نظم و حد مشخصی داشته باشند.",
  },
  {
    id: "c3",
    dimension: "reliabilityConsistency",
    text: "وقتی حالم خوب نیست، ترجیح می‌دهم به جای ناپدید شدن، کوتاه توضیح بدهم.",
  },
  {
    id: "c4",
    dimension: "reliabilityConsistency",
    text: "در گفت‌وگوهای مهم، با دقت جواب می‌دهم نه فقط سریع.",
  },
  {
    id: "c5",
    dimension: "reliabilityConsistency",
    reverse: true,
    text: "معمولاً پیام‌ها را باز می‌کنم و بعد فراموش می‌کنم جواب بدهم.",
  },
  {
    id: "c6",
    dimension: "reliabilityConsistency",
    reverse: true,
    text: "خیلی وقت‌ها بدون دلیل مشخص ارتباط را رها می‌کنم.",
  },
  {
    id: "o1",
    dimension: "curiosityDepth",
    text: "از گفت‌وگوهای عمیق درباره زندگی، فکر، هنر، تکنولوژی یا جامعه لذت می‌برم.",
  },
  {
    id: "o2",
    dimension: "curiosityDepth",
    text: "دوست دارم با آدم‌هایی حرف بزنم که زاویه دید متفاوتی دارند.",
  },
  {
    id: "o3",
    dimension: "curiosityDepth",
    text: "سؤال‌های خوب برایم جذاب‌تر از جواب‌های آماده‌اند.",
  },
  {
    id: "o4",
    dimension: "curiosityDepth",
    text: "در گفت‌وگو دوست دارم چیز تازه‌ای کشف کنم.",
  },
  {
    id: "o5",
    dimension: "curiosityDepth",
    reverse: true,
    text: "معمولاً گفت‌وگوهای خیلی عمیق یا فلسفی خسته‌ام می‌کند.",
  },
  {
    id: "o6",
    dimension: "curiosityDepth",
    reverse: true,
    text: "ترجیح می‌دهم گفت‌وگوها ساده، روزمره و بدون پیچیدگی بمانند.",
  },
  {
    id: "cs1",
    dimension: "depthPreference",
    text: "گفت‌وگوی عمیق و آرام را به چت سریع و سطحی ترجیح می‌دهم.",
  },
  {
    id: "cs2",
    dimension: "replyPace",
    text: "اگر کسی دیر جواب بدهد، برایم قابل قبول است.",
  },
  {
    id: "cs3",
    dimension: "directness",
    text: "دوست دارم طرف مقابل واضح و مستقیم حرف بزند.",
  },
  {
    id: "cs4",
    dimension: "conflictReflectiveness",
    text: "وقتی ناراحت می‌شوم، ترجیح می‌دهم کمی فاصله بگیرم و بعد حرف بزنم.",
  },
  {
    id: "cs5",
    dimension: "supportNeed",
    text: "دوست دارم در گفت‌وگو بیشتر شنیده شوم تا نصیحت بشوم.",
  },
  {
    id: "cs6",
    dimension: "anonymityComfort",
    text: "در ارتباط ناشناس راحت‌تر می‌توانم صادق باشم.",
  },
  {
    id: "cs7",
    dimension: "replyPace",
    text: "اگر طرف مقابل خیلی سریع و زیاد پیام بدهد، ممکن است خسته شوم.",
  },
  {
    id: "cs8",
    dimension: "conflictReflectiveness",
    text: "اگر سوءتفاهم شود، ترجیح می‌دهم همان لحظه روشنش کنیم.",
  },
  {
    id: "cs9",
    dimension: "supportNeed",
    text: "دوست دارم گفت‌وگوها بدون فشار برای ادامه دادن باشند.",
  },
  {
    id: "cs10",
    dimension: "honestyBoundaryRespect",
    text: "برایم مهم است قبل از پرسیدن سؤال شخصی، فضا و اجازه وجود داشته باشد.",
  },
  {
    id: "cs11",
    dimension: "socialEnergy",
    text: "از گفت‌وگوهای playful و شوخی‌دار لذت می‌برم.",
  },
  {
    id: "cs12",
    dimension: "warmthCooperation",
    text: "ترجیح می‌دهم طرف مقابل احساسی و انسانی جواب بدهد، نه خیلی خشک و منطقی.",
  },
];

export const ASSESSMENT_QUESTION_COUNT = ASSESSMENT_QUESTIONS.length;

export const getQuestionAtIndex = (index: number): AssessmentQuestion | undefined =>
  ASSESSMENT_QUESTIONS[index];
