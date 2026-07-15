/**
 * Strings with HTML tags must be sent via `replyHtml` / `withHtml` (parse_mode HTML).
 */
import { DISPLAY_NAME_UNSET } from "./defaults";

export const SETTINGS_NAME_UNSET = DISPLAY_NAME_UNSET;

export const SETTINGS_HOME_MESSAGE =
  "تنظیمات\n\n" +
  "نام نمایشی: USER_NAME\n" +
  "دریافت پیام: PAUSE_STATUS\n\n" +
  "از اینجا می‌تونی دریافت پیام، نام نمایشی، پیشنهادهای گفت‌وگو و حریم خصوصی حسابت رو مدیریت کنی.";

export const SETTINGS_INBOX_STATUS_PAUSED = "متوقف";
export const SETTINGS_INBOX_STATUS_ACTIVE = "فعال";

export const SETTINGS_EDIT_NAME_MESSAGE =
  "یه نام کوتاه بفرست.\n\n" +
  "این نام در صفحه‌ی ارسال پیام دیده می‌شه و ربطی به نام یا نام کاربری تلگرامت نداره.";

export const SETTINGS_NAME_SAVED_MESSAGE =
  "نام نمایشی ذخیره شد: NAME\n\n" +
  "از این به بعد فرستنده‌ها همین نام رو می‌بینن.";

export const SETTINGS_NAME_INVALID_MESSAGE =
  "این نام قابل استفاده نیست.\n\nیه نام کوتاه و یک‌خطی بفرست.";

export const SETTINGS_NAME_TEXT_ONLY_MESSAGE =
  "نام نمایشی باید متنی باشه.\n\n" +
  "عکس، فایل، صدا یا استیکر اینجا کار نمی‌کنه.";

export const SETTINGS_CLEAR_DATA_WARNING_MESSAGE =
  "پاک کردن حساب\n\n" +
  "با این کار:\n" +
  "• لینک فعلیت از کار می‌افته.\n" +
  "• داده‌های وابسته به حسابت حذف می‌شن.\n" +
  "• یک هویت و لینک تازه برات ساخته می‌شه.\n\n" +
  "این کار قابل برگشت نیست.\n\n" +
  "مطمئنی؟";

export const SETTINGS_CLEAR_DATA_DONE_MESSAGE =
  "حسابت پاک شد و یک لینک تازه برات ساختم:\n\n" +
  "UUID_USER_URL\n\n" +
  "لینک قبلی دیگه فعال نیست.";

export const SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE =
  "لغو شد.\n\nچیزی پاک نشد.";

export const SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE =
  "رفع همه‌ی مسدودی‌ها\n\n" +
  "الان COUNT فرستنده توی فهرست مسدودی‌هاست.\n\n" +
  "اگه تأیید کنی، همه‌شون دوباره می‌تونن برات پیام بفرستن.\n" +
  "لینک و نام‌های خصوصی تغییری نمی‌کنن.";

export const SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE =
  "همه‌ی مسدودی‌ها برداشته شد.\n\n" +
  "فرستنده‌های قبلی دوباره می‌تونن برات پیام بفرستن.";

export const SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE =
  "لغو شد.\n\nفهرست مسدودی‌ها تغییری نکرد.";

export const SETTINGS_RESET_MATCH_WARNING_MESSAGE =
  "بازنشانی پیشنهادهای گفت‌وگو\n\n" +
  "الان REQUEST_COUNT درخواست گفت‌وگو و BLOCK_COUNT گزینه‌ی کنارگذاشته‌شده داری.\n\n" +
  "اگه تأیید کنی، این تاریخچه پاک می‌شه و ممکنه دوباره همون افراد رو در پیشنهادها ببینی.\n\n" +
  "پروفایل گفت‌وگو، وضعیت نمایش و پیام‌های ناشناست تغییری نمی‌کنن.";

export const SETTINGS_RESET_MATCH_DONE_MESSAGE =
  "تاریخچه‌ی پیشنهادها پاک شد.\n\n" +
  "DETAIL_LINES\n\n" +
  "حالا می‌تونی دوباره از بخش پیشنهاد گفت‌وگو، گزینه‌های تازه رو ببینی.";

export const SETTINGS_RESET_MATCH_CANCELLED_MESSAGE =
  "لغو شد.\n\nتاریخچه‌ی پیشنهادها تغییری نکرد.";

export const SETTINGS_RESET_MATCH_REQUESTS_CLEARED =
  "• COUNT درخواست گفت‌وگو پاک شد";

export const SETTINGS_RESET_MATCH_BLOCKS_CLEARED =
  "• COUNT گزینه‌ی کنارگذاشته‌شده پاک شد";

export const SETTINGS_PAUSE_DONE_CALLBACK = "دریافت پیام متوقف شد.";
export const SETTINGS_RESUME_DONE_CALLBACK = "دریافت پیام دوباره فعاله 🐾";
export const SETTINGS_BLOCK_LIST_EMPTY_CALLBACK = "فهرست مسدودی‌ها خالیه.";
export const SETTINGS_RESET_MATCH_EMPTY_CALLBACK = "چیزی برای بازنشانی نیست.";
