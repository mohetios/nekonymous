import type {
  AbuseSubjectTag,
  ActorHash,
  BlockTag,
  ContactTag,
  TelegramMessageId,
  TicketHash,
  UnixMillis,
} from "../primitives";
import type { MessagePayload } from "../telegram/delivery";
import type { D1User } from "../identity/model";

export type RouteCapsule = Readonly<{
  senderChatRoute: string;
  replyRouteTag: ActorHash;
  contactTag: ContactTag;
  blockTag: BlockTag;
  abuseSubjectTag: AbuseSubjectTag;
  replyPolicy: Readonly<{
    canReply: boolean;
    maxChars: number;
  }>;
  parentMessageId?: TelegramMessageId;
  replyToMessageId?: TelegramMessageId;
}>;

export type TicketPayloadCapsule =
  | Readonly<{
      type: "text";
      text: string;
      telegramMessageId: TelegramMessageId;
      createdAt: UnixMillis;
    }>
  | Readonly<{
      type: "telegram";
      payload: MessagePayload;
      createdAt: UnixMillis;
    }>;

export type TicketMetadata = Readonly<{
  displayNumber: string;
  createdAt: UnixMillis;
}>;

export type CreateSealedTicketInput = Readonly<{
  sender: D1User;
  recipient: D1User;
  payload: MessagePayload;
  linkSlug: string;
  isThreadReply: boolean;
  replyToMessageId?: TelegramMessageId;
  dedupeKey?: string;
}>;

export type CreateSealedTicketResult = Readonly<{
  ok: boolean;
  status: number;
  pendingCount?: number;
  duplicate?: boolean;
  ticketHash?: TicketHash;
}>;

export type SendMessageInput = Readonly<CreateSealedTicketInput>;
