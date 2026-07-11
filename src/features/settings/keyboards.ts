import { InlineKeyboard } from "grammy";
import { BACK_BUTTON, CONFIRM_BUTTON, MENU } from "../../i18n/labels";
import { PROJECT_INTRO_URL } from "../../i18n/messages";
import { SETTINGS_CALLBACK } from "./constants";

export const buildSettingsHomeKeyboard = (paused: boolean): InlineKeyboard =>
  new InlineKeyboard()
    .text(MENU.editName, SETTINGS_CALLBACK.editName)
    .row()
    .text(
      paused ? MENU.resumeInbox : MENU.pauseInbox,
      paused ? SETTINGS_CALLBACK.resume : SETTINGS_CALLBACK.pause
    )
    .row()
    .text(MENU.clearBlockList, SETTINGS_CALLBACK.clearBlocks)
    .text(MENU.resetMatchHistory, SETTINGS_CALLBACK.resetMatch)
    .row()
    .text(MENU.about, SETTINGS_CALLBACK.about)
    .text(MENU.stats, SETTINGS_CALLBACK.stats)
    .row()
    .text(MENU.clearData, SETTINGS_CALLBACK.clearData);

export const buildSettingsBackKeyboard = (): InlineKeyboard =>
  new InlineKeyboard().text(
    BACK_BUTTON.toSettings,
    SETTINGS_CALLBACK.home
  );

export const buildSettingsAboutKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .url(MENU.projectIntro, PROJECT_INTRO_URL)
    .row()
    .text(BACK_BUTTON.toSettings, SETTINGS_CALLBACK.home);

export const buildConfirmClearDataKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(CONFIRM_BUTTON.yesDelete, SETTINGS_CALLBACK.confirmClearData)
    .row()
    .text(CONFIRM_BUTTON.cancel, SETTINGS_CALLBACK.cancel);

export const buildConfirmClearBlocksKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(CONFIRM_BUTTON.confirmClearBlocks, SETTINGS_CALLBACK.confirmClearBlocks)
    .row()
    .text(CONFIRM_BUTTON.cancel, SETTINGS_CALLBACK.cancel);

export const buildConfirmResetMatchKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(CONFIRM_BUTTON.confirmResetMatch, SETTINGS_CALLBACK.confirmResetMatch)
    .row()
    .text(CONFIRM_BUTTON.cancel, SETTINGS_CALLBACK.cancel);
