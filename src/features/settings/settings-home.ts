import type { BotUser } from "../../types";
import {
  SETTINGS_HOME_MESSAGE,
  SETTINGS_PAUSE_ACTIVE,
  SETTINGS_PAUSE_DISABLE_DESC,
  SETTINGS_PAUSE_ENABLE_DESC,
  SETTINGS_PAUSE_INACTIVE,
} from "./settings-copy";
import { DISPLAY_NAME_UNSET } from "../../i18n/defaults";
import { escapeHtml } from "../../utils/tools";
import { publicDisplayName } from "../../utils/user";
import { MENU } from "../../bot/menu";

export const formatSettingsHome = (user: BotUser): string => {
  const paused = user.paused;
  return SETTINGS_HOME_MESSAGE.replace(
    "USER_NAME",
    escapeHtml(publicDisplayName(user, DISPLAY_NAME_UNSET))
  )
    .replace("PAUSE_STATUS", paused ? SETTINGS_PAUSE_INACTIVE : SETTINGS_PAUSE_ACTIVE)
    .replace(
      "PAUSE_ACTION_LABEL",
      paused ? MENU.resumeInbox : MENU.pauseInbox
    )
    .replace(
      "PAUSE_ACTION_DESC",
      paused ? SETTINGS_PAUSE_ENABLE_DESC : SETTINGS_PAUSE_DISABLE_DESC
    );
};
