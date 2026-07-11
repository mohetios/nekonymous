/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */

import { convertToPersianNumbers } from "../utils/tools";

export const WelcomeMessage = `میو، رسیدی 🐾

من نِکونیموسم؛
گربه‌ی نارنجی پیام‌های ناشناس.

اینم لینک پیام ناشناس تو:
<code>UUID_USER_URL</code>

هرکی بازش کنه، می‌تونه برات پیام ناشناس بفرسته.

من پیام‌ها رو میارم همین‌جا.
جواب بدی یا نه، با خودته.`;

export const USER_LINK_MESSAGE = `میو، اینم لینک پیام ناشناست:

<code>UUID_USER_URL</code>

هرکی بازش کنه، می‌تونه برات پیام ناشناس بفرسته.`;

const DRAFT_KEYBOARD_HINT = `برای لغو، دکمه‌ی <b>↩️ لغو</b> پایین رو بزن.`;

export const StartConversationMessage = `داری برای <b>USER_NAME</b> پیام ناشناس می‌فرستی.

هرچی می‌خوای بنویس.

من همون رو می‌رسونم.

مشخصات تلگرامت برای طرف مقابل نمایش داده نمی‌شه.

${DRAFT_KEYBOARD_HINT}`;

export const HuhMessage = `فعلاً نتونستم این کار رو انجام بدم.

چند دقیقه بعد دوباره امتحان کن.`;

export const NoUserFoundMessage = `این لینک فعال نیست.

ممکنه اشتباه کپی شده باشه، منقضی شده باشه یا صاحب لینک حسابش رو پاک کرده باشه.

لینک تازه رو از خودش بگیر.`;

export const NoConversationFoundMessage = `این مسیر دیگه در دسترس نیست.

از صندوق پیام‌ها یا منوی اصلی دوباره شروع کن.`;

export const MESSAGE_SENT_MESSAGE = `پیامت رو فرستادم 🐾`;

export const REPLY_SENT_MESSAGE = `جوابت رو فرستادم 🐾`;

export const USER_BLOCKED_MESSAGE = `این فرستنده مسدود شد.

دیگه نمی‌تونه از همین مسیر برات پیام بفرسته.`;

export const USER_UNBLOCKED_MESSAGE = `مسدودیش برداشته شد.

حالا دوباره می‌تونه برات پیام بفرسته.`;

export const REPLY_TO_MESSAGE = `<b>پاسخ ناشناس</b>

جوابت رو بنویس.

من همون رو ناشناس می‌رسونم.
نام کاربری تلگرامت برای طرف مقابل نمایش داده نمی‌شه.

${DRAFT_KEYBOARD_HINT}`;

export const REPLY_TO_NICKNAME_MESSAGE = `<b>پاسخ به NICKNAME</b>

جوابت رو بنویس.

من همون رو ناشناس می‌رسونم.
این نام خصوصی فقط برای خودت نمایش داده می‌شه.

${DRAFT_KEYBOARD_HINT}`;

export const NICKNAME_PROMPT_MESSAGE = `برای این فرستنده یه نام خصوصی بنویس.

این نام فقط برای خودت نمایش داده می‌شه.
فرستنده نمی‌بینتش.

نام فعلی: <b>CURRENT_NICK</b>

برای حذفش، بنویس <code>حذف</code>.

${DRAFT_KEYBOARD_HINT}`;

export const NICKNAME_SAVED_MESSAGE = `نام خصوصیش شد: <b>NAME</b>`;

export const NICKNAME_REMOVED_MESSAGE = `نام خصوصی حذف شد.

این فرستنده دوباره بدون نام خصوصی نمایش داده می‌شه.`;

export const NICKNAME_LIMIT_MESSAGE = `دیگه نمی‌تونی نام خصوصی تازه‌ای اضافه کنی.

اول یکی از نام‌های قبلی رو پاک کن.`;

export const NICKNAME_TEXT_ONLY_MESSAGE = `نام خصوصی باید متنی باشه.

عکس، فایل، صدا یا استیکر اینجا کار نمی‌کنه.`;

export const RECIPIENT_PAUSED_MESSAGE = `<b>USER_NAME</b> فعلاً پیام ناشناس دریافت نمی‌کنه.

بعداً می‌تونی از همین لینک دوباره امتحان کنی.`;

export const OWNER_PAUSED_NOTE = `<b>دریافت پیام متوقفه.</b>

لینک تو هنوز وجود داره، اما پیام تازه‌ای دریافت نمی‌کنی.
برای فعال‌سازی دوباره: تنظیمات → <b>▶️ فعال‌سازی دریافت پیام</b>`;

export const USER_IS_BLOCKED_MESSAGE = `امکان ارسال پیام نیست.

صاحب این لینک دریافت پیام از این مسیر رو مسدود کرده.`;

