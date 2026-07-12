import { convertToPersianNumbers } from "../utils/text";
import { PROFILE_QUESTION_COUNT } from "../features/conversation/profile/constants";

export const PROFILE_ANSWER_SCALE =
  "این جمله چقدر شبیه توئه؟\n\n" +
  "۱ — اصلاً شبیه من نیست\n" +
  "۲ — کمی\n" +
  "۳ — تا حدی\n" +
  "۴ — خیلی\n" +
  "۵ — کاملاً شبیه منه";

export const PROFILE_DESIRED_SCALE =
  "۱ = خیلی کم\n" +
  "۲ = کم\n" +
  "۳ = متوسط\n" +
  "۴ = زیاد\n" +
  "۵ = خیلی زیاد";

export const PROFILE_NO_PREFERENCE_LABEL = "ترجیح قوی ندارم";

export const formatProfileQuestionHeader = (
  current: number,
  total = PROFILE_QUESTION_COUNT
): string =>
  `سؤال ${convertToPersianNumbers(current)} از ${convertToPersianNumbers(total)}`;

export const formatProfileSessionStatus = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => {
  if (options.hasSession) {
    return `در حال انجام — ${convertToPersianNumbers(options.answeredCount)} از ${convertToPersianNumbers(PROFILE_QUESTION_COUNT)} سؤال`;
  }
  if (options.hasProfile) {
    return "آماده — پروفایل گفت‌وگو ذخیره شده";
  }
  return "هنوز شروع نشده";
};

export const PROFILE_DASHBOARD_INTRO =
  "<b>ارزیابی سبک گفت‌وگو</b>\n\n" +
  "میو، بیا ببینیم معمولاً چطور گفت‌وگو می‌کنی 🐾\n\n" +
  "چند جمله‌ی کوتاه می‌بینی.\n" +
  "برای هرکدوم بگو چقدر شبیه توئه.\n\n" +
  "اینجا جواب درست یا غلطی وجود نداره.\n\n" +
  "این ارزیابی تست شخصیت یا تشخیص روان‌شناختی نیست؛\n" +
  "فقط برای ساخت پروفایل گفت‌وگو و پیشنهادهای بهتر استفاده می‌شه.";

export const PROFILE_STATUS_HEADER = "وضعیت:";

export const PROFILE_COMPLETION_NOTE =
  "\n\nتموم شد 🐾\n\n" +
  "پروفایل گفت‌وگوت آماده‌ست.\n\n" +
  "اگه خواستی، حالا می‌تونی نمایش در پیشنهادها رو فعال کنی.";

export const PROFILE_RESET_CONFIRM =
  "می‌خوای ارزیابی رو از نو شروع کنی؟\n\n" +
  "پیشرفت فعلی پاک می‌شه. اگه پروفایل قبلی داشتی، نمایش در پیشنهادها تا تکمیل ارزیابی تازه غیرفعال می‌شه.";

export const PROFILE_EXIT_SAVED =
  "پیشرفتت ذخیره شد.\n\nهر وقت خواستی از همین‌جا ادامه بده.";

export const PROFILE_RESULT_READY_TITLE = "<b>پروفایل گفت‌وگوت</b>";

export const PROFILE_INTENT_OPTIONS = {
  light: "گفت‌وگوی سبک و ساده",
  deep: "گفت‌وگوی عمیق‌تر",
  support: "شنیده‌شدن و همراهی",
  exploration: "کشف موضوع‌های تازه",
  open: "بدون ترجیح مشخص",
} as const;

export const PROFILE_SUBMIT_READY =
  "همه‌ی سؤال‌ها جواب داده شد.\n\nبرای ذخیره‌ی پروفایل گفت‌وگو، دکمه‌ی «ثبت پروفایل» رو بزن.";

export const PROFILE_SUBMIT_BUTTON = "✅ ثبت پروفایل";
