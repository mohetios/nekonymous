import type { RequestTicketStatus } from "../../contracts/conversation/vault";

const TERMINAL_REQUEST_STATUSES = new Set<RequestTicketStatus>([
  "accepted",
  "declined",
  "canceled",
  "expired",
]);

const ALLOWED_TRANSITIONS: Record<
  RequestTicketStatus,
  Set<RequestTicketStatus>
> = {
  pending: new Set(["accepting", "declined", "canceled", "expired"]),
  accepting: new Set(["accepted", "expired"]),
  accepted: new Set(),
  declined: new Set(),
  canceled: new Set(),
  expired: new Set(),
};

export const isTerminalRequestStatus = (
  status: RequestTicketStatus
): boolean => TERMINAL_REQUEST_STATUSES.has(status);

export const canTransitionRequestStatus = (
  current: RequestTicketStatus,
  next: RequestTicketStatus
): boolean => ALLOWED_TRANSITIONS[current]?.has(next) ?? false;

export const effectiveRequestStatus = (
  status: RequestTicketStatus,
  expiresAt: number,
  now = Date.now()
): RequestTicketStatus => {
  if (isTerminalRequestStatus(status)) {
    return status;
  }
  if (expiresAt <= now) {
    return "expired";
  }
  return status;
};

export const shouldClearRequestIntro = (status: RequestTicketStatus): boolean =>
  isTerminalRequestStatus(status);
