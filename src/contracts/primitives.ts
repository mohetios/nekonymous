declare const brand: unique symbol;

export type Brand<T, Name extends string> = T & {
  readonly [brand]?: Name;
};

export type InternalAccountId = Brand<string, "InternalAccountId">;
export type TelegramMessageId = Brand<number, "TelegramMessageId">;

export type ActorHash = Brand<string, "ActorHash">;

export type TicketHash = Brand<string, "TicketHash">;
export type EncodedTicketCapability = Brand<string, "EncodedTicketCapability">;
export type OwnerProofTag = Brand<string, "OwnerProofTag">;

export type ContactTag = Brand<string, "ContactTag">;
export type BlockTag = Brand<string, "BlockTag">;
export type AbuseSubjectTag = Brand<string, "AbuseSubjectTag">;
export type ReportEventTag = Brand<string, "ReportEventTag">;
export type ReporterSubjectTag = Brand<string, "ReporterSubjectTag">;
export type InboxDedupeTag = Brand<string, "InboxDedupeTag">;

export type UnreadItemId = Brand<string, "UnreadItemId">;
export type InboxNotificationCycleId = Brand<
  string,
  "InboxNotificationCycleId"
>;
export type DeliveryAttemptId = Brand<string, "DeliveryAttemptId">;
export type QueueRequestId = Brand<string, "QueueRequestId">;

export type Ciphertext = Brand<string, "Ciphertext">;
export type Base64Url = Brand<string, "Base64Url">;
export type UnixMillis = Brand<number, "UnixMillis">;

export const asEncodedTicketCapability = (
  value: string
): EncodedTicketCapability => value;
