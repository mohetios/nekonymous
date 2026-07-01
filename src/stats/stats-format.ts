import { convertToPersianNumbers } from "../utils/tools";
import type { PeriodCounts, PublicBotStats } from "./stats-reader";

export const SETTINGS_STATS_EMPTY_MESSAGE = `📊 <b>آمار کلی نکونیموس</b>

هنوز داده‌ی کافی برای نمایش آمار وجود ندارد.

آمار با تأخیر کوتاه به‌روزرسانی می‌شود.`;

export const SETTINGS_STATS_ERROR_MESSAGE =
  "در حال حاضر امکان نمایش آمار نیست. کمی بعد دوباره امتحان کن.";

const formatCount = (value: number): string =>
  convertToPersianNumbers(Math.max(0, value));

export const bucketSensitiveCount = (value: number): string => {
  if (value < 5) {
    return "کمتر از ۵";
  }
  if (value <= 20) {
    return "۵ تا ۲۰";
  }
  if (value <= 100) {
    return "۲۰ تا ۱۰۰";
  }
  return "۱۰۰+";
};

const formatPeriodLines = (counts: PeriodCounts): string =>
  `• امروز: ${formatCount(counts.today)}
• ۷ روز اخیر: ${formatCount(counts.days7)}
• ۳۰ روز اخیر: ${formatCount(counts.days30)}`;

const hasAnyActivity = (stats: PublicBotStats): boolean => {
  const periods = [
    stats.newUsers,
    stats.messages,
    stats.replies,
    stats.reports,
    stats.linksCreated,
    stats.inboxOpens,
    stats.assessmentsCompleted,
    stats.suggestionSearches,
  ];
  return periods.some(
    (period) => period.today > 0 || period.days7 > 0 || period.days30 > 0
  );
};

export const formatPublicBotStatsMessage = (stats: PublicBotStats): string => {
  if (!stats.hasDailyData && !hasAnyActivity(stats) && (stats.totalUsers ?? 0) === 0) {
    return SETTINGS_STATS_EMPTY_MESSAGE;
  }

  const lines = [
    "📊 <b>آمار کلی نکونیموس</b>",
    "",
    "این آمار فقط به‌صورت کلی و تجمیعی نمایش داده می‌شود.",
    "هیچ متن پیام، مسیر پیام، فرستنده، گیرنده یا اطلاعات قابل اتصال به کاربران در این صفحه نمایش داده نمی‌شود.",
    "",
  ];

  if (stats.totalUsers !== null) {
    lines.push(
      "👥 <b>کاربران</b>",
      `• کل: ${formatCount(stats.totalUsers)}`,
      "• تازه‌وارد:",
      formatPeriodLines(stats.newUsers),
      ""
    );
  }

  if (stats.hasActiveUsers) {
    lines.push("🟢 <b>کاربران فعال</b>", formatPeriodLines(stats.activeUsers), "");
  }

  lines.push("💬 <b>پیام‌ها</b>", formatPeriodLines(stats.messages), "");
  lines.push("↩️ <b>پاسخ‌ها</b>", formatPeriodLines(stats.replies), "");

  if (stats.messagesDelivered7d > 0) {
    const replyRate = Math.round(
      (stats.replies.days7 / stats.messagesDelivered7d) * 100
    );
    lines.push(`• نرخ پاسخ ۷ روز اخیر: ${formatCount(replyRate)}٪`, "");
  }

  lines.push(
    "🔗 <b>لینک‌های ساخته‌شده</b>",
    formatPeriodLines(stats.linksCreated),
    "",
    "🗂 <b>باز کردن صندوق</b>",
    formatPeriodLines(stats.inboxOpens),
    "",
    "🧭 <b>پیشنهاد گفت‌وگو</b>",
    `• تکمیل ارزیابی در ۳۰ روز اخیر: ${formatCount(stats.assessmentsCompleted.days30)}`,
    `• جست‌وجوی گزینه‌ها در ۳۰ روز اخیر: ${formatCount(stats.suggestionSearches.days30)}`,
    "",
    "🛡️ <b>ایمنی</b>",
    `• گزارش‌ها در ۳۰ روز اخیر: ${bucketSensitiveCount(stats.reports.days30)}`,
    "",
    "آمار با تأخیر کوتاه به‌روزرسانی می‌شود."
  );

  return lines.join("\n");
};
