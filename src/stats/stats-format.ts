import { convertToPersianNumbers } from "../utils/text";
import type { PeriodCounts, PublicBotStats } from "./stats-reader";

export const SETTINGS_STATS_EMPTY_MESSAGE = `📊 <b>آمار کلی نِکونیموس</b>

<i>فعلاً داده‌ای برای نمایش ندارم.</i>

همه‌ی عددها از شمارش‌های تجمیعی میان و با کمی تأخیر به‌روز می‌شن.`;

export const SETTINGS_STATS_ERROR_MESSAGE =
  "فعلاً نتونستم آمار رو نمایش بدم. کمی بعد دوباره امتحان کن.";

/** Always render a non-negative integer with Persian digits; empty → ۰. */
export const formatStatCount = (value: number | null | undefined): string =>
  convertToPersianNumbers(Math.max(0, Math.floor(value ?? 0)));

export const bucketSensitiveCount = (value: number): string => {
  if (value <= 0) {
    return formatStatCount(0);
  }
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

const periodInline = (counts: PeriodCounts): string =>
  `امروز <b>${formatStatCount(counts.today)}</b> · ۷روز <b>${formatStatCount(counts.days7)}</b> · ۳۰روز <b>${formatStatCount(counts.days30)}</b>`;

const section = (icon: string, title: string, lines: string[]): string =>
  [`${icon} <b>${title}</b>`, ...lines].join("\n");

const formatReplyRate7d = (stats: PublicBotStats): string => {
  if (stats.messagesDelivered7d <= 0) {
    return formatStatCount(0);
  }
  const rate = Math.min(
    100,
    Math.round((stats.replies.days7 / stats.messagesDelivered7d) * 100)
  );
  return formatStatCount(rate);
};

export const formatPublicBotStatsMessage = (stats: PublicBotStats): string => {
  if (stats.totalUsers === null && !stats.hasDailyData) {
    return SETTINGS_STATS_EMPTY_MESSAGE;
  }

  const totalUsers = stats.totalUsers ?? 0;

  const blocks = [
    "📊 <b>آمار کلی نِکونیموس</b>",
    "",
    "<i>تجمیعی و ناشناس — بدون متن پیام، مسیر، فرستنده، گیرنده یا اطلاعات قابل اتصال به کاربر.</i>",
    "",
    section("👥", "کاربران", [
      `کل · <b>${formatStatCount(totalUsers)}</b>`,
      `تازه‌وارد · ${periodInline(stats.newUsers)}`,
    ]),
    "",
    section("🟢", "کاربران فعال", [periodInline(stats.activeUsers)]),
    "",
    section("💬", "پیام‌های ناشناس", [
      `ساخته‌شده · ${periodInline(stats.messages)}`,
      `منقضی‌شده · ${periodInline(stats.messagesExpired)}`,
    ]),
    "",
    section("↩️", "پاسخ‌های ناشناس", [
      periodInline(stats.replies),
      `نرخ پاسخ ۷روز · <b>${formatReplyRate7d(stats)}٪</b>`,
    ]),
    "",
    section("🔗", "لینک‌های ساخته‌شده", [periodInline(stats.linksCreated)]),
    "",
    section("📥", "باز کردن صندوق پیام‌ها", [periodInline(stats.inboxOpens)]),
    "",
    section("🧭", "پیشنهاد گفت‌وگو", [
      `۳۰روز · ارزیابی <b>${formatStatCount(stats.assessmentsCompleted.days30)}</b> · جست‌وجو <b>${formatStatCount(stats.suggestionSearches.days30)}</b>`,
    ]),
    "",
    section("🛡️", "ایمنی", [
      `گزارش ۳۰روز · <b>${bucketSensitiveCount(stats.reports.days30)}</b>`,
      `مسدودسازی ۳۰روز · <b>${bucketSensitiveCount(stats.blocks.days30)}</b>`,
    ]),
    "",
    "<i>به‌روزرسانی با کمی تأخیر (~۱ دقیقه)</i>",
  ];

  return blocks.join("\n");
};
