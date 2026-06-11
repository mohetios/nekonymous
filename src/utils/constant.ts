import { InlineKeyboard, Keyboard, type Context } from "grammy";
import type { User } from "../types";
import {
  ABOUT_PRIVACY_COMMAND_MESSAGE,
  OWNER_PAUSED_NOTE,
  USER_LINK_MESSAGE,
} from "./messages";
import { assertCallbackData } from "./telegram-limits";
import { withHtml } from "./tools";
import { buildUserDeepLink } from "./user";

export const MENU = {
  about: "🛡️ درباره و حریم خصوصی",
  link: "🔗 دریافت لینک",
  settings: "⚙️ تنظیمات",
  editName: "✏️ نام نمایشی",
  cancelDraft: "↩️ لغو پیام ناتمام",
  pauseInbox: "🔕 توقف دریافت",
  resumeInbox: "🔔 فعال‌سازی دریافت",
  clearBlockList: "🔓 حذف بلاک‌ها",
  clearData: "🗑️ پاک کردن حساب",
  back: "🏠 بازگشت",
  confirmClear: "🗑️ بله، پاک کن",
  confirmClearBlocks: "🔓 بله، آنبلاک همه",
  cancel: "❌ انصراف",
} as const;

const INBOX_BUTTON = {
  block: "🚫 بلاک",
  unblock: "🔓 آنبلاک",
  reply: "💬 پاسخ",
  nickname: "🏷️ نام مستعار",
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

const INBOX_CALLBACK = {
  reply: (ref: string) => `rpl:${ref}`,
  block: (ref: string) => `blk:${ref}`,
  unblock: (ref: string) => `ubl:${ref}`,
  nickname: (ref: string) => `nnk:${ref}`,
} as const;

// Main menu keyboard used across various commands
export const mainMenu = new Keyboard()
  .text(MENU.about)
  .text(MENU.link)
  .row()
  .text(MENU.settings)
  .resized();

/** Shown while composing, replying, or naming — always offers a way out. */
export const buildDraftMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.cancelDraft)
    .text(MENU.settings)
    .row()
    .text(MENU.back)
    .resized();

/**
 * Grouped settings keyboard (RTL: first button = right on screen).
 * حساب | دریافت → خروج → حریم خصوصی → خطر
 */
export const buildSettingsMenu = (paused: boolean): Keyboard =>
  new Keyboard()
    .text(MENU.editName)
    .text(paused ? MENU.resumeInbox : MENU.pauseInbox)
    .row()
    .text(MENU.cancelDraft)
    .text(MENU.back)
    .row()
    .text(MENU.clearBlockList)
    .row()
    .text(MENU.clearData)
    .resized();

export const confirmClearBlocksMenu = new Keyboard()
  .text(MENU.confirmClearBlocks)
  .row()
  .text(MENU.cancel)
  .resized();

export const confirmClearMenu = new Keyboard()
  .text(MENU.confirmClear)
  .row()
  .text(MENU.cancel)
  .resized();

export const handleMenuCommand = async (
  ctx: Context,
  user: User
): Promise<boolean> => {
  const msgPayload = ctx.message?.text;

  switch (msgPayload) {
    case MENU.link: {
      const linkText = USER_LINK_MESSAGE.replace(
        "UUID_USER_URL",
        buildUserDeepLink(user.userUUID)
      );
      await ctx.reply(
        user.paused ? `${OWNER_PAUSED_NOTE}\n\n${linkText}` : linkText,
        withHtml({ reply_markup: mainMenu })
      );
      break;
    }
    case MENU.about:
      await ctx.reply(
        ABOUT_PRIVACY_COMMAND_MESSAGE,
        withHtml({ reply_markup: mainMenu })
      );
      break;
    default:
      return false;
  }

  return true;
};

export const createMessageKeyboard = (
  inboxRef: string,
  isBlocked: boolean
): InlineKeyboard => {
  const blockData = isBlocked
    ? INBOX_CALLBACK.unblock(inboxRef)
    : INBOX_CALLBACK.block(inboxRef);
  const replyData = INBOX_CALLBACK.reply(inboxRef);
  const nicknameData = INBOX_CALLBACK.nickname(inboxRef);

  assertCallbackData(blockData);
  assertCallbackData(replyData);
  assertCallbackData(nicknameData);

  return new InlineKeyboard()
    .text(isBlocked ? INBOX_BUTTON.unblock : INBOX_BUTTON.block, blockData)
    .text(INBOX_BUTTON.reply, replyData)
    .row()
    .text(INBOX_BUTTON.nickname, nicknameData);
};
