/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */

import { DISPLAY_NAME_UNSET } from "./defaults";

export const SETTINGS_NAME_UNSET = DISPLAY_NAME_UNSET;

export const SETTINGS_HOME_MESSAGE = `<b>تنظیمات</b>

اینجا می‌توانی دریافت پیام‌ها، نام نمایشی، مسدودی‌ها، پیشنهادهای گفت‌وگو و حساب خودت را مدیریت کنی.

نام نمایشی: <b>USER_NAME</b>
<i>این نام برای کسانی نمایش داده می‌شود که از لینک تو پیام می‌فرستند. این نام، نام کاربری تلگرام تو نیست.</i>

وضعیت دریافت پیام: <b>PAUSE_STATUS</b>

<b>گزینه‌ها</b>
• <b>✏️ نام</b> — تغییر نام نمایشی
• <b>PAUSE_ACTION_LABEL</b> — PAUSE_ACTION_DESC
• <b>🚫 رفع مسدودی‌ها</b> — باز کردن همه فرستنده‌های مسدودشده
• <b>♻️ بازنشانی پیشنهادها</b> — پاک کردن درخواست‌ها و بلاک‌های پیشنهاد گفت‌وگو
• <b>ℹ️ درباره و حریم خصوصی</b> — پیام ناشناس، ارزیابی و پیشنهاد گفت‌وگو
• <b>🧾 نکات فنی</b> — توضیح کوتاه درباره معماری Worker، D1، Durable Object و KV
• <b>🗑️ پاک کردن حساب</b> — حذف لینک، صندوق، بلاک‌ها، نام‌های خصوصی و پروفایل ارزیابی
• <b>↩️ لغو</b> — لغو ارسال، پاسخ یا نام‌گذاری ناتمام
• <b>🏠 منوی اصلی</b> — بازگشت به منوی اصلی`;

export const SETTINGS_PAUSE_ACTIVE = "فعال";
export const SETTINGS_PAUSE_INACTIVE = "غیرفعال";
export const SETTINGS_PAUSE_ENABLE_DESC = "فعال‌سازی دریافت پیام‌های جدید";
export const SETTINGS_PAUSE_DISABLE_DESC = "توقف دریافت پیام‌های جدید";

export const SETTINGS_EDIT_NAME_MESSAGE = `<b>تغییر نام نمایشی</b>

یک نام کوتاه بفرست.
این نام در صفحه ارسال پیام نمایش داده می‌شود و <b>نام کاربری تلگرام تو نیست</b>.

برای انصراف: <b>↩️ لغو</b> یا <b>↩️ انصراف</b>
برای بازگشت: <b>🏠 منوی اصلی</b>`;

export const SETTINGS_NAME_SAVED_MESSAGE = `<b>نام نمایشی ذخیره شد:</b> <b>NAME</b>

از این به بعد فرستندگان این نام را می‌بینند.`;

export const SETTINGS_NAME_INVALID_MESSAGE = `این نام قابل قبول نیست.

لطفاً یک متن کوتاه بفرست؛ بدون خط خالی و بدون Enter.`;

export const SETTINGS_NAME_TEXT_ONLY_MESSAGE = `برای نام نمایشی فقط <b>متن</b> قابل قبول است.

عکس، فایل، پیام صوتی یا استیکر پشتیبانی نمی‌شود.`;

export const SETTINGS_CANCEL_DRAFT_MESSAGE = `<b>عملیات ناتمام لغو شد</b>

اگر در حال انجام یکی از این کارها بودی، همان فرایند بسته شد:
• ارسال پیام ناشناس
• پاسخ به پیام
• تعیین نام خصوصی

داده‌ای حذف نشد؛ فقط حالت نیمه‌کاره بسته شد.`;

export const SETTINGS_CLEAR_DATA_WARNING_MESSAGE = `<b>پاک کردن حساب</b>

با پاک کردن حساب، لینک فعلی، پیام‌های در انتظار، ارزیابی، پیشنهادهای گفت‌وگو و داده‌های مرتبط با حساب حذف می‌شوند.

بعد از پاک‌سازی، یک شناسه‌ی داخلی و لینک جدید برایت ساخته می‌شود.

<b>این کار قابل برگشت نیست.</b>

برای ادامه، دکمه تأیید را بزن.`;

export const SETTINGS_CLEAR_DATA_DONE_MESSAGE = `حساب پاک شد و لینک جدید برایت ساخته شد.

<code>UUID_USER_URL</code>

لینک قبلی دیگر فعال نیست. از این به بعد همین لینک جدید را به اشتراک بگذار.`;

export const SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE = `عملیات لغو شد.

هیچ داده‌ای حذف نشد.`;

export const SETTINGS_BLOCK_LIST_EMPTY_MESSAGE = `فهرست مسدودها خالی است.

در حال حاضر هیچ فرستنده‌ای را مسدود نکرده‌ای.`;

export const SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE = `<b>رفع همه مسدودی‌ها</b>

در حال حاضر <b>COUNT</b> کاربر مسدود شده‌اند.
اگر تأیید کنی، همه آن‌ها دوباره می‌توانند از لینک تو پیام بفرستند.

لینک و نام‌های خصوصی بدون تغییر باقی می‌مانند.`;

export const SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE = `<b>همه مسدودی‌ها رفع شدند</b>

فرستنده‌های قبلاً مسدودشده دوباره می‌توانند پیام بفرستند.`;

export const SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE = `عملیات لغو شد.

فهرست مسدودها بدون تغییر باقی ماند.`;

