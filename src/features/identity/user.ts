import type { BotUser } from "../../contracts/identity/model";
import {
  DISPLAY_NAME_EMPTY,
  DISPLAY_NAME_FALLBACK,
} from "../../i18n/defaults";
import { isReservedDisplayName } from "../../bot/menu";

export {
  buildUserDeepLink,
  isPublicSlug as isUserLinkId,
} from "./identity-service";

const DISPLAY_NAME_MAX_CHARS = 64;

export const sanitizeDisplayName = (input: string): string | null => {
  const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned || isReservedDisplayName(cleaned)) {
    return null;
  }

  return [...cleaned].slice(0, DISPLAY_NAME_MAX_CHARS).join("");
};

export const publicDisplayName = (
  user: BotUser | null | undefined,
  fallback = DISPLAY_NAME_FALLBACK
): string => {
  const name = user?.displayName?.trim();
  if (!name || name === DISPLAY_NAME_EMPTY || isReservedDisplayName(name)) {
    return fallback;
  }

  return name;
};
