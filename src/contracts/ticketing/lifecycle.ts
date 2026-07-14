export const TICKET_STATUSES = [
  "active",
  "viewed",
  "replied",
  "expired",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketTransitionStatus = Extract<
  TicketStatus,
  "viewed" | "replied"
>;