export const SETTINGS_RESET_MATCH_EMPTY_MESSAGE = `تاریخچه پیشنهاد گفت‌وگو خالی است.

درخواست، بلاک یا پیشنهادی برای پاک کردن وجود ندارد.`;

export const SETTINGS_RESET_MATCH_WARNING_MESSAGE = `<b>بازنشانی پیشنهادهای گفت‌وگو</b>

در حال حاضر <b>REQUEST_COUNT</b> درخواست گفت‌وگو و <b>BLOCK_COUNT</b> بلاک پیشنهاد گفت‌وگو ثبت شده است.

اگر تأیید کنی، این تاریخچه پاک می‌شود و ممکن است دوباره همان افراد را در جست‌وجو ببینی.

پروفایل ارزیابی، وضعیت نمایش در پیشنهادها و پیام‌های ناشناس تو بدون تغییر می‌مانند.`;

export const SETTINGS_RESET_MATCH_DONE_MESSAGE = `<b>تاریخچه پیشنهاد گفت‌وگو پاک شد</b>

DETAIL_LINES

حالا می‌توانی دوباره از مسیر پیشنهاد گفت‌وگو → «🔎 پیدا کردن گزینه‌ها» استفاده کنی.`;

export const SETTINGS_RESET_MATCH_CANCELLED_MESSAGE = `عملیات لغو شد.

تاریخچه پیشنهاد گفت‌وگو بدون تغییر باقی ماند.`;

export const SETTINGS_PAUSE_ON_MESSAGE = `<b>دریافت پیام متوقف شد</b>

لینک تو هنوز وجود دارد، اما تا وقتی دوباره فعالش نکنی پیام جدیدی دریافت نمی‌کنی.

پیام‌های قبلی همچنان از صندوق پیام‌ها قابل مشاهده‌اند.`;

export const SETTINGS_RESUME_MESSAGE = `<b>دریافت پیام فعال شد</b>

لینک تو دوباره آماده دریافت پیام‌های ناشناس است.`;

export const TECHNICAL_ABOUT_MESSAGE = `<b>🧾 نکات فنی نِکونیموس</b>

این یک خلاصه قابل خواندن از معماری ربات است؛ نه مستند کامل کد.

<b>تصویر کلی</b>
Telegram → Cloudflare Worker → Grammy handlers → D1 + UserStateDO → Queue/Outbox → Telegram

<b>سطح‌های محصول</b>
• پیام ناشناس با لینک شخصی، صندوق پیام‌ها، پاسخ، مسدودسازی، گزارش و نام خصوصی
• ارزیابی سبک گفت‌وگو برای شناخت مرزها، عمق گفت‌وگو، انرژی اجتماعی و ترجیح‌های ارتباطی
• پیشنهاد گفت‌وگوی اختیاری بر اساس پروفایل کنترل‌شده ارزیابی

<b>storage و مسئولیت‌ها</b>
• D1: کاربران، لینک‌ها، گزارش‌ها، ارزیابی‌ها، پروفایل‌ها و درخواست‌های گفت‌وگو
• UserState Durable Object: draft، pause، block، نام خصوصی، inbox، session ارزیابی و rate limit
• KV: فقط cache مسیر‌یابی مثل tg:{hash} و link:{slug}
• Queue + TelegramOutboxDO: ارسال‌های غیرحیاتی Telegram به شکل idempotent
• Workers AI + Vectorize: embedding پروفایل کنترل‌شده و کشف اولیه گزینه‌ها

<b>رمزنگاری</b>
• Telegram ID خام در D1 ذخیره نمی‌شود؛ برای lookup از HMAC استفاده می‌شود.
• chat id، متن پیام، metadata لازم برای پاسخ، نام‌های خصوصی و پیام شروع گفت‌وگو رمزنگاری می‌شوند.
• بعد از تحویل در صندوق پیام‌ها، متن پیام از storage پاک می‌شود و فقط metadata رمزنگاری‌شده لازم برای callbackها باقی می‌ماند.

<b>مرز حریم خصوصی</b>
نِکونیموس یک hosted anonymous relay است، نه پیام‌رسان رمزنگاری‌شده‌ی سرتاسری.
پیام‌ها از طریق تلگرام و سرور ربات پردازش می‌شوند. نِکونیموس ادعای ناشناسی کامل یا رمزنگاری سرتاسری ندارد.

پیشنهاد گفت‌وگو هم تضمین سازگاری نیست. Vectorize فقط گزینه‌ها را محدود می‌کند؛ رتبه‌بندی با scoring انجام می‌شود و شروع گفت‌وگو فقط با پذیرش طرف مقابل ممکن است.

<b>محدودیت‌ها</b>
rate limit کوتاه · inbox محدود · KV فقط cache · ارزیابی تشخیص روان‌شناختی نیست · callbackهای خیلی قدیمی ممکن است منقضی شوند.`;

export const SETTINGS_BACK_MESSAGE = `<b>بازگشت به منوی اصلی</b>

از دکمه‌های پایین می‌توانی لینک خود را ببینی، وارد پیشنهاد گفت‌وگو شوی یا دوباره تنظیمات را باز کنی.`;

export const SETTINGS_RESET_MATCH_REQUESTS_CLEARED =
  "— COUNT درخواست گفت‌وگو حذف شد";
export const SETTINGS_RESET_MATCH_BLOCKS_CLEARED =
  "— COUNT بلاک پیشنهاد گفت‌وگو حذف شد";
