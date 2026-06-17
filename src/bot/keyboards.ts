import { InlineKeyboard, Keyboard } from "grammy";
import type { MatchHubMenuVariant } from "../features/matching/match-types";
import { assertCallbackData } from "../utils/telegram-limits";
import { MENU } from "./menu-labels";

const INBOX_BUTTON = {
  block: "🚫 مسدود",
  unblock: "🔓 رفع مسدودیت",
  reply: "💬 پاسخ",
  nickname: "🏷️ نام خصوصی",
} as const;

const INBOX_CALLBACK = {
  reply: (ref: string) => `r:${ref}`,
  block: (ref: string) => `b:${ref}`,
  unblock: (ref: string) => `u:${ref}`,
  nickname: (ref: string) => `n:${ref}`,
} as const;

export const mainMenu = new Keyboard()
  .text(MENU.link)
  .text(MENU.matchSystem)
  .row()
  .text(MENU.settings)
  .resized();

/** Match-system submenu on the reply keyboard (not inline under messages). */
export const buildMatchSystemMenu = (
  variant: MatchHubMenuVariant = "default"
): Keyboard => {
  const keyboard = new Keyboard()
    .text(MENU.matchProfile)
    .text(MENU.matchFind)
    .row()
    .text(MENU.matchPending)
    .text(MENU.matchAssessment);

  if (variant === "can_enable") {
    keyboard.row().text(MENU.matchEnable);
  } else if (variant === "can_disable") {
    keyboard.row().text(MENU.matchDisable);
  }

  return keyboard.row().text(MENU.back).resized();
};

export const buildMatchProfileEmptyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchAssessment)
    .row()
    .text(MENU.matchBackToHub)
    .text(MENU.back)
    .resized();

export const buildMatchProfileReadyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchFind)
    .text(MENU.matchAssessmentRetry)
    .row()
    .text(MENU.matchBackToHub)
    .text(MENU.back)
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
 * Settings keyboard (RTL: first button on each row = right on screen).
 * Three short labels per row to avoid overflow on mobile.
 */
export const buildSettingsMenu = (paused: boolean): Keyboard =>
  new Keyboard()
    .text(MENU.editName)
    .text(paused ? MENU.resumeInbox : MENU.pauseInbox)
    .text(MENU.clearBlockList)
    .row()
    .text(MENU.resetMatchHistory)
    .text(MENU.about)
    .text(MENU.technical)
    .row()
    .text(MENU.clearData)
    .text(MENU.cancelDraft)
    .text(MENU.back)
    .resized();

export const confirmClearBlocksMenu = new Keyboard()
  .text(MENU.confirmClearBlocks)
  .row()
  .text(MENU.cancel)
  .resized();

export const confirmResetMatchHistoryMenu = new Keyboard()
  .text(MENU.confirmResetMatchHistory)
  .row()
  .text(MENU.cancel)
  .resized();

export const confirmClearMenu = new Keyboard()
  .text(MENU.confirmClear)
  .row()
  .text(MENU.cancel)
  .resized();

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
