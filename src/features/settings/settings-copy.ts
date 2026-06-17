/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */

export const SETTINGS_HOME_MESSAGE = `<b>تنظیمات</b>

نام نمایشی: <b>USER_NAME</b>
<i>این نام برای کسانی نمایش داده می‌شود که از لینک شما پیام می‌فرستند. این نام، username تلگرام شما نیست.</i>

وضعیت دریافت پیام: <b>PAUSE_STATUS</b>

<b>گزینه‌ها</b>
• <b>✏️ نام</b> — تغییر نام نمایشی
• <b>PAUSE_ACTION_LABEL</b> — PAUSE_ACTION_DESC
• <b>🔓 آنبلاک</b> — باز کردن همه فرستنده‌های مسدودشده
• <b>🔄 ریست مچ</b> — پاک کردن درخواست‌ها و بلاک‌های مچ‌یابی برای دیدن دوباره همان افراد
• <b>🛡️ درباره</b> — پیام ناشناس، ارزیابی، مچ‌یابی و حریم خصوصی
• <b>📐 فنی</b> — توضیح کوتاه درباره معماری Worker، D1، Durable Object، KV و مچ‌یابی
• <b>🗑️ پاک کردن حساب</b> — حذف لینک، صندوق، بلاک‌ها، نام‌های خصوصی و پروفایل ارزیابی
• <b>↩️ لغو</b> — لغو ارسال، پاسخ یا نام‌گذاری ناتمام
• <b>🏠 بازگشت</b> — بازگشت به منوی اصلی`;

export const SETTINGS_EDIT_NAME_MESSAGE = `<b>تغییر نام نمایشی</b>

یک نام کوتاه بفرستید.
این نام در صفحه ارسال پیام نمایش داده می‌شود و <b>username تلگرام شما نیست</b>.

برای انصراف: <b>↩️ لغو</b> یا <b>❌ انصراف</b>
برای بازگشت: <b>🏠 بازگشت</b>`;

export const SETTINGS_NAME_SAVED_MESSAGE = `<b>نام نمایشی ذخیره شد:</b> <b>NAME</b>

از این به بعد فرستندگان این نام را می‌بینند.`;

export const SETTINGS_NAME_INVALID_MESSAGE = `این نام قابل قبول نیست.

لطفاً یک متن کوتاه بفرستید؛ بدون خط خالی و بدون Enter.`;

export const SETTINGS_NAME_TEXT_ONLY_MESSAGE = `برای نام نمایشی فقط <b>متن</b> قابل قبول است.

عکس، فایل، پیام صوتی یا استیکر پشتیبانی نمی‌شود.`;

export const SETTINGS_CANCEL_DRAFT_MESSAGE = `<b>عملیات ناتمام لغو شد</b>

اگر در حال انجام یکی از این کارها بودید، همان فرایند بسته شد:
• ارسال پیام ناشناس
• پاسخ به پیام
• تعیین نام خصوصی

داده‌ای حذف نشد؛ فقط حالت نیمه‌کاره بسته شد.`;

export const SETTINGS_CLEAR_DATA_WARNING_MESSAGE = `<b>هشدار: پاک کردن حساب</b>

این عملیات قابل بازگشت نیست. موارد زیر حذف یا بازنشانی می‌شوند:
• لینک فعلی
• پیام‌های در انتظار در صندوق ورودی
• فهرست مسدودها و نام‌های خصوصی
• پروفایل ارزیابی و وضعیت مچ‌یابی

بعد از تأیید، یک <b>لینک جدید</b> دریافت می‌کنید و لینک قبلی غیرفعال می‌شود.

برای ادامه، دکمه تأیید را بزنید.`;

export const SETTINGS_CLEAR_DATA_DONE_MESSAGE = `<b>حساب بازنشانی شد</b>

لینک جدید شما:
<code>UUID_USER_URL</code>

لینک قبلی دیگر فعال نیست. از این به بعد همین لینک جدید را به اشتراک بگذارید.`;

export const SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE = `عملیات لغو شد.

هیچ داده‌ای حذف نشد.`;

export const SETTINGS_BLOCK_LIST_EMPTY_MESSAGE = `فهرست مسدودها خالی است.

در حال حاضر هیچ فرستنده‌ای را مسدود نکرده‌اید.`;

export const SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE = `<b>باز کردن همه مسدودها</b>

در حال حاضر <b>COUNT</b> کاربر مسدود شده‌اند.
اگر تأیید کنید، همه آن‌ها دوباره می‌توانند از لینک شما پیام بفرستند.

لینک و نام‌های خصوصی بدون تغییر باقی می‌مانند.`;

export const SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE = `<b>همه مسدودها باز شدند</b>

فرستنده‌های قبلاً مسدودشده دوباره می‌توانند پیام بفرستند.`;

export const SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE = `عملیات لغو شد.

فهرست مسدودها بدون تغییر باقی ماند.`;

