// Shared inbox bounds for UserState storage and inbox drain delivery.
// UserState accepts at most INBOX_MAX_UNREAD live unread tickets, and each
// drain pass delivers no more than INBOX_DELIVERY_LIMIT tickets.
export const INBOX_MAX_UNREAD = 50;
export const INBOX_DELIVERY_LIMIT = 50;
