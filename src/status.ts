/**
 * Domain status unions shared across features and storage.
 * Keep feature-specific row DTOs importing from here instead of `string`.
 */

/** Recipient inbox pointer lifecycle in UserState DO. */
export type InboxPointerStatus =
  | "active"
  | "viewed"
  | "replied"
  | "blocked"
  | "reported";

/** Status transitions via POST /mark-inbox-status (initial state is active). */
export type InboxPointerTransitionStatus = Exclude<
  InboxPointerStatus,
  "active"
>;

/** D1 users.status — account reset hard-deletes rows; no soft-delete status. */
export type D1UserStatus = "active";

/** UserState DO draft.mode — compose/reply/input flows. */
export type UserDraftMode =
  | "compose"
  | "reply"
  | "nickname"
  | "display_name"
  | "settings"
  | "conversation_intro";

/** TelegramOutbox DO sent_events.status */
export type TelegramOutboxSendStatus = "pending" | "sent" | "failed";

const INBOX_POINTER_TRANSITIONS: readonly InboxPointerTransitionStatus[] = [
  "viewed",
  "replied",
  "blocked",
  "reported",
];

export const isInboxPointerTransition = (
  value: string
): value is InboxPointerTransitionStatus =>
  (INBOX_POINTER_TRANSITIONS as readonly string[]).includes(value);
