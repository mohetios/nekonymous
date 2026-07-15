/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */
import { convertToPersianNumbers } from "../utils/text";

export const PROJECT_INTRO_URL = "https://mohetios.github.io/Nekonymous/";

export const WelcomeMessage =
  "میو، رسیدی 🐾\n\n" +
  "من نِکونیموسم؛ گربه‌ی نارنجی پیام‌های ناشناس.\n\n" +
  "اینم لینک پیام ناشناس تو:\n\n" +
  "UUID_USER_URL\n\n" +
  "هرکی بازش کنه، می‌تونه برات پیام ناشناس بفرسته.\n\n" +
  "من پیام‌ها رو میارم همین‌جا.\n" +
  "جواب بدی یا نه، با خودته.";

export const USER_LINK_MESSAGE =
  "میو، اینم لینک پیام ناشناست 🐾\n\n" +
  "UUID_USER_URL\n\n" +
  "هرکی بازش کنه، می‌تونه برات پیام ناشناس بفرسته.";

const DRAFT_KEYBOARD_HINT = "برای لغو، دکمه‌ی ↩️ لغو پایین رو بزن.";

export const StartConversationMessage =
  "داری برای USER_NAME پیام ناشناس می‌فرستی.\n\n" +
  "پیامت رو بنویس؛ من همون رو می‌رسونم.\n\n" +
  "مشخصات تلگرامت برای طرف مقابل نمایش داده نمی‌شه.\n\n" +
  DRAFT_KEYBOARD_HINT;

export const HuhMessage =
  "فعلاً نتونستم این کار رو انجام بدم.\n\nکمی بعد دوباره امتحان کن.";

export const NoUserFoundMessage =
  "این لینک دیگه فعال نیست.\n\n" +
  "ممکنه اشتباه کپی شده باشه، منقضی شده باشه یا صاحبش حسابش رو پاک کرده باشه.\n\n" +
  "لینک تازه رو از خودش بگیر.";

export const NoConversationFoundMessage =
  "این مسیر دیگه در دسترس نیست.\n\n" +
  "از صندوق پیام‌ها یا منوی اصلی دوباره شروع کن.";

export const MESSAGE_SENT_MESSAGE = "پیامت رسید 🐾";
export const REPLY_SENT_MESSAGE = "جوابت رسید 🐾";

export const USER_BLOCKED_MESSAGE =
  "این فرستنده مسدود شد.\n\n" +
  "دیگه نمی‌تونه از همین مسیر برات پیام بفرسته.";

export const USER_UNBLOCKED_MESSAGE =
  "مسدودیش برداشته شد.\n\n" +
  "حالا دوباره می‌تونه برات پیام بفرسته.";

export const REPLY_TO_MESSAGE =
  "پاسخ ناشناس\n\n" +
  "جوابت رو بنویس؛ من همون رو ناشناس می‌رسونم.\n\n" +
  "مشخصات تلگرامت برای طرف مقابل نمایش داده نمی‌شه.\n\n" +
  DRAFT_KEYBOARD_HINT;

export const REPLY_TO_NICKNAME_MESSAGE =
  "پاسخ به NICKNAME\n\n" +
  "جوابت رو بنویس؛ من همون رو ناشناس می‌رسونم.\n\n" +
  "این نام خصوصی فقط برای خودت نمایش داده می‌شه.\n\n" +
  DRAFT_KEYBOARD_HINT;

export const NICKNAME_PROMPT_MESSAGE =
  "برای این فرستنده یه نام خصوصی بنویس.\n\n" +
  "این نام فقط برای خودت نمایش داده می‌شه و فرستنده نمی‌بینتش.\n\n" +
  "نام فعلی: CURRENT_NICK\n\n" +
  "برای حذفش، بنویس «حذف».\n\n" +
  DRAFT_KEYBOARD_HINT;

export const NICKNAME_SAVED_MESSAGE = "نام خصوصیش شد: NAME";

export const NICKNAME_REMOVED_MESSAGE =
  "نام خصوصی حذف شد.\n\n" +
  "این فرستنده دوباره بدون نام خصوصی نمایش داده می‌شه.";

export const NICKNAME_LIMIT_MESSAGE =
  "دیگه نمی‌تونی نام خصوصی تازه‌ای اضافه کنی.\n\n" +
  "اول یکی از نام‌های قبلی رو پاک کن.";

export const NICKNAME_TEXT_ONLY_MESSAGE =
  "نام خصوصی باید متنی باشه.\n\n" +
  "عکس، فایل، صدا یا استیکر اینجا کار نمی‌کنه.";

export const RECIPIENT_PAUSED_MESSAGE =
  "USER_NAME فعلاً پیام ناشناس دریافت نمی‌کنه.\n\n" +
  "بعداً می‌تونی از همین لینک دوباره امتحان کنی.";

export const OWNER_PAUSED_NOTE =
  "دریافت پیام متوقفه.\n\n" +
  "لینکت هنوز فعاله، ولی فعلاً پیام تازه‌ای دریافت نمی‌کنی.\n\n" +
  "برای فعال‌سازی دوباره: تنظیمات → ▶️ فعال‌سازی دریافت پیام";

export const USER_IS_BLOCKED_MESSAGE =
  "از این مسیر امکان ارسال پیام نداری.";

