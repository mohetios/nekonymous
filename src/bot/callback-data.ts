import {
  TICKET_CAPABILITY_PATTERN,
  validateTicketCapability,
} from "../features/ticketing/ticket-capability.ts";

/**
 * Shared Telegram callback_data contracts for inbox ticket actions.
 * Used by keyboards (encode), register-handlers (regex routing), and validation.
 */

/** Ticket capabilities are 43-character unpadded base64url values. */
export const CALLBACK_REF_PATTERN = TICKET_CAPABILITY_PATTERN;
export const CALLBACK_REF_RE = new RegExp(`^${CALLBACK_REF_PATTERN}$`);

export const isCallbackRef = (value: string): boolean =>
  validateTicketCapability(value);

export type InboxCallbackAction =
  | "reply"
  | "block"
  | "unblock"
  | "report"
  | "nickname";

export const INBOX_CALLBACK_PREFIX: Record<InboxCallbackAction, string> = {
  reply: "r",
  block: "b",
  unblock: "u",
  report: "rp",
  nickname: "n",
};

export const INBOX_CALLBACK = {
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
  deliver: "ib:d",
} as const;
