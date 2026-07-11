export const MATCH_OPT_IN =
  "در حال حاضر در پیشنهادهای گفت‌وگو نمایش داده نمی‌شوی.\n\n" +
  "اگه بخوای، می‌تونی نمایش رو فعال کنی تا دیگران هم در صورت نزدیک بودن سبک گفت‌وگو، برات درخواست گفت‌وگو بفرستند.\n\n" +
  "هویت تلگرام، لینک شخصی و نتیجه‌ی کامل ارزیابی به دیگران نمایش داده نمی‌شه.";

export const MATCH_SEARCH_LIMIT =
  "جست‌وجو فعلاً محدود شده است.\n\nکمی بعد دوباره امتحان کن.";

export const MATCH_REQUEST_LIMIT =
  "امروز به سقف درخواست گفت‌وگو رسیدی.\n\nفردا می‌تونی دوباره تلاش کنی.";

export const MATCH_NO_CANDIDATES =
  "فعلاً گزینه‌ی تازه‌ای برای گفت‌وگو پیدا نکردم.\n\nبعداً دوباره سر بزن.";

export const MATCH_NO_CANDIDATES_COOLDOWN =
  "فعلاً گزینه‌ی تازه‌ای برای گفت‌وگو پیدا نکردم.\n\n" +
  "درخواست‌هایی که اخیراً پذیرفته یا رد شده‌اند، تا ۳۰ روز دوباره در جست‌وجو نشان داده نمی‌شن.\n\n" +
  "اگه می‌خوای همان افراد دوباره در جست‌وجو دیده بشن، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_INTRO_PROMPT =
  "یه پیام کوتاه و کم‌فشار برای شروع گفت‌وگو بنویس.\n\n" +
  "این پیام برای طرف مقابل فرستاده می‌شه. اگه بپذیره، گفت‌وگو به‌صورت پیام ناشناس در صندوق پیام‌ها ادامه پیدا می‌کنه.";

export const MATCH_INTRO_TEXT_ONLY =
  "برای پیام شروع فقط <b>متن</b> قابل قبول است. حداکثر ۵۰۰ کاراکتر.";

export const MATCH_INTRO_EMPTY =
  "پیام شروع نمی‌تونه خالی باشه.\n\nیه متن کوتاه بنویس.";

export const MATCH_INTRO_TOO_LONG =
  "پیام شروع خیلی طولانی است. حداکثر ۵۰۰ کاراکتر.";

export const MATCH_REQUEST_SENT =
  "درخواست گفت‌وگوت فرستاده شد.\n\nاگه طرف مقابل قبولش کنه، بهت خبر می‌دم.";

export const MATCH_ACCEPTED_CANDIDATE =
  "درخواست رو پذیرفتی.\n\nحالا می‌تونی گفت‌وگو رو از صندوق پیام‌ها ادامه بدی.\n" +
  "از <code>/inbox</code> ببینش و اگه خواستی پاسخ بده.";

export const MATCH_DECLINED_CANDIDATE =
  "درخواست گفت‌وگو رد شد. هیچ گفت‌وگویی ساخته نشد.";

export const MATCH_ACCEPTED_REQUESTER =
  "طرف مقابل درخواست گفت‌وگو رو پذیرفت.\n\nاگه پاسخ بده، پیامش در صندوق پیام‌ها نمایش داده می‌شه.";

export const MATCH_DECLINED_REQUESTER =
  "درخواست گفت‌وگو پذیرفته نشد.\n" +
  "می‌تونی بعداً پیشنهادهای دیگری رو بررسی کنی.";

export const MATCH_SUGGESTION_INVALID =
  "این پیشنهاد دیگر معتبر نیست. دوباره جست‌وجو کن.";

export const MATCH_RECENT_PAIR_COOLDOWN =
  "با این کاربر اخیراً درخواست گفت‌وگو پذیرفته یا رد شده است.\n" +
  "تا ۳۰ روز نمی‌تونی درخواست تازه بفرستی.\n\n" +
  "برای دیدن دوباره‌ی همان افراد در جست‌وجو، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_PENDING_EMPTY =
  "درخواست گفت‌وگوی در انتظاری نداری.";

export const MATCH_REQUEST_CANCELLED =
  "درخواست گفت‌وگو لغو شد.\n\nمی‌تونی دوباره جست‌وجو کنی یا درخواست تازه‌ای بفرستی.";

export const MATCH_REQUEST_CANCEL_FAILED =
  "این درخواست دیگر قابل لغو نیست.";

export const MATCH_HUB_STATUS = {
  assessmentInProgress: "ارزیابی: در حال انجام",
  assessmentCompleted: "ارزیابی: تکمیل‌شده",
  assessmentNotStarted: "ارزیابی: هنوز شروع نشده",
  discoverabilityNeedsAssessment: "نمایش در پیشنهادها: نیاز به ارزیابی کامل",
  discoverabilityActive: "نمایش در پیشنهادها: فعال",
  discoverabilityInactive: "نمایش در پیشنهادها: غیرفعال",
  searchNeedsAssessment: "جست‌وجو: بعد از تکمیل ارزیابی فعال می‌شه.",
  searchVectorPending: "جست‌وجو: پروفایل در حال آماده‌سازی است.",
  searchUnavailable: "جست‌وجو: فعلاً در دسترس نیست.",
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
  "🧭 <b>پیشنهاد گفت‌وگو</b>\n\n" +
  `${params.assessmentLine}\n` +
  `${params.discoverabilityLine}\n` +
  `${params.pendingLine}\n` +
  `${params.eligibilityLine}\n\n` +
  "از دکمه‌های زیر برای جست‌وجو، درخواست‌های گفت‌وگو یا پروفایل گفت‌وگو استفاده کن.";

export const MATCH_PROFILE_PRIVACY_NOTE =
  "این پروفایل فقط برای خودت نمایش داده می‌شه.\n" +
  "اگر نمایش در پیشنهادها رو فعال کنی، فقط برای ساخت پیشنهادهای گفت‌وگوی ناشناس استفاده می‌شه؛ نتیجه‌ی کامل ارزیابی به دیگران نمایش داده نمی‌شه.";

export const MATCH_PROFILE_NO_ASSESSMENT =
  "هنوز پروفایل گفت‌وگو نداری.\n\n" +
  "برای ساخت پروفایل، اول ارزیابی سبک گفت‌وگو را کامل کن.";

export const MATCH_PROFILE_HEADER = "👤 <b>پروفایل گفت‌وگو</b>";

export const MATCH_CANDIDATES_HEADER = "چند گزینه‌ی نزدیک به سبک گفت‌وگوی تو پیدا شد.";
export const MATCH_CANDIDATES_WHY_FIT = "چرا ممکن است گفت‌وگوی خوبی باشد؟";

export const MATCH_INCOMING_WHY_FIT = "<b>چرا ممکن است گفت‌وگوی خوبی باشد؟</b>";
export const MATCH_INCOMING_INTRO_LABEL = "<b>پیام شروع:</b>";
export const MATCH_INCOMING_ACCEPT_NOTE =
  "یک نفر بر اساس سبک گفت‌وگو، درخواست شروع گفت‌وگو فرستاده است.\n" +
  "اگر بپذیری، گفت‌وگو به‌صورت پیام ناشناس ادامه پیدا می‌کنه. اگر رد کنی، گفت‌وگویی ساخته نمی‌شه.";
