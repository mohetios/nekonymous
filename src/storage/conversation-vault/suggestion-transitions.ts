import type { SuggestionTicketStatus } from "./conversation-vault.types";

const TERMINAL_SUGGESTION_STATUSES = new Set<SuggestionTicketStatus>([
  "dismissed",
  "converted_to_request",
  "expired",
]);

const ALLOWED_TRANSITIONS: Record<
  SuggestionTicketStatus,
  Set<SuggestionTicketStatus>
> = {
  created: new Set(["viewed", "dismissed", "converted_to_request", "expired"]),
  viewed: new Set(["dismissed", "converted_to_request", "expired"]),
  dismissed: new Set(),
  converted_to_request: new Set(),
  expired: new Set(),
};

export const isTerminalSuggestionStatus = (
  status: SuggestionTicketStatus
): boolean => TERMINAL_SUGGESTION_STATUSES.has(status);

export const canTransitionSuggestionStatus = (
  current: SuggestionTicketStatus,
  next: SuggestionTicketStatus
): boolean => ALLOWED_TRANSITIONS[current]?.has(next) ?? false;

export const effectiveSuggestionStatus = (
  status: SuggestionTicketStatus,
  expiresAt: number,
  now = Date.now()
): SuggestionTicketStatus => {
  if (isTerminalSuggestionStatus(status)) {
    return status;
  }
  if (expiresAt <= now) {
    return "expired";
  }
  return status;
};
