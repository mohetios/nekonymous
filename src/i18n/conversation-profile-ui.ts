import { convertToPersianNumbers } from "../utils/tools";

const PROFILE_QUESTION_COUNT = 25;

export const PROFILE_ANSWER_SCALE =
  "۱ = اصلاً به من نزدیک نیست\n" +
  "۲ = کمی به من نزدیکه\n" +
  "۳ = تا حدی به من نزدیکه\n" +
  "۴ = زیاد به من نزدیکه\n" +
  "۵ = کاملاً به من نزدیکه";

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
    return `در حال انجام — ${convertToPersianNumbers(options.answeredCount)} از ${convertToPersianNumbers(PROFILE_QUESTION_COUNT)} سؤال جواب داده شده`;
  }
  if (options.hasProfile) {
    return "تکمیل‌شده — پروفایل گفت‌وگو ذخیره شده است";
  }
  return "هنوز شروع نشده";
};

export const PROFILE_DASHBOARD_INTRO =
  "📝 <b>ارزیابی سبک گفت‌وگو</b>\n\n" +
  "این ارزیابی کمک می‌کنه سبک گفت‌وگوی خودت رو بهتر بشناسی.\n\n" +
  "برچسب شخصیتی یا تشخیص روان‌شناختی نیست. جواب‌ها برای ساخت پروفایل گفت‌وگو و پیشنهادهای بهتر استفاده می‌شن.";

export const PROFILE_STATUS_HEADER = "وضعیت:";

export const PROFILE_COMPLETION_NOTE =
  "\n\nارزیابی کامل شد.\n" +
  "پروفایل گفت‌وگوی تو ذخیره شد و در حال آماده‌سازی برای پیشنهادهاست.";

export const PROFILE_RESET_CONFIRM =
  "می‌خوای ارزیابی رو از نو شروع کنی؟\n\n" +
  "پیشرفت فعلی پاک می‌شه. اگر پروفایل قبلی داشتی، نمایش در پیشنهادها تا تکمیل ارزیابی تازه غیرفعال می‌شه.";

export const PROFILE_EXIT_SAVED =
  "پیشرفتت ذخیره شد.\n\nهر وقت خواستی از منوی ارزیابی ادامه بده.";

export const PROFILE_RESULT_READY_TITLE = "✅ <b>ارزیابی کامل شد.</b>";

export const PROFILE_INTENT_OPTIONS = {
  light: "گفت‌وگوی سبک و کم‌فشار",
  deep: "گفت‌وگوی عمیق‌تر",
  support: "شنیده‌شدن و همراهی",
  exploration: "کشف موضوع‌های تازه",
  open: "بدون ترجیح مشخص",
} as const;

export const PROFILE_SUBMIT_READY =
  "همه‌ی سؤال‌ها جواب داده شد.\n\nبرای ذخیره‌ی پروفایل گفت‌وگو، دکمه‌ی «ثبت پروفایل» را بزن.";

export const PROFILE_SUBMIT_BUTTON = "✅ ثبت پروفایل";
