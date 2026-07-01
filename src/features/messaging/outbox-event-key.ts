export const messageCreatedOutboxEventKey = (ticketHash: string): string =>
  `outbox:message-created:${ticketHash}`;
