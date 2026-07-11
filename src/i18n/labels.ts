/** Reply-keyboard and inline button labels shown in Telegram UI. */

export const MENU = {
  link: "🔗 لینک من",
  inbox: "📥 صندوق پیام‌ها",
  matchSystem: "🧭 پیشنهاد گفت‌وگو",
  settings: "⚙️ تنظیمات",
  matchProfile: "👤 پروفایل گفت‌وگو",
  matchFind: "🔎 پیدا کردن گزینه‌ها",
  matchPending: "📥 درخواست‌های گفت‌وگو",
  matchEnable: "✅ فعال‌سازی نمایش",
  matchDisable: "⏸ توقف نمایش",
  matchAssessment: "📝 شروع ارزیابی",
  matchAssessmentRetry: "📝 ارزیابی دوباره",
  editName: "✏️ نام نمایشی",
  pauseInbox: "⏸ توقف دریافت پیام",
  resumeInbox: "▶️ فعال‌سازی دریافت پیام",
  clearBlockList: "🚫 رفع مسدودی‌ها",
  resetMatchHistory: "♻️ بازنشانی پیشنهادها",
  clearData: "🗑️ پاک کردن حساب",
  about: "ℹ️ درباره و حریم خصوصی",
  stats: "📊 آمار",
} as const;

export const DRAFT_CANCEL_LABEL = "↩️ لغو";

export const INPUT_PLACEHOLDERS = {
  compose: "پیامت رو بنویس...",
  reply: "جوابت رو بنویس...",
  nickname: "نام خصوصی رو بنویس...",
  display_name: "نام نمایشی رو بنویس...",
  conversation_intro: "پیام شروع گفت‌وگو رو بنویس...",
} as const;

export const BOT_COMMAND_DESCRIPTIONS = {
  start: "شروع و دریافت لینک پیام ناشناس",
  inbox: "باز کردن صندوق پیام‌ها",
  settings: "تنظیمات و حریم خصوصی",
  assessment: "ارزیابی سبک گفت‌وگو",
  match: "پیشنهاد گفت‌وگو",
} as const;

export const BACK_BUTTON = {
  toSettings: "↩️ بازگشت به تنظیمات",
  toSuggestions: "↩️ بازگشت به پیشنهادها",
} as const;

/** Inline-only confirmation labels (never on reply keyboard). */
export const CONFIRM_BUTTON = {
  yesDelete: "بله، حسابم را پاک کن",
  confirmClearBlocks: "رفع همه‌ی مسدودی‌ها",
  confirmResetMatch: "بازنشانی پیشنهادها",
  cancel: "↩️ لغو",
} as const;

export const INBOX_BUTTON = {
  block: "🚫 مسدود کردن",
  unblock: "🔓 رفع مسدودی",
  reply: "💬 پاسخ دادن",
  nickname: "🏷️ نام خصوصی",
  report: "⚠️ گزارش کردن",
  loadMore: "پیام‌های بیشتر",
} as const;

export const OPEN_INBOX_BUTTON = "📥 باز کردن صندوق";

/** Prefix for delivered anonymous messages (nickname inserted). */
export const DELIVERY_HEADER_FROM = (nickname: string): string =>
  `💬 پیام از ${nickname}:`;

const MAIN_MENU_LABELS = new Set<string>([
  MENU.link,
  MENU.inbox,
  MENU.matchSystem,
  MENU.settings,
]);

export const isMainMenuLabel = (text: string): boolean =>
  MAIN_MENU_LABELS.has(text);

export const MATCH_BUTTON = {
  search: "🔎 پیدا کردن گزینه‌ها",
  pending: "📥 درخواست‌های گفت‌وگو",
  profile: "👤 پروفایل گفت‌وگو",
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
  resetNo: "↩️ لغو",
  previous: "⬅️ قبلی",
  exit: "ذخیره و خروج",
  backToSuggestions: BACK_BUTTON.toSuggestions,
} as const;

/** Display names must not be empty or look like bot commands. */
export const isReservedDisplayName = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  return trimmed.startsWith("/");
};
