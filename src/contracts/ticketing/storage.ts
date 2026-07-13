import type { OwnerProofTag, TicketHash, UnixMillis } from "../primitives";
import type {
  EncryptedTicketMetadata,
  EncryptedTicketPayload,
  EncryptedTicketRoute,
} from "../crypto";
import type { TicketStatus, TicketTransitionStatus } from "./lifecycle";

export type TicketVaultRecord = Readonly<{
  ticketHash: TicketHash;
  ownerProofTag: OwnerProofTag;
  routeEnc: EncryptedTicketRoute | null;
  payloadEnc: EncryptedTicketPayload | null;
  metaEnc?: EncryptedTicketMetadata | null;
  status: TicketStatus;
  createdAt: UnixMillis;
  expiresAt: UnixMillis;
}>;

export type StoreTicketInput = Readonly<{
  ticketHash: TicketHash;
  ownerProofTag: OwnerProofTag;
  routeEnc: EncryptedTicketRoute;
  payloadEnc: EncryptedTicketPayload;
  metaEnc?: EncryptedTicketMetadata;
  status?: TicketStatus;
  createdAt: UnixMillis;
  expiresAt: UnixMillis;
}>;

export type StoreTicketResult = Readonly<{
  ok: boolean;
  duplicate?: boolean;
  invalid?: boolean;
}>;

export type TicketVaultGetResult =
  | Readonly<{ status: "found"; record: TicketVaultRecord }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "expired" }>;

export type { TicketTransitionStatus };
