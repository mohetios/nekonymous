export type MatchQualityLabel = "strong" | "good" | "moderate" | "limited";

export const MATCH_PRODUCT_FRAMING =
  "پیشنهاد گفت‌وگو بر اساس سبک گفت‌وگو، مرزها، عمق، انرژی اجتماعی و شباهت معنایی پروفایل ارزیابی است.\n\n" +
  "این سیستم تشخیص روان‌شناسی، درمان، یا پیشنهاد رابطه نیست.";

export const MATCH_NO_PROFILE =
  "برای پیدا کردن گزینه‌های گفت‌وگو، اول باید ارزیابی سبک گفت‌وگو را کامل کنی.";

export const MATCH_PROFILE_VERSION_OUTDATED =
  "نسخه جدید ارزیابی آماده شده است.\n" +
  "برای پیشنهادهای بهتر، بهتر است ارزیابی را یک بار دیگر کامل کنی.\n\n" +
  "تا وقتی ارزیابی جدید را کامل نکنی، پیشنهادهای گفت‌وگو با نتیجه قبلی ادامه پیدا می‌کنند.";

export const MATCH_VECTOR_PENDING =
  "نتیجه ارزیابی آماده است، اما پروفایل گفت‌وگو هنوز برای جست‌وجو آماده نشده.\n" +
  "چند لحظه بعد دوباره امتحان کن.";

export const MATCH_VECTOR_FAILED =
  "پروفایل گفت‌وگو هنوز برای جست‌وجو آماده نشده.\n" +
  "می‌توانی دوباره تلاش کنی یا کمی بعد برگردی.";

export const MATCH_OPT_IN =
  "فعلاً در پیشنهادهای گفت‌وگو نمایش داده نمی‌شوی.\n\n" +
  "اگر بخواهی، می‌توانی نمایش را فعال کنی تا دیگران هم بتوانند در صورت نزدیکی سبک گفت‌وگو، برایت درخواست گفت‌وگو بفرستند.\n\n" +
  "هویت تلگرام، لینک شخصی و نتیجه کامل ارزیابی به دیگران نمایش داده نمی‌شود.";

export const MATCH_READY_INTRO =
  "🔎 <b>پیدا کردن گزینه‌ها</b>\n\n" +
  "چند گزینه‌ی نزدیک به سبک گفت‌وگوی تو پیدا شد.\n\n" +
  "این نتیجه تشخیص شخصیت یا سازگاری قطعی نیست. فقط یک پیشنهاد برای شروع گفت‌وگوست.\n\n" +
  MATCH_PRODUCT_FRAMING;

export const MATCH_ENABLED =
  "نمایش در پیشنهادهای گفت‌وگو فعال شد. پروفایل تو فقط برای پیشنهادهای ناشناس استفاده می‌شود، نه برای نمایش هویت.";

export const MATCH_DISABLED =
  "نمایش در پیشنهادهای گفت‌وگو متوقف شد. پروفایل تو دیگر در پیشنهادهای جدید ظاهر نمی‌شود.";

export const MATCH_SEARCH_LIMIT =
  "برای جلوگیری از فشار روی سیستم، جست‌وجو محدود است. کمی بعد دوباره امتحان کن.";

export const MATCH_REQUEST_LIMIT =
  "امروز به سقف درخواست گفت‌وگو رسیدی. فردا می‌توانی دوباره تلاش کنی.";

export const MATCH_NO_CANDIDATES =
  "فعلاً گزینه‌ی نزدیکی برای پیشنهاد وجود ندارد.\n\n" +
  "بعداً دوباره امتحان کن؛ با بیشتر شدن پروفایل‌های فعال، پیشنهادها بهتر می‌شوند.";

