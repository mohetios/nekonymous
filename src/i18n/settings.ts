/** Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML). */

import { DISPLAY_NAME_UNSET } from "./defaults";

export const SETTINGS_NAME_UNSET = DISPLAY_NAME_UNSET;

export const SETTINGS_HOME_MESSAGE = `<b>تنظیمات</b>

نام نمایشی: <b>USER_NAME</b>
وضعیت دریافت پیام: <b>PAUSE_STATUS</b>

از همین‌جا می‌تونی لینک، دریافت پیام، پیشنهادها و حریم خصوصی حسابت رو مدیریت کنی.`;

export const SETTINGS_INBOX_STATUS_PAUSED = "متوقف";
export const SETTINGS_INBOX_STATUS_ACTIVE = "فعال";

export const SETTINGS_EDIT_NAME_MESSAGE = `<b>تغییر نام نمایشی</b>

یه نام کوتاه بفرست.
این نام در صفحه‌ی ارسال پیام دیده می‌شه و <b>نام کاربری تلگرامت نیست</b>.`;

export const SETTINGS_NAME_SAVED_MESSAGE = `<b>نام نمایشی ذخیره شد:</b> <b>NAME</b> 🐾

از این به بعد فرستنده‌ها همین نام رو می‌بینند.`;

export const SETTINGS_NAME_INVALID_MESSAGE = `این نام قابل قبول نیست.

یه متن کوتاه بفرست؛ بدون خط خالی و بدون Enter.`;

export const SETTINGS_NAME_TEXT_ONLY_MESSAGE = `برای نام نمایشی فقط <b>متن</b> قابل قبول است.

عکس، فایل، پیام صوتی یا استیکر پشتیبانی نمی‌شه.`;

export const SETTINGS_CLEAR_DATA_WARNING_MESSAGE = `<b>پاک کردن حساب</b>

با پاک کردن حساب:

- لینک فعلیت از کار می‌افته.
- داده‌های وابسته به حسابت در محدوده‌ی پیاده‌سازی فعلی حذف می‌شن.
- یک هویت و لینک تازه ساخته می‌شه.

این کار قابل برگشت نیست.

مطمئنی؟`;

export const SETTINGS_CLEAR_DATA_DONE_MESSAGE = `حساب پاک شد و لینک جدید برایت ساخته شد.

<code>UUID_USER_URL</code>

لینک قبلی دیگه فعال نیست.
از این به بعد همین لینک جدید رو به اشتراک بگذار.`;

export const SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE = `لغو شد.

هیچ داده‌ای حذف نشد.`;

export const SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE = `<b>رفع همه‌ی مسدودی‌ها</b>

در حال حاضر <b>COUNT</b> فرستنده مسدود شده‌اند.
اگر تأیید کنی، همه‌ی آن‌ها دوباره می‌تونن از لینک تو پیام بفرستن.

لینک و نام‌های خصوصی بدون تغییر باقی می‌مانند.`;

export const SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE = `<b>همه‌ی مسدودی‌ها رفع شدند</b>

فرستنده‌های قبلاً مسدودشده دوباره می‌تونن پیام بفرستن.`;

export const SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE = `لغو شد.

فهرست مسدودی‌ها بدون تغییر باقی ماند.`;

export const SETTINGS_RESET_MATCH_WARNING_MESSAGE = `<b>بازنشانی پیشنهادهای گفت‌وگو</b>

در حال حاضر <b>REQUEST_COUNT</b> درخواست گفت‌وگو و <b>BLOCK_COUNT</b> مورد پنهان‌شده از پیشنهادها ثبت شده است.

اگر تأیید کنی، این تاریخچه پاک می‌شه و ممکنه دوباره همان افراد رو در جست‌وجو ببینی.

پروفایل ارزیابی، وضعیت نمایش در پیشنهادها و پیام‌های ناشناس تو بدون تغییر می‌مانند.`;

export const SETTINGS_RESET_MATCH_DONE_MESSAGE = `<b>تاریخچه‌ی پیشنهادهای گفت‌وگو پاک شد</b>

DETAIL_LINES

حالا می‌تونی دوباره از مسیر پیشنهاد گفت‌وگو → «🔎 پیدا کردن گزینه‌ها» استفاده کنی.`;

export const SETTINGS_RESET_MATCH_CANCELLED_MESSAGE = `لغو شد.

تاریخچه‌ی پیشنهادهای گفت‌وگو بدون تغییر باقی ماند.`;

export const SETTINGS_RESET_MATCH_REQUESTS_CLEARED =
  "— COUNT درخواست گفت‌وگو حذف شد";
export const SETTINGS_RESET_MATCH_BLOCKS_CLEARED =
  "— COUNT مورد پنهان‌شده حذف شد";

export const SETTINGS_PAUSE_DONE_CALLBACK = "دریافت پیام متوقف شد.";
export const SETTINGS_RESUME_DONE_CALLBACK = "دریافت پیام فعال شد.";
export const SETTINGS_BLOCK_LIST_EMPTY_CALLBACK = "فهرست مسدودی‌ها خالی است.";
export const SETTINGS_RESET_MATCH_EMPTY_CALLBACK = "چیزی برای بازنشانی نیست.";
