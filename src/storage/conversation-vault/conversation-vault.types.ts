export type SuggestionTicketStatus =
  | "created"
  | "viewed"
  | "dismissed"
  | "converted_to_request"
  | "expired";

export type RequestTicketStatus =
  | "pending"
  | "accepting"
  | "accepted"
  | "declined"
  | "canceled"
  | "expired";

export type SuggestionTicketRecord = {
  suggestionHash: string;
  requesterProofTag: string;
  candidateRouteEnc: string;
  pairTag: string;
  explanationEnc: string;
  status: SuggestionTicketStatus;
  createdAt: number;
  expiresAt: number;
};

export type StoreSuggestionInput = {
  suggestionHash: string;
  requesterProofTag: string;
  candidateRouteEnc: string;
  pairTag: string;
  explanationEnc: string;
  status: SuggestionTicketStatus;
  expiresAt: number;
};

export type RequestTicketRecord = {
  requestHash: string;
  requesterProofTag: string;
  candidateProofTag: string;
  requesterRouteEnc: string;
  candidateRouteEnc: string;
  introEnc: string | null;
  status: RequestTicketStatus;
  acceptOperationId?: string | null;
  acceptLeaseUntil?: number | null;
  acceptedTicketHash?: string | null;
  createdAt: number;
  expiresAt: number;
};

export type StoreRequestInput = {
  requestHash: string;
  requesterProofTag: string;
  candidateProofTag: string;
  requesterRouteEnc: string;
  candidateRouteEnc: string;
  introEnc: string;
  status: RequestTicketStatus;
  expiresAt: number;
};

export type SetSuggestionStatusResult =
  | { ok: true; status: SuggestionTicketStatus }
  | { ok: false; error: "not_found" | "conflict" | "invalid" };

export type SetRequestStatusResult =
  | { ok: true; status: RequestTicketStatus }
  | { ok: false; error: "not_found" | "conflict" | "invalid" };

export type ClaimRequestAcceptResult =
  | {
      ok: true;
      state: "acquired" | "processing" | "accepted";
      acceptedTicketHash?: string | null;
    }
  | { ok: false; error: "not_found" | "conflict" | "expired" | "invalid" };
