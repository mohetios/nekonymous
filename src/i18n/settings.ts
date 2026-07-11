/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */

import { DISPLAY_NAME_UNSET } from "./defaults";

export const SETTINGS_NAME_UNSET = DISPLAY_NAME_UNSET;

export const SETTINGS_HOME_MESSAGE = `<b>تنظیمات</b>

نام نمایشی: <b>USER_NAME</b>
دریافت پیام: <b>PAUSE_STATUS</b>

از اینجا می‌تونی دریافت پیام، نام نمایشی، پیشنهادهای گفت‌وگو و حریم خصوصی حسابت رو مدیریت کنی.`;

export const SETTINGS_INBOX_STATUS_PAUSED = "متوقف";
export const SETTINGS_INBOX_STATUS_ACTIVE = "فعال";

export const SETTINGS_EDIT_NAME_MESSAGE = `<b>تغییر نام نمایشی</b>

یه نام کوتاه بفرست.
این نام در صفحه‌ی ارسال پیام دیده می‌شه و ربطی به نام کاربری تلگرامت نداره.`;

export const SETTINGS_NAME_SAVED_MESSAGE = `نام نمایشی ذخیره شد: <b>NAME</b>

از این به بعد فرستنده‌ها همین نام رو می‌بینن.`;

export const SETTINGS_NAME_INVALID_MESSAGE = `این نام درست نیست.

یه نام کوتاه و یک‌خطی بفرست.`;

export const SETTINGS_NAME_TEXT_ONLY_MESSAGE = `نام نمایشی باید متنی باشه.

عکس، فایل، صدا یا استیکر اینجا کار نمی‌کنه.`;

export const SETTINGS_CLEAR_DATA_WARNING_MESSAGE = `<b>پاک کردن حساب</b>

با پاک کردن حساب:

- لینک فعلیت از کار می‌افته.
- داده‌های وابسته به حسابت حذف می‌شن.
- یک هویت و لینک تازه برات ساخته می‌شه.

این کار قابل برگشت نیست.

مطمئنی؟`;

export const SETTINGS_CLEAR_DATA_DONE_MESSAGE = `حسابت پاک شد و یک لینک تازه برات ساختم:

<code>UUID_USER_URL</code>

لینک قبلی دیگه فعال نیست.`;

export const SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE = `لغو شد.

چیزی پاک نشد.`;

export const SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE = `<b>رفع همه‌ی مسدودی‌ها</b>

الان <b>COUNT</b> فرستنده مسدود شده‌اند.
اگه تأیید کنی، همه‌ی آن‌ها دوباره می‌تونن برات پیام بفرستن.

لینک و نام‌های خصوصی بدون تغییر می‌مونن.`;

export const SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE = `<b>همه‌ی مسدودی‌ها رفع شدند</b>

فرستنده‌های قبلاً مسدودشده دوباره می‌تونن برات پیام بفرستن.`;

export const SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE = `لغو شد.

فهرست مسدودی‌ها بدون تغییر موند.`;

export const SETTINGS_RESET_MATCH_WARNING_MESSAGE = `<b>بازنشانی پیشنهادهای گفت‌وگو</b>

الان <b>REQUEST_COUNT</b> درخواست گفت‌وگو و <b>BLOCK_COUNT</b> مورد پنهان‌شده از پیشنهادها داری.

اگه تأیید کنی، این تاریخچه پاک می‌شه و ممکنه دوباره همون افراد رو در جست‌وجو ببینی.

پروفایل گفت‌وگو، وضعیت نمایش در پیشنهادها و پیام‌های ناشناس تو بدون تغییر می‌مونن.`;

export const SETTINGS_RESET_MATCH_DONE_MESSAGE = `<b>تاریخچه‌ی پیشنهادهای گفت‌وگو پاک شد</b>

DETAIL_LINES

حالا می‌تونی دوباره از مسیر پیشنهاد گفت‌وگو → «🔎 پیدا کردن گزینه‌ها» استفاده کنی.`;

export const SETTINGS_RESET_MATCH_CANCELLED_MESSAGE = `لغو شد.

تاریخچه‌ی پیشنهادهای گفت‌وگو بدون تغییر موند.`;

export const SETTINGS_RESET_MATCH_REQUESTS_CLEARED =
  "— COUNT درخواست گفت‌وگو حذف شد";
export const SETTINGS_RESET_MATCH_BLOCKS_CLEARED =
  "— COUNT مورد پنهان‌شده حذف شد";

export const SETTINGS_PAUSE_DONE_CALLBACK = "دریافت پیام متوقف شد.";
export const SETTINGS_RESUME_DONE_CALLBACK = "دریافت پیام ناشناس دوباره فعاله 🐾";
export const SETTINGS_BLOCK_LIST_EMPTY_CALLBACK = "فهرست مسدودی‌ها خالیه.";
export const SETTINGS_RESET_MATCH_EMPTY_CALLBACK = "چیزی برای بازنشانی نیست.";
