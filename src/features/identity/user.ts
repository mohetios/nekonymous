import type { BotUser } from "../../contracts/identity/model";
import {
  DISPLAY_NAME_DEFAULT,
  DISPLAY_NAME_EMPTY,
} from "../../i18n/defaults";
import { isReservedDisplayName } from "../../bot/menu";
import { stripControlCharacters, truncateGraphemes } from "../../utils/text";

export {
  buildUserDeepLink,
  isPublicSlug as isUserLinkId,
} from "./identity-service";

const DISPLAY_NAME_MAX_CHARS = 64;

export const sanitizeDisplayName = (input: string): string | null => {
  const cleaned = stripControlCharacters(input).trim();
  if (!cleaned || isReservedDisplayName(cleaned)) {
    return null;
  }

  return truncateGraphemes(cleaned, DISPLAY_NAME_MAX_CHARS);
};

export const publicDisplayName = (
  user: BotUser | null | undefined,
  defaultName = DISPLAY_NAME_DEFAULT
): string => {
  const name = user?.displayName?.trim();
  if (!name || name === DISPLAY_NAME_EMPTY || isReservedDisplayName(name)) {
    return defaultName;
  }

  return name;
};
