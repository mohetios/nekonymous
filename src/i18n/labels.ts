/** Reply-keyboard and inline button labels shown in Telegram UI. */

export const MENU = {
  about: "ℹ️ درباره و حریم خصوصی",
  privacy: "🔒 حریم خصوصی",
  link: "🔗 لینک من",
  matchSystem: "🧭 پیشنهاد گفت‌وگو",
  matchProfile: "👤 پروفایل گفت‌وگو",
  matchFind: "🔎 پیدا کردن گزینه‌ها",
  matchPending: "📥 درخواست‌های گفت‌وگو",
  matchEnable: "✅ فعال‌سازی نمایش",
  matchDisable: "⏸ توقف نمایش",
  matchAssessment: "📝 شروع ارزیابی",
  matchAssessmentRetry: "📝 ارزیابی دوباره",
  matchBackToHub: "↩️ بازگشت",
  settings: "⚙️ تنظیمات",
  editName: "✏️ نام",
  cancelDraft: "↩️ لغو",
  pauseInbox: "⏸ توقف دریافت پیام",
  resumeInbox: "▶️ فعال‌سازی دریافت پیام",
  clearBlockList: "🚫 رفع مسدودی‌ها",
  resetMatchHistory: "♻️ بازنشانی پیشنهادها",
  clearData: "🗑️ پاک کردن حساب",
  technical: "🧾 نکات فنی",
  back: "🏠 منوی اصلی",
  confirmClear: "🗑️ پاک کردن حساب",
  confirmClearBlocks: "🚫 بله، رفع همه مسدودی‌ها",
  confirmResetMatchHistory: "♻️ بله، بازنشانی کن",
  cancel: "↩️ انصراف",
} as const;

export const INBOX_BUTTON = {
  block: "🚫 مسدود کردن",
  unblock: "🔓 رفع مسدودیت",
  reply: "💬 پاسخ دادن",
  nickname: "🏷️ نام خصوصی",
  report: "⚠️ گزارش کردن",
} as const;

export const OPEN_INBOX_TICKET_BUTTON = "باز کردن پیام";

/** Prefix for delivered anonymous messages (nickname inserted). */
export const DELIVERY_HEADER_FROM = (nickname: string): string =>
  `💬 از ${nickname}:`;

const MENU_LABELS = new Set<string>(Object.values(MENU));

export const isMenuLabel = (text: string): boolean => MENU_LABELS.has(text);

/** Strip emoji/symbols so "تنظیمات" matches "⚙️ تنظیمات". */
const plainMenuLabel = (text: string): string =>
  text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "").trim();

export const MATCH_BUTTON = {
  search: "🔎 پیدا کردن گزینه‌ها",
  accept: "✅ پذیرفتن",
  decline: "❌ رد کردن",
  cancelRequest: "لغو درخواست",
  requestConversation: (index: number) => `✍️ درخواست ${index + 1}`,
} as const;

export const ASSESSMENT_BUTTON = {
  start: "📝 شروع ارزیابی",
  continue: "📝 ادامه ارزیابی",
  restart: "📝 ارزیابی دوباره",
  viewResult: "👤 پروفایل گفت‌وگو",
  viewResultAgain: "👤 پروفایل گفت‌وگو",
  resetYes: "بله، از نو",
  resetNo: "↩️ انصراف",
  previous: "قبلی",
  exit: "خروج",
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