export const ABOUT_PRIVACY_COMMAND_MESSAGE =
  "نِکونیموس: درباره و حریم خصوصی\n\n" +
  "میو، من نِکونیموسم؛ گربه‌ی نارنجی پیام‌های ناشناس.\n\n" +
  "به هر کاربر یک لینک شخصی می‌دم. هرکس لینک رو باز کنه، می‌تونه بدون نمایش مشخصات تلگرامی‌اش برای صاحب لینک پیام بفرسته. جواب‌ها هم از همین مسیر برمی‌گردن و در جریان معمول بات، دو طرف مشخصات تلگرامی هم رو نمی‌بینن.\n\n" +
  "پیام‌ها چطور جابه‌جا می‌شن؟\n\n" +
  "نکو پیام‌ها رو مثل یک چت معمولی با تاریخچه‌ی دائمی نگه نمی‌داره. هر پیام یک تیکت مستقل و مهروموم‌شده‌ست: متن پیام تا اولین نمایش موفق، رمزنگاری‌شده می‌مونه و بعد از نمایش از فضای ذخیره‌سازی نکو پاک می‌شه. فقط مسیر رمزنگاری‌شده‌ی لازم برای پاسخ، نام خصوصی، مسدودسازی یا گزارش تا زمان انقضای تیکت باقی می‌مونه.\n\n" +
  "چرا این طراحی مهمه؟\n\n" +
  "• متن پیام در پایگاه داده‌ی اصلی و به‌شکل یک مکالمه‌ی قابل اتصال به کاربران ذخیره نمی‌شه.\n" +
  "• هر پیام دسترسی محدود خودش رو داره.\n" +
  "• گزارش‌ها و آمار به‌شکل محدود و تجمیعی نگه‌داری می‌شن، نه به‌صورت فهرست ارتباط آدم‌ها.\n\n" +
  "هسته‌ی نِکونیموس روی Cloudflare Workers اجرا می‌شه. Durable Objects وضعیت‌های حساس رو هماهنگ می‌کنن و Queueها خطاهای موقت ارسال رو مدیریت می‌کنن؛ این معماری کمک می‌کنه بات سبک، سریع و قابل اتکا بمونه.\n\n" +
  "مرز صادقانه‌ی حریم خصوصی\n\n" +
  "نِکونیموس پیام‌رسان رمزنگاری سرتاسری نیست. هنگام ارسال، پیام از تلگرام و هسته‌ی نکو عبور می‌کنه و برای رساندن پردازش می‌شه؛ اما نکو این عبور رو به تاریخچه‌ی دائمی یا گراف قابل جست‌وجوی فرستنده و گیرنده تبدیل نمی‌کنه.\n\n" +
  "ناشناسی کامل در برابر خود تلگرام، دستگاه آلوده، اسکرین‌شات، لو رفتن لینک یا در اختیار گرفتن زیرساخت تضمین نمی‌شه.\n\n" +
  "ارزیابی سبک گفت‌وگو تست شخصیت نیست و نمایش در پیشنهادها هم به‌صورت پیش‌فرض خاموشه. هیچ گفت‌وگویی بدون پذیرش طرف مقابل شروع نمی‌شه.\n\n" +
  "نِکونیموس متن‌بازه. معرفی، معماری و سورس پروژه:\n" +
  `${PROJECT_INTRO_URL}\n\n` +
  "آمار کلی و تجمیعی: تنظیمات → 📊 آمار";

export const UnsupportedMessageTypeMessage =
  "این نوع پیام فعلاً پشتیبانی نمی‌شه.\n\n" +
  "متن یا یکی از فرمت‌های پشتیبانی‌شده رو بفرست.";

export const inboxFreshNoticeMessage = (unreadCount: number): string => {
  const count = convertToPersianNumbers(Math.max(0, Math.floor(unreadCount)));

  return `میو، یه پیام ناشناس تازه رسید 🐾\n\nالان ${count} پیام تازه منتظرته.`;
};

export const INBOX_EMPTY_MESSAGE =
  "میووو...\n\nفعلاً پیام تازه‌ای توی صندوقت نیست.";

export const INBOX_DELIVERY_REQUESTED_MESSAGE =
  "پیام‌های تازه رو میارم همین‌جا 🐾";

export const EXPIRED_TICKET_MESSAGE =
  "این پیام منقضی شده و دیگه در دسترس نیست.";

export const YOUR_MESSAGE_SEEN_MESSAGE = "گیرنده پیامت رو دید.";

export const RATE_LIMIT_MESSAGE =
  "یه کم آروم‌تر 😼\n\nچند ثانیه دیگه دوباره امتحان کن.";

export const RATE_LIMIT_CALLBACK_ALERT =
  "چند ثانیه صبر کن و دوباره امتحان کن.";

export const INBOX_FULL_MESSAGE =
  "صندوق پیام‌های این کاربر فعلاً پره.\n\nبعداً دوباره امتحان کن.";

export const SELF_MESSAGE_DISABLE_MESSAGE =
  "نمی‌تونی از لینک خودت برای خودت پیام ناشناس بفرستی.\n\n" +
  "برای ارسال پیام، لینک یک نفر دیگه رو باز کن.";

export const REPORT_SUBMITTED_MESSAGE = "گزارشت ثبت شد.";

export const UNKNOWN_COMMAND_MESSAGE =
  "میو؟\n\nاین یکی رو نفهمیدم.\nاز دکمه‌های پایین استفاده کن.";

export const INPUT_CANCELLED_MESSAGE =
  "لغو شد.\n\nبرگشتی به منوی اصلی.";

export const EXPIRED_CALLBACK_MESSAGE =
  "این دکمه دیگه کار نمی‌کنه.\n\nاز منوی اصلی دوباره شروع کن.";