export const MATCH_NO_CANDIDATES_COOLDOWN =
  "فعلاً گزینه‌ای برای پیشنهاد جدید نیست.\n\n" +
  "با برخی کاربران اخیراً درخواست گفت‌وگو پذیرفته یا رد شده است و تا ۳۰ روز همان افراد در جست‌وجو نشان داده نمی‌شوند.\n\n" +
  "اگر می‌خواهی دوباره همان افراد را ببینی، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_INTRO_PROMPT =
  "اگر دوست داری، یک پیام کوتاه برای شروع گفت‌وگو بنویس.\n\n" +
  "این پیام برای طرف مقابل ارسال می‌شود. اگر بپذیرد، یک گفت‌وگوی ناشناس در صندوق پیام‌ها ساخته می‌شود.";

export const MATCH_INTRO_TEXT_ONLY =
  "برای پیام شروع فقط <b>متن</b> قابل قبول است. حداکثر ۵۰۰ کاراکتر.";

export const MATCH_INTRO_EMPTY =
  "پیام شروع نمی‌تواند خالی باشد. یک متن کوتاه بنویس.";

export const MATCH_INTRO_TOO_LONG =
  "پیام شروع خیلی طولانی است. حداکثر ۵۰۰ کاراکتر.";

export const MATCH_REQUEST_SENT =
  "درخواست گفت‌وگو ارسال شد. اگر طرف مقابل بپذیرد، از طریق صندوق پیام‌ها مطلع می‌شوی.";

export const MATCH_ACCEPTED_CANDIDATE =
  "درخواست پذیرفته شد. حالا می‌توانی به‌صورت ناشناس گفت‌وگو را ادامه بدهی.\nاز <code>/inbox</code> می‌توانی آن را ببینی و جواب بدهی.";

export const MATCH_DECLINED_CANDIDATE =
  "درخواست گفت‌وگو رد شد. هیچ گفت‌وگویی ساخته نشد.";

export const MATCH_ACCEPTED_REQUESTER =
  "درخواست گفت‌وگو پذیرفته شد. اگر طرف مقابل جواب بدهد، پیام در صندوق پیام‌ها نمایش داده می‌شود.";

export const MATCH_DECLINED_REQUESTER =
  "درخواست گفت‌وگو پذیرفته نشد.\nمی‌توانی بعداً پیشنهادهای دیگری را بررسی کنی.";

export const MATCH_REQUEST_EXPIRED =
  "این درخواست منقضی شده است.";

export const MATCH_REQUEST_ALREADY_HANDLED =
  "این درخواست قبلاً پاسخ داده شده است.";

export const MATCH_REQUEST_ALREADY_ACCEPTED =
  "این درخواست قبلاً پذیرفته شده است. گفت‌وگو از طریق صندوق پیام‌ها در دسترس است.";

export const MATCH_SUGGESTION_INVALID =
  "این پیشنهاد دیگر معتبر نیست. دوباره جست‌وجو کن.";

export const MATCH_CANDIDATE_UNAVAILABLE =
  "این پیشنهاد دیگر در دسترس نیست.";

export const MATCH_PENDING_EXISTS =
  "بین شما و این کاربر یک درخواست گفت‌وگو در انتظار است.\n" +
  "از «📥 درخواست‌های گفت‌وگو» در منوی پیشنهاد گفت‌وگو آن را ببین و پاسخ بده یا لغو کن.";

export const MATCH_RECENT_PAIR_COOLDOWN =
  "با این کاربر اخیراً درخواست گفت‌وگو پذیرفته یا رد شده است.\n" +
  "تا ۳۰ روز نمی‌توانی درخواست جدید بفرستی.\n\n" +
  "برای دیدن دوبارهٔ همان افراد در جست‌وجو، از تنظیمات → «♻️ بازنشانی پیشنهادها» استفاده کن.";

export const MATCH_PENDING_EMPTY =
  "درخواست گفت‌وگوی در انتظاری نداری.";

export const MATCH_PENDING_LIST_HEADER =
  "📥 <b>درخواست‌های گفت‌وگو</b>\n\n" +
  "ورودی: {incoming} — ارسالی: {outgoing}\n\n" +
  "برای هر مورد، دکمه‌های زیر همان پیام را بزن.";