export const ABOUT_PRIVACY_COMMAND_MESSAGE = `<b>درباره و حریم خصوصی</b>

نِکونیموس یک ربات پیام ناشناس روی تلگرامه.

<b>مرزهای حریم خصوصی</b>
در جریان معمول بات، مشخصات تلگرامی فرستنده و گیرنده به هم نمایش داده نمی‌شه.

اما پیام‌ها از تلگرام و زیرساخت نِکونیموس عبور می‌کنن؛
تلگرام و سرور بات هنگام پردازش، متن پیام رو می‌بینن.

نِکونیموس پیام‌رسان رمزنگاری سرتاسری نیست و ناشناسی کامل رو تضمین نمی‌کنه.

داده‌های حساس ذخیره‌شده، در بخش‌هایی که پیاده‌سازی شده، به‌صورت رمزنگاری‌شده نگهداری می‌شن.

<b>پیام ناشناس</b>
تو یک لینک پیام ناشناس می‌گیری. دیگران از همون لینک پیام می‌فرستن و تو پیام‌ها رو از <b>صندوق پیام‌ها</b> می‌خونی.

بعد از نمایش موفق یک پیام در صندوق، متن کاملش از فضای ذخیره‌سازی بات پاک می‌شه.
اطلاعات لازم برای پاسخ، مسدودسازی، نام خصوصی یا گزارش ممکنه تا زمان انقضای پیام باقی بمونه.

<b>ارزیابی سبک گفت‌وگو</b>
ارزیابی به فهمیدن سبک گفت‌وگوی تو کمک می‌کنه؛ برچسب شخصیتی یا تشخیص روان‌شناختی نیست.
نتیجه‌اش رو نباید حقیقت قطعی درباره‌ی شخصیتت در نظر بگیری.

<b>پیشنهاد گفت‌وگو</b>
به‌صورت پیش‌فرض خاموشه. اگر <b>نمایش در پیشنهادها</b> رو فعال کنی، یک نسخه‌ی کنترل‌شده از پروفایل گفت‌وگو برای ساخت پیشنهادهای ناشناس استفاده می‌شه.
گفت‌وگو فقط وقتی شروع می‌شه که طرف مقابل درخواست رو بپذیره.

<i>برای آمار کلی و تجمیعی پلتفرم: تنظیمات → 📊 آمار</i>`;

export const UnsupportedMessageTypeMessage = `فعلاً این نوع پیام پشتیبانی نمی‌شه.

متن یا یکی از فرمت‌هایی رو بفرست که اینجا کار می‌کنه.`;

export const UNREAD_INBOX_MESSAGE = (pendingCount: number): string => {
  const count = convertToPersianNumbers(Math.max(1, pendingCount));
  if (pendingCount <= 1) {
    return "میو، یه پیام ناشناس تازه داری 🐾";
  }
  return `میو، ${count} پیام ناشناس تازه داری 🐾`;
};

export const EXPIRED_TICKET_MESSAGE = `این پیام منقضی شده و دیگه در دسترس نیست.`;

export const EMPTY_INBOX_MESSAGE = `میووو...

هنوز پیام تازه‌ای نداری.

اگه خواستی، لینک پیام ناشناست رو دوباره بفرست.`;

export const INBOX_HAS_MORE_MESSAGE = `چند پیام دیگه هم توی صندوقته.`;

export const YOUR_MESSAGE_SEEN_MESSAGE = `گیرنده پیام تو رو دید.`;

export const RATE_LIMIT_MESSAGE = `یه کم آروم‌تر 😼

چند ثانیه دیگه دوباره امتحان کن.`;

export const RATE_LIMIT_CALLBACK_ALERT = "چند ثانیه صبر کن و دوباره امتحان کن.";

export const INBOX_FULL_MESSAGE = `صندوق پیام‌های این کاربر فعلاً پره.

بعداً دوباره امتحان کن.`;

export const SELF_MESSAGE_DISABLE_MESSAGE = `نمی‌تونی از لینک خودت برای خودت پیام ناشناس بفرستی.

برای ارسال پیام، لینک یک نفر دیگه رو باز کن.`;

export const REPORT_SUBMITTED_MESSAGE = `گزارشت ثبت شد.`;

export const UNKNOWN_COMMAND_MESSAGE = `میو؟

این یکی رو نفهمیدم.
از دکمه‌های پایین استفاده کن.`;

export const INPUT_CANCELLED_MESSAGE = `لغو شد.

برگشتی به منوی اصلی.`;

export const EXPIRED_CALLBACK_MESSAGE = `این دکمه دیگه کار نمی‌کنه.

از منوی اصلی دوباره شروع کن.`;
