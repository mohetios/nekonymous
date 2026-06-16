/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */
export const SETTINGS_HOME_MESSAGE = `<b>تنظیمات</b>

نام نمایشی: <b>USER_NAME</b>
<i>نام نمایشی برای فرستندگانی که از لینک شما پیام می‌دهند. این نام، نام کاربری تلگرام شما نیست.</i>

وضعیت دریافت پیام: <b>PAUSE_STATUS</b>

<b>راهنمای دکمه‌ها</b>
— <b>✏️ نام نمایشی</b> · تغییر نام نمایشی
— <b>PAUSE_ACTION_LABEL</b> · PAUSE_ACTION_DESC
— <b>🔓 حذف بلاک‌ها</b> · آنبلاک کردن همه (نیاز به تأیید)
— <b>🛡️ درباره و حریم خصوصی</b> · پیام ناشناس، تست، مچ‌یابی و حریم خصوصی
— <b>📐 معماری فنی</b> · توضیح کوتاه درباره Worker، D1، Durable Object، KV و مچ‌یابی
— <b>🗑️ پاک کردن حساب</b> · حذف لینک، صندوق، بلاک‌ها، نام‌های مستعار و پروفایل تست
— <b>↩️ لغو پیام ناتمام</b> · لغو ارسال، پاسخ یا نام‌گذاری ناتمام
— <b>🏠 بازگشت</b> · بازگشت به منوی اصلی`;

export const SETTINGS_EDIT_NAME_MESSAGE = `<b>تغییر نام نمایشی</b>

یک نام کوتاه ارسال کنید.
این نام در لینک ناشناس نمایش داده می‌شود و <b>نام کاربری تلگرام شما نیست</b>.

انصراف: <b>↩️ لغو</b> یا <b>❌ انصراف</b> · بازگشت: <b>🏠 بازگشت</b>`;

export const SETTINGS_NAME_SAVED_MESSAGE = `<b>نام نمایشی ذخیره شد:</b> <b>NAME</b>

فرستندگان از این پس این نام را مشاهده می‌کنند.`;

export const SETTINGS_NAME_INVALID_MESSAGE = `نام واردشده قابل قبول نیست.

لطفاً یک متن کوتاه بدون خط خالی و بدون Enter ارسال کنید.`;

export const SETTINGS_NAME_TEXT_ONLY_MESSAGE = `برای نام نمایشی فقط <b>متن</b> قابل قبول است.

ارسال عکس و پیام صوتی پشتیبانی نمی‌شود.`;

export const SETTINGS_CANCEL_DRAFT_MESSAGE = `<b>عملیات ناتمام لغو شد</b>

در صورت انجام یکی از موارد زیر، فرایند متوقف شد:
— ارسال پیام ناشناس
— پاسخ به پیام
— تعیین نام مستعار

داده‌ای حذف نشد؛ فقط حالت نیمه‌کاره بسته شد.`;

export const SETTINGS_CLEAR_DATA_WARNING_MESSAGE = `<b>هشدار: پاک کردن حساب</b>

این عملیات برگشت‌پذیر نیست. موارد زیر حذف می‌شوند:
— لینک فعلی
— پیام‌های در انتظار در صندوق ورودی
— فهرست بلاک و نام‌های مستعار
— پروفایل تست و وضعیت مچ‌یابی

پس از تأیید، یک <b>لینک جدید</b> دریافت می‌کنید.

برای تأیید، دکمهٔ پایین را بزنید.`;

export const SETTINGS_CLEAR_DATA_DONE_MESSAGE = `<b>حساب بازنشانی شد</b>

لینک جدید:
<code>UUID_USER_URL</code>

لینک قبلی غیرفعال است. لینک جدید را به اشتراک بگذارید.`;

export const SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE = `عملیات لغو شد.

هیچ داده‌ای حذف نشد.`;

