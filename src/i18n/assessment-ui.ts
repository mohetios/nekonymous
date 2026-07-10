/** Must stay in sync with ASSESSMENT_QUESTION_COUNT in question-bank.ts */
import { convertToPersianNumbers } from "../utils/tools";

const ASSESSMENT_QUESTION_COUNT = 56;

export const ASSESSMENT_ANSWER_SCALE =
  "۱ = اصلاً به من نزدیک نیست\n" +
  "۲ = کمی به من نزدیکه\n" +
  "۳ = تا حدی به من نزدیکه\n" +
  "۴ = زیاد به من نزدیکه\n" +
  "۵ = کاملاً به من نزدیکه";

export const ASSESSMENT_QUESTION_NOT_FOUND = "این سؤال در دسترس نیست.";

export const formatAssessmentQuestionHeader = (
  current: number,
  total = ASSESSMENT_QUESTION_COUNT
): string =>
  `سؤال ${convertToPersianNumbers(current)} از ${convertToPersianNumbers(total)}`;

export const formatAssessmentSessionStatus = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => {
  if (options.hasSession) {
    return `در حال انجام — ${convertToPersianNumbers(options.answeredCount)} از ${convertToPersianNumbers(ASSESSMENT_QUESTION_COUNT)} سؤال جواب داده شده`;
  }
  if (options.hasProfile) {
    return "تکمیل‌شده — پروفایل گفت‌وگو ذخیره شده است";
  }
  return "هنوز شروع نشده";
};

export const ASSESSMENT_DASHBOARD_INTRO =
  "📝 <b>ارزیابی سبک گفت‌وگو</b>\n\n" +
  "این ارزیابی کمک می‌کنه سبک گفت‌وگوی خودت رو بهتر بشناسی.\n\n" +
  "برچسب شخصیتی یا تشخیص روان‌شناختی نیست. جواب‌ها برای ساخت پروفایل گفت‌وگو و پیشنهادهای بهتر استفاده می‌شن.";

export const ASSESSMENT_STATUS_HEADER = "وضعیت:";

export const ASSESSMENT_COMPLETION_NOTE =
  "\n\nارزیابی کامل شد.\n" +
  "حالا اگه خواستی، می‌تونی نمایش در پیشنهادهای گفت‌وگو رو فعال کنی.";

export const ASSESSMENT_VERSION_OUTDATED_NOTE =
  "\n\nنسخه‌ی تازه‌ای از ارزیابی آماده شده است.\n" +
  "برای پیشنهادهای بهتر، بهتره ارزیابی رو یک بار دیگه کامل کنی.";

export const ASSESSMENT_RESET_CONFIRM =
  "می‌خوای ارزیابی رو از نو شروع کنی؟\n\n" +
  "پیشرفت فعلی پاک می‌شه. نتیجه‌ی قبلی تا وقتی ارزیابی تازه رو کامل نکنی باقی می‌مونه.";

export const ASSESSMENT_EXIT_SAVED =
  "پیشرفتت ذخیره شد.\n\nهر وقت خواستی از منوی ارزیابی ادامه بده.";

export const ASSESSMENT_RESULT_READY_TITLE =
  "✅ <b>ارزیابی کامل شد.</b>";

export const ASSESSMENT_RESULT_HIGHLIGHTS_HEADER = "<b>چند سیگنال اصلی:</b>";
export const ASSESSMENT_RESULT_CAUTIONS_HEADER = "<b>چند نکته برای گفت‌وگو:</b>";
export const ASSESSMENT_RESULT_SCORES_HEADER = "<b>نمای کلی:</b>";

export const ASSESSMENT_DEFAULT_TITLE = "سبک گفت‌وگو";
export const ASSESSMENT_DEFAULT_SHORT_DESCRIPTION =
  "پروفایل گفت‌وگوی تو ذخیره شده است.";
