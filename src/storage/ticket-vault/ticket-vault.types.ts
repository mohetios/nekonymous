export type TicketVaultStatus =
  | "active"
  | "viewed"
  | "replied"
  | "reported"
  | "blocked"
  | "expired";

export type TicketVaultRecord = {
  ticketHash: string;
  ownerProofTag: string;
  routeEnc: string | null;
  payloadEnc: string | null;
  metaEnc?: string | null;
  status: TicketVaultStatus;
  createdAt: number;
  expiresAt: number;
};

export type StoreTicketInput = {
  ticketHash: string;
  ownerProofTag: string;
  routeEnc: string;
  payloadEnc: string;
  metaEnc?: string;
  status?: TicketVaultStatus;
  createdAt: number;
  expiresAt: number;
};

export type StoreTicketResult = {
  ok: boolean;
  duplicate?: boolean;
  invalid?: boolean;
};

export type TicketVaultGetResult =
  | { status: "found"; record: TicketVaultRecord }
  | { status: "not_found" }
  | { status: "expired" };

export type TicketTransitionStatus = "viewed" | "replied" | "blocked" | "reported";
