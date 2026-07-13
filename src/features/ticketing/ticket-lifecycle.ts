export const TICKET_RETENTION_DAYS = 30;
export const TICKET_RETENTION_MS =
  TICKET_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export const ticketExpiresAt = (createdAt: number): number =>
  createdAt + TICKET_RETENTION_MS;

export const displayNumberForTicketHash = (ticketHash: string): string =>
  `NQ-${ticketHash.slice(0, 4).toUpperCase()}`;
