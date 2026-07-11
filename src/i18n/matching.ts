export const MATCH_DISCOVERABILITY_ENABLED =
  "نمایش در پیشنهادها فعال شد 🐾\n\n" +
  "از این به بعد نِکونیموس می‌تونه پروفایل گفت‌وگوت رو بین گزینه‌های ناشناس بررسی کنه.\n\n" +
  "مشخصات تلگرام، لینک شخصی و نتیجه‌ی کامل ارزیابیت به دیگران نمایش داده نمی‌شه.";

export const MATCH_SEARCH_LIMIT =
  "فعلاً نمی‌تونی دوباره جست‌وجو کنی.\n\nکمی بعد امتحان کن.";

export const MATCH_REQUEST_LIMIT =
  "سهم درخواست‌های امروزت تموم شده.\n\nفردا دوباره می‌تونی درخواست بفرستی.";

export const MATCH_NO_CANDIDATES =
  "میووو...\n\nفعلاً گزینه‌ی تازه‌ای پیدا نکردم.\nبعداً دوباره سر بزن.";

export const MATCH_NO_CANDIDATES_COOLDOWN =
  "میووو...\n\nفعلاً گزینه‌ی تازه‌ای پیدا نکردم.\n\n" +
  "درخواست‌هایی که اخیراً پذیرفته یا رد شدن، تا ۳۰ روز دوباره در جست‌وجو دیده نمی‌شن.\n\n" +
  "اگه می‌خوای همون افراد دوباره در جست‌وجو دیده بشن، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_INTRO_PROMPT =
  "یه پیام کوتاه برای شروع بنویس؛\n" +
  "چیزی که جواب دادن بهش راحت باشه.\n\n" +
  "اگه طرف مقابل قبول کنه، گفت‌وگو ناشناس ادامه پیدا می‌کنه.";

export const MATCH_INTRO_TEXT_ONLY =
  "پیام شروع باید متنی باشه و بیشتر از ۵۰۰ کاراکتر نباشه.";

export const MATCH_INTRO_EMPTY =
  "پیام شروع نمی‌تونه خالی باشه.\n\nیه متن کوتاه بنویس.";

export const MATCH_INTRO_TOO_LONG =
  "پیام شروع خیلی طولانیه.\n\nباید بیشتر از ۵۰۰ کاراکتر نباشه.";

export const MATCH_REQUEST_SENT =
  "فرستادمش 🐾\n\nاگه قبول کنه، بهت خبر می‌دم.";

export const MATCH_ACCEPTED_CANDIDATE =
  "قبولش کردی.\n\nپیامش توی صندوق پیام‌هاست.";

export const MATCH_DECLINED_CANDIDATE =
  "درخواست رد شد.\n\nگفت‌وگویی شروع نمی‌شه.";

export const MATCH_ACCEPTED_REQUESTER =
  "میو، درخواستت قبول شد 🐾\n\nاگه طرف مقابل جواب بده، پیامش توی صندوقت میاد.";

export const MATCH_DECLINED_REQUESTER =
  "درخواست گفت‌وگو پذیرفته نشد.\n" +
  "می‌تونی بعداً گزینه‌های دیگه رو ببینی.";

export const MATCH_SUGGESTION_INVALID =
  "این درخواست دیگه در دسترس نیست.";

export const MATCH_RECENT_PAIR_COOLDOWN =
  "بین شما اخیراً یک درخواست گفت‌وگو پذیرفته یا رد شده.\n" +
  "تا ۳۰ روز نمی‌تونی درخواست تازه بفرستی.\n\n" +
  "برای دیدن دوباره‌ی همون افراد در جست‌وجو، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_PENDING_EMPTY =
  "درخواست گفت‌وگوی در انتظاری نداری.";

export const MATCH_REQUEST_CANCELLED =
  "درخواست لغو شد.";

export const MATCH_REQUEST_CANCEL_FAILED =
  "این درخواست دیگه در دسترس نیست.";

export const MATCH_HUB_STATUS = {
  assessmentInProgress: "ارزیابی: در حال انجام",
  assessmentCompleted: "ارزیابی: آماده",
  assessmentNotStarted: "ارزیابی: هنوز شروع نشده",
  discoverabilityNeedsAssessment: "نمایش در پیشنهادها: بعد از ارزیابی",
  discoverabilityActive: "نمایش در پیشنهادها: فعال",
  discoverabilityInactive: "نمایش در پیشنهادها: غیرفعال",
  searchNeedsAssessment: "جست‌وجو: بعد از ارزیابی",
  searchVectorPending: "جست‌وجو: در حال آماده‌شدن",
  searchUnavailable: "جست‌وجو: فعلاً در دسترس نیست",
  searchNeedsOptIn: "جست‌وجو: اول نمایش در پیشنهادها رو فعال کن.",
  searchReady: "جست‌وجو: آماده",
  pendingNone: "درخواست‌های باز: نداری",
  pendingCount: (count: string): string => `درخواست‌های باز: ${count}`,
} as const;

export const formatSuggestionHubMessage = (params: {
  assessmentLine: string;
  discoverabilityLine: string;
  pendingLine: string;
  eligibilityLine: string;
}): string =>
  "<b>پیشنهاد گفت‌وگو</b>\n\n" +
  `${params.assessmentLine}\n` +
  `${params.discoverabilityLine}\n` +
  `${params.pendingLine}\n` +
  `${params.eligibilityLine}\n\n` +
  "از دکمه‌های پایین انتخاب کن.";

export const MATCH_PROFILE_PRIVACY_NOTE =
  "این پروفایل فقط برای خودت نمایش داده می‌شه.\n" +
  "اگه نمایش در پیشنهادها رو فعال کنی، فقط برای ساخت پیشنهادهای گفت‌وگوی ناشناس استفاده می‌شه؛ نتیجه‌ی کامل ارزیابی به دیگران نمایش داده نمی‌شه.\n\n" +
  "این فقط خلاصه‌ی ترجیحات گفت‌وگوت هست.\nنتیجه‌ی تست شخصیت یا تعریف قطعی تو نیست.";

export const MATCH_PROFILE_NO_ASSESSMENT =
  "هنوز پروفایل گفت‌وگو نداری.\n\n" +
  "برای ساخت پروفایل، اول ارزیابی سبک گفت‌وگو رو کامل کن.";

export const MATCH_PROFILE_FAILED =
  "پروفایل گفت‌وگو فعلاً در دسترس نیست.\n\n" +
  "ارزیابی رو دوباره انجام بده یا کمی بعد امتحان کن.";

export const MATCH_SEARCH_INDEX_PENDING =
  "دارم پروفایلت رو برای پیشنهادهای گفت‌وگو آماده می‌کنم.\n\n" +
  "کمی بعد دوباره سر بزن.";

export const MATCH_PROFILE_HEADER = "👤 <b>پروفایل گفت‌وگو</b>";

export const MATCH_CANDIDATES_HEADER = "یه گزینه برای گفت‌وگو پیدا کردم.";
export const MATCH_CANDIDATES_WHY_FIT = "چیزهایی که بینتون نزدیکه:";

export const MATCH_INCOMING_WHY_FIT = "<b>چیزهایی که بینتون نزدیکه:</b>";
export const MATCH_INCOMING_INTRO_LABEL = "<b>پیام شروع:</b>";
export const MATCH_INCOMING_ACCEPT_NOTE =
  "یه نفر از پیشنهادهای گفت‌وگو برات پیام شروع فرستاده.\n\n" +
  "اگه قبول کنی، گفت‌وگو ناشناس شروع می‌شه.";