export const MATCH_PENDING_INCOMING_LABEL = "📨 <b>درخواست دریافتی</b>";

export const MATCH_PENDING_OUTGOING_LABEL =
  "📤 <b>درخواست ارسالی</b> — در انتظار پاسخ";

export const MATCH_REQUEST_CANCELLED =
  "درخواست گفت‌وگو لغو شد. می‌توانی دوباره جست‌وجو کنی یا درخواست جدید بفرستی.";

export const MATCH_REQUEST_CANCEL_FAILED =
  "این درخواست دیگر قابل لغو نیست.";

export const MATCH_SYSTEM_INTRO =
  "🧭 <b>پیشنهادهای گفت‌وگو</b>\n\n" +
  "اینجا می‌توانی بر اساس ارزیابی سبک گفت‌وگو، چند گزینه‌ی نزدیک برای شروع گفت‌وگوی ناشناس ببینی.\n\n" +
  "این‌ها پیشنهاد قطعی یا درصد سازگاری نیستند؛ فقط گزینه‌هایی هستند که ممکن است شروع گفت‌وگوی بهتری بسازند.";

export const MATCH_PROFILE_PRIVACY_NOTE =
  "این پروفایل فقط برای خودت نمایش داده می‌شود.\n" +
  "اگر نمایش در پیشنهادها را فعال کنی، فقط برای پیدا کردن پیشنهادهای ناشناس استفاده می‌شود؛ نتیجه کامل ارزیابی به دیگران نمایش داده نمی‌شود.";

export const MATCH_PROFILE_NO_ASSESSMENT =
  "هنوز پروفایل گفت‌وگو نداری.\n\n" +
  "برای ساخت پروفایل، اول ارزیابی سبک گفت‌وگو را کامل کن.";

export const MATCH_PROFILE_VECTOR_PENDING =
  "پروفایل ارزیابی ذخیره شده، اما آماده‌سازی پیشنهاد گفت‌وگو هنوز کامل نشده.\n" +
  "می‌توانی بعداً دوباره امتحان کنی.";

export const MATCH_PROFILE_HEADER = "👤 <b>پروفایل گفت‌وگو</b>";

export const MATCH_PROFILE_LABEL_VERSION = "نسخه ارزیابی";
export const MATCH_PROFILE_LABEL_STATUS = "وضعیت";
export const MATCH_PROFILE_LABEL_READY = "آماده برای پیشنهاد گفت‌وگو";
export const MATCH_PROFILE_LABEL_DISCOVERABLE = "نمایش در پیشنهادها";
export const MATCH_PROFILE_LABEL_SUMMARY = "خلاصه";
export const MATCH_PROFILE_LABEL_SCORES = "امتیازها";
export const MATCH_PROFILE_LABEL_PREFERENCES = "ترجیح‌های گفت‌وگو";

export const MATCH_PROFILE_DISCOVERABLE_ACTIVE = "فعال";
export const MATCH_PROFILE_DISCOVERABLE_INACTIVE = "غیرفعال";
export const MATCH_PROFILE_READY_NO = "خیر";
export const MATCH_PROFILE_READY_PENDING = "در انتظار آماده‌سازی";
export const MATCH_PROFILE_READY_NEEDS_OPT_IN = "نیاز به فعال‌سازی نمایش";
export const MATCH_PROFILE_READY_LIMITED = "محدود";
export const MATCH_PROFILE_READY_YES = "بله";
export const MATCH_PROFILE_STATUS_COMPLETED = "تکمیل‌شده";
export const MATCH_PROFILE_STATUS_INCOMPLETE = "ناقص";

export const MATCH_QUALITY_COPY: Record<MatchQualityLabel, string> = {
  strong: "سبک گفت‌وگوی خیلی نزدیک",
  good: "سبک گفت‌وگوی نزدیک",
  moderate: "نزدیکی متوسط در سبک گفت‌وگو",
  limited: "نزدیکی محدود در سبک گفت‌وگو",
};

