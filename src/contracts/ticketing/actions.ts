import type { EncodedTicketCapability } from "../primitives";
import type { RouteCapsule } from "./model";
import type { TicketVaultRecord } from "./storage";

export type TicketActionKind =
  | "open"
  | "reply"
  | "block"
  | "unblock"
  | "report"
  | "nickname";

export type ResolvedTicketAction = Readonly<{
  action: TicketActionKind;
  ticketRef: EncodedTicketCapability;
  ticketHash: string;
  actorHash: string;
  actorUserId: string;
  ticket: TicketVaultRecord;
  routeKey: CryptoKey;
  payloadKey: CryptoKey;
  metaKey: CryptoKey;
  route: RouteCapsule;
}>;

export type ExpiredTicketAction = Readonly<{
  expired: true;
}>;

export type ResolveTicketActionResult =
  | ResolvedTicketAction
  | ExpiredTicketAction;