export const SETTINGS_RESET_MATCH_EMPTY_MESSAGE = `تاریخچه مچ‌یابی خالی است.

درخواست، بلاک یا پیشنهاد مچی برای پاک کردن وجود ندارد.`;

export const SETTINGS_RESET_MATCH_WARNING_MESSAGE = `<b>ریست تاریخچه مچ‌یابی</b>

در حال حاضر <b>REQUEST_COUNT</b> درخواست مچ و <b>BLOCK_COUNT</b> بلاک مچ‌یابی ثبت شده است.

اگر تأیید کنید، این تاریخچه پاک می‌شود و ممکن است دوباره همان افراد را در جست‌وجو ببینید.

پروفایل ارزیابی، وضعیت فعال بودن مچ‌یابی و پیام‌های ناشناس شما بدون تغییر می‌مانند.`;

export const SETTINGS_RESET_MATCH_DONE_MESSAGE = `<b>تاریخچه مچ‌یابی پاک شد</b>

DETAIL_LINES

حالا می‌توانید دوباره از مسیر مچ‌یابی → «🔎 پیدا کردن مچ» استفاده کنید.`;

export const SETTINGS_RESET_MATCH_CANCELLED_MESSAGE = `عملیات لغو شد.

تاریخچه مچ‌یابی بدون تغییر باقی ماند.`;

export const SETTINGS_PAUSE_ON_MESSAGE = `<b>دریافت پیام غیرفعال شد</b>

لینک شما هنوز وجود دارد، اما تا وقتی دوباره فعالش نکنید پیام جدیدی دریافت نمی‌کنید.

پیام‌های قبلی همچنان از /inbox قابل مشاهده‌اند.`;

export const SETTINGS_RESUME_MESSAGE = `<b>دریافت پیام فعال شد</b>

لینک شما دوباره آماده دریافت پیام‌های ناشناس است.`;

export const TECHNICAL_ABOUT_MESSAGE = `<b>📐 معماری فنی نِکونیموس</b>

این یک خلاصه قابل خواندن از معماری ربات است؛ نه مستند کامل کد.

<b>تصویر کلی</b>
Telegram / Browser → Cloudflare Worker → Grammy handlers → D1 + UserStateDO → Queue/Outbox → Telegram

<b>سطح‌های محصول</b>
• پیام ناشناس با لینک شخصی، صندوق ورودی، پاسخ، مسدودسازی، گزارش و نام خصوصی
• ارزیابی سبک گفت‌وگو برای شناخت مرزها، عمق گفت‌وگو، انرژی اجتماعی و ترجیح‌های ارتباطی
• مچ‌یابی ناشناس opt-in بر اساس پروفایل کنترل‌شده ارزیابی

<b>storage و مسئولیت‌ها</b>
• D1: کاربران، لینک‌ها، خلاصه گفت‌وگوها، گزارش‌ها، ارزیابی‌ها، پروفایل‌ها و درخواست‌های مچ
• UserState Durable Object: draft، pause، block، نام خصوصی، inbox، session ارزیابی و rate limit
• KV: فقط cache مسیر‌یابی مثل tg:{hash} و link:{slug}
• Queue + TelegramOutboxDO: ارسال‌های غیرحیاتی Telegram به شکل idempotent
• Workers AI + Vectorize: embedding پروفایل کنترل‌شده و کشف اولیه candidateها

<b>رمزنگاری</b>
• Telegram ID خام در D1 ذخیره نمی‌شود؛ برای lookup از HMAC استفاده می‌شود.
• chat id، متن پیام، metadata لازم برای پاسخ، نام‌های خصوصی و intro مچ‌یابی رمزنگاری می‌شوند.
• بعد از /inbox، متن پیام از storage پاک می‌شود و فقط metadata رمزنگاری‌شده لازم برای callbackها باقی می‌ماند.

<b>مرز حریم خصوصی</b>
نِکونیموس hosted anonymous relay است، نه پیام‌رسان end-to-end encrypted.
Telegram پیام‌های ربات را دریافت می‌کند و Worker هنگام پردازش، plaintext را می‌بیند.

مچ‌یابی هم تضمین سازگاری نیست. Vectorize فقط candidateها را محدود می‌کند؛ رتبه‌بندی با scoring انجام می‌شود و شروع گفت‌وگو فقط با پذیرش طرف مقابل ممکن است.

<b>محدودیت‌ها</b>
rate limit کوتاه · inbox محدود · KV فقط cache · ارزیابی تشخیص پزشکی نیست · callbackهای خیلی قدیمی ممکن است منقضی شوند.`;

export const SETTINGS_BACK_MESSAGE = `<b>بازگشت به منوی اصلی</b>

از دکمه‌های پایین می‌توانید لینک خود را ببینید، وارد مچ‌یابی شوید یا دوباره تنظیمات را باز کنید.`;