export const MATCH_LIMITED_SIMILARITY_NOTE =
  "فعلاً گزینه‌های فعال کم هستند. نزدیک‌ترین گزینه‌های فعلی را نشان می‌دهیم.\n" +
  "اگر خواستی، با یک پیام کوتاه و کم‌فشار شروع کن.";

export const MATCH_SIMILARITY_DISCLAIMER =
  "این نتیجه تشخیص شخصیت یا سازگاری قطعی نیست. فقط یک پیشنهاد برای شروع گفت‌وگوست.";

export const MATCH_REQUEST_SIMILARITY_LIMITED =
  "یک نفر از بین گزینه‌های فعلی می‌خواهد با تو یک گفت‌وگوی ناشناس کم‌فشار شروع کند.";

export const MATCH_EXPLANATION_TITLE = "پیشنهاد گفت‌وگو";
export const MATCH_EXPLANATION_FALLBACK_REASON =
  "چند نقطه مشترک در سبک ارتباطی دیده می‌شود.";

export const MATCH_REASON_BOUNDARY = "در احترام به مرزها به هم نزدیک هستید.";
export const MATCH_REASON_DEPTH = "سبک گفت‌وگوی شما از نظر عمق گفتگو نزدیک است.";
export const MATCH_REASON_CONFLICT_REPAIR =
  "هر دو در سوءتفاهم‌ها تمایل به ترمیم گفتگو دارید.";
export const MATCH_REASON_WARMTH =
  "لحن و گرمی گفت‌وگو می‌تواند برای هر دو کم‌فشار باشد.";
export const MATCH_CAUTION_REPLY_PACE = "در سرعت پاسخ‌دادن کمی تفاوت دارید.";
export const MATCH_CAUTION_DIRECTNESS =
  "در مستقیم گفتن خواسته‌ها ممکن است کمی تفاوت داشته باشید.";

export const MATCH_CANDIDATES_HEADER = "چند گزینه‌ی نزدیک به سبک گفت‌وگوی تو پیدا شد.";
export const MATCH_CANDIDATES_COUNT_FOUND = (count: string): string =>
  `در حال حاضر ${count} گزینه پیدا شد.`;
export const MATCH_CANDIDATES_SINGLE_ONLY =
  "فعلاً فقط یک گزینه قابل پیشنهاد پیدا شد.";
export const MATCH_CANDIDATES_WHY_FIT = "چرا ممکن است مناسب باشد؟";

export const MATCH_INCOMING_WHY_FIT = "<b>چرا ممکن است مناسب باشد؟</b>";
export const MATCH_INCOMING_INTRO_LABEL = "<b>پیام شروع:</b>";
export const MATCH_INCOMING_ACCEPT_NOTE =
  "یک نفر بر اساس سبک گفت‌وگو، درخواست شروع گفت‌وگو فرستاده است.\n" +
  "اگر بپذیری، یک گفت‌وگوی ناشناس ساخته می‌شود. اگر رد کنی، گفت‌وگویی ساخته نمی‌شود.";

export const MATCH_OUTGOING_INTRO_LABEL = "<b>پیام شروع:</b>";
export const MATCH_OUTGOING_WAIT_NOTE =
  "منتظر پاسخ طرف مقابل هستی.\n" +
  "اگر دیگر نمی‌خواهی منتظر بمانی، می‌توانی درخواست را لغو کنی.";

export const formatMatchRequestSimilarityLine = (
  qualityLabel: MatchQualityLabel
): string => {
  if (qualityLabel === "limited") {
    return MATCH_REQUEST_SIMILARITY_LIMITED;
  }
  return `یک نفر با ${MATCH_QUALITY_COPY[qualityLabel]} می‌خواهد با تو یک گفت‌وگوی ناشناس شروع کند.`;
};
