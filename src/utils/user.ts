import type { BotUser } from "../types";
import { isReservedDisplayName } from "../bot/menu";

export {
  buildUserDeepLink,
  isPublicSlug as isUserLinkId,
} from "../features/identity/identity-service";

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
  fallback = "کاربر"
): string => {
  const name = user?.displayName?.trim();
  if (!name || name === "بدون نام!" || isReservedDisplayName(name)) {
    return fallback;
  }

  return name;
};
