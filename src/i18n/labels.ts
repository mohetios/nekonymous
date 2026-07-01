/** Reply-keyboard and inline button labels shown in Telegram UI. */

export const MENU = {
  about: "ℹ️ درباره و حریم خصوصی",
  link: "🔗 لینک من",
  inbox: "🗂 صندوق پیام‌ها",
  matchSystem: "🧭 پیشنهاد گفت‌وگو",
  matchProfile: "👤 پروفایل گفت‌وگو",
  matchFind: "🔎 پیدا کردن گزینه‌ها",
  matchPending: "📥 درخواست‌های گفت‌وگو",
  matchEnable: "✅ فعال‌سازی نمایش",
  matchDisable: "⏸ توقف نمایش",
  matchAssessment: "📝 شروع ارزیابی",
  matchAssessmentRetry: "📝 ارزیابی دوباره",
  settings: "⚙️ تنظیمات",
  editName: "✏️ نام نمایشی",
  cancelDraft: "↩️ لغو عملیات",
  pauseInbox: "⏸ توقف دریافت پیام",
  resumeInbox: "▶️ فعال‌سازی دریافت پیام",
  clearBlockList: "🚫 رفع مسدودی‌ها",
  resetMatchHistory: "♻️ بازنشانی پیشنهادها",
  clearData: "🗑️ پاک کردن حساب",
  technical: "🧾 نکات فنی",
  stats: "📊 آمار",
  hubBack: "↩️ بازگشت",
  settingsBack: "↩️ بازگشت",
  home: "🏠 منوی اصلی",
} as const;

/** Inline-only confirmation labels (never on reply keyboard). */
export const CONFIRM_BUTTON = {
  yesDelete: "🗑️ بله، پاک کن",
  yes: "✅ تأیید",
  noCancel: "↩️ نه، انصراف",
} as const;

export const INBOX_BUTTON = {
  block: "🚫 مسدود کردن",
  unblock: "🔓 رفع مسدودی",
  reply: "💬 پاسخ دادن",
  nickname: "🏷️ نام خصوصی",
  report: "⚠️ گزارش کردن",
} as const;

export const OPEN_INBOX_BUTTON = "🗂 نمایش صندوق پیام‌ها";

/** Prefix for delivered anonymous messages (nickname inserted). */
export const DELIVERY_HEADER_FROM = (nickname: string): string =>
  `💬 پیام از ${nickname}:`;

const MENU_LABELS = new Set<string>(Object.values(MENU));

export const isMenuLabel = (text: string): boolean => MENU_LABELS.has(text);

/** Strip emoji/symbols so "تنظیمات" matches "⚙️ تنظیمات". */
const plainMenuLabel = (text: string): string =>
  text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "").trim();

export const MATCH_BUTTON = {
  search: "🔎 پیدا کردن گزینه‌ها",
  accept: "✅ پذیرفتن",
  decline: "❌ رد کردن",
  cancelRequest: "↩️ لغو درخواست",
  writeIntro: (index: number) => `✍️ نوشتن پیام شروع ${index + 1}`,
  dismiss: "بعداً",
} as const;

export const ASSESSMENT_BUTTON = {
  start: "📝 شروع ارزیابی",
  continue: "📝 ادامه ارزیابی",
  restart: "📝 ارزیابی دوباره",
  viewResult: "👤 پروفایل گفت‌وگو",
  viewResultAgain: "👤 پروفایل گفت‌وگو",
  resetYes: "✅ تأیید",
  resetNo: "↩️ انصراف",
  previous: "⬅️ قبلی",
  exit: "↩️ ذخیره و خروج",
  backToMenu: "↩️ بازگشت",
} as const;

export const isReservedDisplayName = (text: string): boolean => {
  if (isMenuLabel(text)) {
    return true;
  }

  const plain = plainMenuLabel(text);
  if (!plain) {
    return false;
  }

  for (const label of MENU_LABELS) {
    if (plainMenuLabel(label) === plain) {
      return true;
    }
  }

  return false;
};