export const SETTINGS_BLOCK_LIST_EMPTY_MESSAGE = `فهرست بلاک خالی است.

کاربر بلاک‌شده‌ای وجود ندارد.`;

export const SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE = `<b>حذف همهٔ بلاک‌ها</b>

در حال حاضر <b>COUNT</b> کاربر بلاک شده‌اند.
پس از تأیید، همه می‌توانند دوباره از لینک شما پیام ارسال کنند.

لینک و نام‌های مستعار بدون تغییر باقی می‌مانند.`;

export const SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE = `<b>همه کاربران آنبلاک شدند</b>

کاربران بلاک‌شده می‌توانند دوباره پیام ارسال کنند.`;

export const SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE = `عملیات لغو شد.

فهرست بلاک بدون تغییر باقی ماند.`;

export const SETTINGS_PAUSE_ON_MESSAGE = `<b>دریافت پیام غیرفعال شد</b>

لینک شما فعال است، اما تا زمان فعال‌سازی مجدد پیام جدیدی دریافت نمی‌شود.
پیام‌های قبلی همچنان از طریق /inbox قابل مشاهده هستند.`;

export const SETTINGS_RESUME_MESSAGE = `<b>دریافت پیام فعال شد</b>

لینک شما دوباره آماده دریافت پیام‌های ناشناس است.`;

export const TECHNICAL_ABOUT_MESSAGE = `<b>📐 معماری فنی نِکونیموس</b>

<i>خلاصهٔ قابل خواندن؛ جزئیات کامل‌تر در وب‌سایت.</i>

<b>تصویر کلی</b>
Telegram / Browser → Cloudflare Worker → Grammy handlers → D1 + UserStateDO → Queue/Outbox → Telegram.

<b>سطح‌های محصول</b>
• پیام ناشناس با لینک شخصی، inbox، پاسخ، block، report و nickname.
• تست سبک گفت‌وگو برای شناخت مرزها، عمق، انرژی اجتماعی و ترجیح‌های ارتباطی.
• مچ‌یابی ناشناس opt-in بر اساس پروفایل کنترل‌شده تست.

<b>storage و مسئولیت‌ها</b>
• D1: کاربران، لینک‌ها، خلاصه گفتگوها، reportها، تست‌ها، پروفایل‌ها و match requestها.
• UserState Durable Object: draft، pause، block، nickname، inbox، session تست و rate limit.
• KV: فقط cache مسیر‌یابی مثل tg:{hash} و link:{slug}.
• Queue + TelegramOutboxDO: ارسال‌های غیرحیاتی Telegram به شکل idempotent.
• Workers AI + Vectorize: embedding پروفایل کنترل‌شده و کشف اولیه candidateها.

<b>رمزنگاری</b>
• Telegram ID خام در D1 ذخیره نمی‌شود؛ hash با HMAC ساخته می‌شود.
• chat id، payload پیام، connection metadata، nickname و intro مچ‌یابی رمزنگاری می‌شوند.
• بعد از /inbox، payload پیام از storage پاک می‌شود و فقط metadata رمزنگاری‌شده لازم برای callbackها می‌ماند.

<b>مرز حریم خصوصی</b>
نِکونیموس hosted anonymous relay است، نه end-to-end encryption.
Telegram پیام‌های bot را دریافت می‌کند و Worker هنگام پردازش plaintext را می‌بیند.
مچ‌یابی هم تضمین سازگاری نیست؛ Vectorize فقط candidateها را محدود می‌کند و تصمیم نهایی با scoring و پذیرش دوطرفه جلو می‌رود.

<b>محدودیت‌ها</b>
rate limit کوتاه · inbox محدود · KV فقط cache · test تشخیص پزشکی نیست · callbackهای خیلی قدیمی ممکن است منقضی شوند.

WEB_LINK_LINE`;

export const SETTINGS_BACK_MESSAGE = `<b>بازگشت به منوی اصلی</b>

دکمه‌های پایین: لینک من · مچ‌یابی · تنظیمات`;
