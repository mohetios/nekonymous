/**
 * Shared Telegram callback_data contracts for inbox ticket actions.
 * Used by keyboards (encode), register-handlers (regex routing), and validation.
 */

/** 24-byte random ref encoded as base64url → 32 characters. */
export const CALLBACK_REF_PATTERN = "[A-Za-z0-9_-]{32}";

export const CALLBACK_REF_RE = new RegExp(`^${CALLBACK_REF_PATTERN}$`);

export const isCallbackRef = (value: string): boolean => CALLBACK_REF_RE.test(value);

export type InboxCallbackAction =
  | "open"
  | "reply"
  | "block"
  | "unblock"
  | "report"
  | "nickname";

export const INBOX_CALLBACK_PREFIX: Record<InboxCallbackAction, string> = {
  open: "o",
  reply: "r",
  block: "b",
  unblock: "u",
  report: "rp",
  nickname: "n",
};

export const INBOX_CALLBACK = {
  open: (ref: string) => `${INBOX_CALLBACK_PREFIX.open}:${ref}`,
  reply: (ref: string) => `${INBOX_CALLBACK_PREFIX.reply}:${ref}`,
  block: (ref: string) => `${INBOX_CALLBACK_PREFIX.block}:${ref}`,
  unblock: (ref: string) => `${INBOX_CALLBACK_PREFIX.unblock}:${ref}`,
  report: (ref: string) => `${INBOX_CALLBACK_PREFIX.report}:${ref}`,
  nickname: (ref: string) => `${INBOX_CALLBACK_PREFIX.nickname}:${ref}`,
} as const;

export const encodeInboxCallbackData = (
  action: InboxCallbackAction,
  ticketRef: string
): string => {
  const data = INBOX_CALLBACK[action](ticketRef);
  if (new TextEncoder().encode(data).length > 64) {
    throw new Error("Telegram callback_data limit exceeded");
  }
  return data;
};

export const inboxCallbackQueryRegex = (
  action: InboxCallbackAction
): RegExp =>
  new RegExp(`^${INBOX_CALLBACK_PREFIX[action]}:(${CALLBACK_REF_PATTERN})$`);

/** Inline keyboard shortcuts for inbox navigation. */
export const INBOX_MENU_CALLBACK = {
  open: "ib:open",
  more: (offset: number) => `ib:m:${offset}`,
} as const;
