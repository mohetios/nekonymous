import type { Context } from "grammy";
import type { BotUser } from "../types";
import {
  OWNER_PAUSED_NOTE,
  USER_LINK_MESSAGE,
} from "../i18n/messages";
import { withHtml } from "../utils/tools";
import { buildUserDeepLink } from "../utils/user";
import { mainMenu } from "./keyboards";

export const MENU = {
  about: "🛡️ درباره و حریم خصوصی",
  privacy: "🔒 حریم خصوصی",
  link: "🔗 لینک من",
  matchSystem: "🧭 مچ‌یابی",
  matchProfile: "👤 پروفایل من",
  matchFind: "🔎 پیدا کردن مچ",
  matchPending: "📥 درخواست‌های در انتظار",
  matchEnable: "✅ فعال کردن مچ‌یابی",
  matchDisable: "⏸️ توقف مچ‌یابی",
  matchAssessment: "📝 اجرای تست",
  matchRetest: "📝 اجرای دوباره تست",
  matchBackToHub: "↩️ مچ‌یابی",
  settings: "⚙️ تنظیمات",
  editName: "✏️ نام نمایشی",
  cancelDraft: "↩️ لغو پیام ناتمام",
  pauseInbox: "🔕 توقف دریافت",
  resumeInbox: "🔔 فعال‌سازی دریافت",
  clearBlockList: "🔓 حذف بلاک‌ها",
  clearData: "🗑️ پاک کردن حساب",
  technical: "📐 معماری فنی",
  back: "🏠 بازگشت",
  confirmClear: "🗑️ بله، پاک کن",
  confirmClearBlocks: "🔓 بله، آنبلاک همه",
  cancel: "❌ انصراف",
} as const;

const MENU_LABELS = new Set<string>(Object.values(MENU));

export const isMenuLabel = (text: string): boolean => MENU_LABELS.has(text);

/** Strip emoji/symbols so "تنظیمات" matches "⚙️ تنظیمات". */
const plainMenuLabel = (text: string): string =>
  text.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "").trim();

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

export const handleMenuCommand = async (
  ctx: Context,
  user: BotUser,
  botUsername: string
): Promise<boolean> => {
  const msgPayload = ctx.message?.text;

  switch (msgPayload) {
    case MENU.link: {
      const linkText = USER_LINK_MESSAGE.replace(
        "UUID_USER_URL",
        buildUserDeepLink(botUsername, user.slug)
      );
      await ctx.reply(
        user.paused ? `${OWNER_PAUSED_NOTE}\n\n${linkText}` : linkText,
        withHtml({ reply_markup: mainMenu })
      );
      break;
    }
    default:
      return false;
  }

  return true;
};
