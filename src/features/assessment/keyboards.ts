import { InlineKeyboard } from "grammy";
import { ASSESSMENT_CALLBACK } from "./constants";
import {
  getQuestionAtIndex,
  ASSESSMENT_QUESTION_COUNT,
} from "./question-bank";
import { assertCallbackData } from "../../utils/telegram-limits";

export const buildAssessmentDashboardKeyboard = (options: {
  hasProfile: boolean;
  hasSession: boolean;
}): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  if (!options.hasSession && !options.hasProfile) {
    keyboard.text("شروع ارزیابی", ASSESSMENT_CALLBACK.start);
    return keyboard;
  }

  if (options.hasSession) {
    keyboard.text("ادامه ارزیابی", ASSESSMENT_CALLBACK.continue).row();
    keyboard.text("شروع دوباره", ASSESSMENT_CALLBACK.reset);
    return keyboard;
  }

  if (options.hasProfile) {
    keyboard.text("دیدن نتیجه", ASSESSMENT_CALLBACK.result).row();
    keyboard.text("شروع دوباره", ASSESSMENT_CALLBACK.reset);
  }

  return keyboard;
};

export const buildResetConfirmKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text("بله، از نو", ASSESSMENT_CALLBACK.resetYes)
    .text("انصراف", ASSESSMENT_CALLBACK.resetNo);

export const buildQuestionKeyboard = (index: number): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  for (let value = 1; value <= 5; value++) {
    const data = ASSESSMENT_CALLBACK.answer(index, value);
    assertCallbackData(data);
    keyboard.text(String(value), data);
  }

  keyboard.row();

  if (index > 0) {
    keyboard.text("قبلی", ASSESSMENT_CALLBACK.previous);
  }

  keyboard.text("خروج", ASSESSMENT_CALLBACK.exit);

  return keyboard;
};

export const buildResultKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text("دیدن دوباره نتیجه", ASSESSMENT_CALLBACK.result)
    .row()
    .text("شروع دوباره", ASSESSMENT_CALLBACK.reset)
    .row()
    .text("بازگشت به منو", ASSESSMENT_CALLBACK.menu);

export const ASSESSMENT_ANSWER_SCALE =
  "۱ = اصلاً شبیه من نیست\n" +
  "۲ = کمی شبیه من است\n" +
  "۳ = تا حدی شبیه من است\n" +
  "۴ = زیاد شبیه من است\n" +
  "۵ = کاملاً شبیه من است";

export const formatQuestionMessage = (index: number): string => {
  const question = getQuestionAtIndex(index);
  if (!question) {
    return "سؤالی یافت نشد.";
  }

  const current = index + 1;
  return (
    `سؤال ${current}/${ASSESSMENT_QUESTION_COUNT}\n\n` +
    `${question.text}\n\n` +
    ASSESSMENT_ANSWER_SCALE
  );
};

export const dashboardStatusLine = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => {
  if (options.hasSession) {
    return `در حال انجام — ${options.answeredCount} از ${ASSESSMENT_QUESTION_COUNT} سؤال`;
  }
  if (options.hasProfile) {
    return "تکمیل‌شده — نتیجه ذخیره شده است";
  }
  return "هنوز شروع نکرده‌ای";
};

export const ASSESSMENT_DASHBOARD_INTRO =
  "🧭 <b>ارزیابی سبک گفت‌وگو</b>\n\n" +
  "این ارزیابی کمک می‌کند سبک گفت‌وگو، مرزها، ریتم پاسخ‌دهی و راحتی تو با گفت‌وگوی ناشناس بهتر فهمیده شود.\n\n" +
  "نتیجه ارزیابی تشخیص روان‌شناسی نیست.\n" +
  "از آن فقط برای ساخت پروفایل گفت‌وگو و پیشنهادهای ناشناس استفاده می‌شود.";

export const ASSESSMENT_COMPLETION_NOTE =
  "\n\nاین نتیجه فقط برای خودت نمایش داده می‌شود.\n" +
  "اگر مچ‌یابی را فعال کنی، از همین پروفایل برای پیشنهاد گفت‌وگوهای ناشناس استفاده می‌شود.";

export const ASSESSMENT_VERSION_OUTDATED_NOTE =
  "\n\nنسخه جدید ارزیابی آماده شده است.\n" +
  "برای پیشنهادهای بهتر، بهتر است ارزیابی را یک بار دیگر کامل کنی.";

export const ASSESSMENT_RESET_CONFIRM =
  "آیا مطمئنی می‌خواهی ارزیابی را از نو شروع کنی؟\n" +
  "پیشرفت فعلی پاک می‌شود. نتیجه قبلی تا تکمیل ارزیابی جدید باقی می‌ماند.";

export const ASSESSMENT_EXIT_SAVED =
  "پیشرفت ذخیره شد. هر وقت خواستی از منوی ارزیابی ادامه بده.";
