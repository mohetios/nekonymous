export const MATCH_DISCOVERABILITY_ENABLED =
  "نمایش در پیشنهادها فعال شد 🐾\n\n" +
  "از این به بعد می‌تونم پروفایل گفت‌وگوت رو بین گزینه‌های ناشناس بررسی کنم.\n\n" +
  "مشخصات تلگرام، لینک شخصی و نتیجه‌ی کامل ارزیابیت به دیگران نمایش داده نمی‌شه.";

export const MATCH_SEARCH_LIMIT =
  "فعلاً نمی‌تونی دوباره پیشنهادها رو جست‌وجو کنی.\n\nکمی بعد امتحان کن.";

export const MATCH_SEARCH_FAILED =
  "فعلاً نتونستم پیشنهادها رو پیدا کنم.\n\nکمی بعد دوباره امتحان کن.";

export const MATCH_REQUEST_LIMIT =
  "سهم درخواست‌های امروزت تموم شده.\n\nفردا دوباره می‌تونی درخواست بفرستی.";

export const MATCH_NO_CANDIDATES =
  "میووو...\n\n" +
  "فعلاً گزینه‌ی تازه‌ای برای گفت‌وگو پیدا نکردم.\n" +
  "کمی بعد دوباره سر بزن.";

export const MATCH_NO_CANDIDATES_COOLDOWN =
  "میووو...\n\n" +
  "فعلاً گزینه‌ی تازه‌ای برای گفت‌وگو پیدا نکردم.\n\n" +
  "افرادی که اخیراً بینتون یک درخواست پذیرفته یا رد شده، تا ۳۰ روز دوباره در پیشنهادها دیده نمی‌شن.\n\n" +
  "برای دیدن دوباره‌ی همون افراد، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_INTRO_PROMPT =
  "یه پیام کوتاه برای شروع بنویس؛\n" +
  "چیزی که جواب‌دادن بهش راحت باشه.\n\n" +
  "گفت‌وگو فقط وقتی شروع می‌شه که طرف مقابل درخواستت رو بپذیره.";

export const MATCH_INTRO_TEXT_ONLY =
  "پیام شروع باید متنی باشه و بیشتر از ۵۰۰ کاراکتر نباشه.";

export const MATCH_INTRO_EMPTY =
  "پیام شروع نمی‌تونه خالی باشه.\n\nیه متن کوتاه بنویس.";

export const MATCH_INTRO_TOO_LONG =
  "پیام شروع خیلی طولانیه.\n\nباید حداکثر ۵۰۰ کاراکتر باشه.";

export const MATCH_REQUEST_SENT =
  "فرستادمش 🐾\n\nاگه قبولش کنه، بهت خبر می‌دم.";

export const MATCH_ACCEPTED_CANDIDATE =
  "قبولش کردی.\n\nپیام شروعش توی صندوق پیام‌هاست.";

export const MATCH_DECLINED_CANDIDATE =
  "درخواست رد شد.\n\nگفت‌وگویی شروع نمی‌شه.";

export const MATCH_ACCEPTED_REQUESTER =
  "میو، درخواستت قبول شد 🐾\n\n" +
  "اگه طرف مقابل جواب بده، پیامش توی صندوقت میاد.";

export const MATCH_DECLINED_REQUESTER =
  "درخواستت پذیرفته نشد.\n\nمی‌تونی بعداً گزینه‌های دیگه رو ببینی.";

export const MATCH_SUGGESTION_INVALID = "این درخواست دیگه در دسترس نیست.";

export const MATCH_RECENT_PAIR_COOLDOWN =
  "بین شما اخیراً یک درخواست گفت‌وگو پذیرفته یا رد شده.\n" +
  "تا ۳۰ روز نمی‌تونی درخواست تازه‌ای برای همین نفر بفرستی.\n\n" +
  "برای برداشتن این فاصله، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_PENDING_EMPTY = "فعلاً درخواست گفت‌وگویی در انتظار پاسخ نداری.";
export const MATCH_REQUEST_CANCELLED = "درخواست لغو شد.";
export const MATCH_REQUEST_CANCEL_FAILED = "این درخواست دیگه در دسترس نیست.";

export const MATCH_HUB_STATUS = {
  assessmentInProgress: "ارزیابی: در حال انجام",
  assessmentCompleted: "ارزیابی: آماده",
  assessmentNotStarted: "ارزیابی: هنوز شروع نشده",
  discoverabilityNeedsAssessment: "نمایش در پیشنهادها: بعد از ارزیابی",
  discoverabilityActive: "نمایش در پیشنهادها: فعال",
  discoverabilityInactive: "نمایش در پیشنهادها: غیرفعال",
  searchNeedsAssessment: "پیشنهادها: بعد از ارزیابی",
  searchVectorPending: "پیشنهادها: در حال آماده‌شدن",
  searchUnavailable: "پیشنهادها: فعلاً در دسترس نیست",
  searchReady: "پیشنهادها: آماده",
  pendingNone: "درخواست‌های باز: نداری",
  pendingCount: (count: string): string => `درخواست‌های باز: ${count}`,
} as const;

export const formatSuggestionHubMessage = (params: {
  assessmentLine: string;
  discoverabilityLine: string;
  pendingLine: string;
  eligibilityLine: string;
}): string =>
  "پیشنهاد گفت‌وگو\n\n" +
  `${params.assessmentLine}\n` +
  `${params.discoverabilityLine}\n` +
  `${params.pendingLine}\n` +
  `${params.eligibilityLine}\n\n` +
  "از دکمه‌های پایین انتخاب کن.";

export const MATCH_PROFILE_PRIVACY_NOTE =
  "این پروفایل فقط برای خودته.\n\n" +
  "اگه نمایش در پیشنهادها رو فعال کنی، از همین خلاصه برای پیدا کردن گزینه‌های ناشناس استفاده می‌شه؛ نتیجه‌ی کامل ارزیابیت به دیگران نمایش داده نمی‌شه.\n\n" +
  "این فقط خلاصه‌ی ترجیحات گفت‌وگوت هست، نه تست شخصیت یا تعریف قطعی تو.";

export const MATCH_PROFILE_NO_ASSESSMENT =
  "هنوز پروفایل گفت‌وگو نداری.\n\n" +
  "اول ارزیابی سبک گفت‌وگو رو کامل کن.";

export const MATCH_PROFILE_FAILED =
  "فعلاً نتونستم پروفایل گفت‌وگوت رو باز کنم.\n\n" +
  "کمی بعد دوباره امتحان کن؛ اگه مشکل موند، ارزیابی رو از نو انجام بده.";

export const MATCH_SEARCH_INDEX_PENDING =
  "دارم پروفایلت رو برای پیشنهادهای گفت‌وگو آماده می‌کنم.\n\n" +
  "کمی بعد دوباره سر بزن.";

export const MATCH_PROFILE_HEADER = "👤 پروفایل گفت‌وگو";
export const MATCH_CANDIDATES_HEADER = "میو، یه گزینه برای گفت‌وگو پیدا کردم 🐾";
export const MATCH_CANDIDATES_WHY_FIT = "چیزهایی که بینتون نزدیکه:";
export const MATCH_INCOMING_WHY_FIT = "چیزهایی که بینتون نزدیکه:";
export const MATCH_INCOMING_INTRO_LABEL = "پیام شروع:";

export const MATCH_INCOMING_ACCEPT_NOTE =
  "یه نفر از پیشنهادهای گفت‌وگو برات پیام شروع فرستاده.\n\n" +
  "اگه قبولش کنی، گفت‌وگوی ناشناس شروع می‌شه.";
