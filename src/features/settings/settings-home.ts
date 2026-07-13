import type { BotUser } from "../../contracts/identity/model";
import {
  SETTINGS_INBOX_STATUS_ACTIVE,
  SETTINGS_INBOX_STATUS_PAUSED,
  SETTINGS_HOME_MESSAGE,
} from "../../i18n/settings";
import { DISPLAY_NAME_UNSET } from "../../i18n/defaults";
import { escapeHtml } from "../../utils/text";
import { publicDisplayName } from "../../features/identity/user";

export const formatSettingsHome = (user: BotUser): string => {
  const paused = user.paused;
  return SETTINGS_HOME_MESSAGE.replace(
    "USER_NAME",
    escapeHtml(publicDisplayName(user, DISPLAY_NAME_UNSET))
  ).replace(
    "PAUSE_STATUS",
    paused ? SETTINGS_INBOX_STATUS_PAUSED : SETTINGS_INBOX_STATUS_ACTIVE
  );
};
