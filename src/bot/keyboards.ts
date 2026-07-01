import { InlineKeyboard, Keyboard } from "grammy";
import type { MatchHubMenuOptions, MatchHubMenuVariant } from "../features/matching/match-types";
import { SETTINGS_CALLBACK } from "../features/settings/constants";
import { MATCH_SYSTEM_CALLBACK } from "../features/matching/match-system-callbacks";
import {
  encodeInboxCallbackData,
  type InboxCallbackAction,
} from "../utils/telegram-callbacks";
import { CONFIRM_BUTTON, INBOX_BUTTON, MENU } from "./menu-labels";

const inboxCallback = (action: InboxCallbackAction, ticketRef: string): string =>
  encodeInboxCallbackData(action, ticketRef);

export const mainMenu = new Keyboard()
  .text(MENU.link)
  .row()
  .text(MENU.matchSystem)
  .text(MENU.settings)
  .resized();

/** Conversation-suggestions hub — navigation only. */
export const buildMatchSystemMenu = (options: MatchHubMenuOptions): Keyboard => {
  const keyboard = new Keyboard();

  if (options.showFind) {
    keyboard.text(MENU.matchFind).row();
  }

  keyboard.text(MENU.matchPending);

  if (options.showProfile) {
    keyboard.text(MENU.matchProfile);
  }

  keyboard.row().text(options.assessmentLabel).row().text(MENU.home).resized();

  return keyboard;
};

export const buildMatchHubDiscoverabilityKeyboard = (
  variant: MatchHubMenuVariant
): InlineKeyboard | undefined => {
  if (variant === "can_enable") {
    return new InlineKeyboard().text(
      MENU.matchEnable,
      MATCH_SYSTEM_CALLBACK.enable
    );
  }
  if (variant === "can_disable") {
    return new InlineKeyboard().text(
      MENU.matchDisable,
      MATCH_SYSTEM_CALLBACK.disable
    );
  }
  return undefined;
};

export const buildMatchProfileEmptyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchAssessment)
    .row()
    .text(MENU.hubBack)
    .resized();

export const buildMatchProfileReadyMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.matchFind)
    .text(MENU.matchProfile)
    .row()
    .text(MENU.matchAssessmentRetry)
    .row()
    .text(MENU.hubBack)
    .resized();

/** Shown while composing, replying, or naming — always offers a way out. */
export const buildDraftMenu = (): Keyboard =>
  new Keyboard()
    .text(MENU.cancelDraft)
    .text(MENU.settings)
    .row()
    .text(MENU.home)
    .resized();

/** Settings page — navigation and non-destructive actions only. */
export const buildSettingsMenu = (paused: boolean): Keyboard =>
  new Keyboard()
    .text(MENU.editName)
    .text(paused ? MENU.resumeInbox : MENU.pauseInbox)
    .row()
    .text(MENU.about)
    .text(MENU.technical)
    .row()
    .text(MENU.stats)
    .row()
    .text(MENU.clearBlockList)
    .text(MENU.resetMatchHistory)
    .row()
    .text(MENU.clearData)
    .row()
    .text(MENU.home)
    .resized();

export const buildStatsPageKeyboard = (): InlineKeyboard =>
  new InlineKeyboard().text("↩️ بازگشت به تنظیمات", SETTINGS_CALLBACK.back);

export const buildConfirmClearDataKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(CONFIRM_BUTTON.yesDelete, SETTINGS_CALLBACK.confirmClearData)
    .row()
    .text(CONFIRM_BUTTON.noCancel, SETTINGS_CALLBACK.cancel);

export const buildConfirmClearBlocksKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(CONFIRM_BUTTON.yes, SETTINGS_CALLBACK.confirmClearBlocks)
    .row()
    .text(CONFIRM_BUTTON.noCancel, SETTINGS_CALLBACK.cancel);

export const buildConfirmResetMatchKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(CONFIRM_BUTTON.yes, SETTINGS_CALLBACK.confirmResetMatch)
    .row()
    .text(CONFIRM_BUTTON.noCancel, SETTINGS_CALLBACK.cancel);

export const createMessageKeyboard = (
  capability: string,
  isBlocked: boolean
): InlineKeyboard => {
  const blockData = isBlocked
    ? inboxCallback("unblock", capability)
    : inboxCallback("block", capability);
  const replyData = inboxCallback("reply", capability);
  const nicknameData = inboxCallback("nickname", capability);
  const reportData = inboxCallback("report", capability);

  return new InlineKeyboard()
    .text(INBOX_BUTTON.reply, replyData)
    .row()
    .text(INBOX_BUTTON.nickname, nicknameData)
    .text(isBlocked ? INBOX_BUTTON.unblock : INBOX_BUTTON.block, blockData)
    .row()
    .text(INBOX_BUTTON.report, reportData);
};
