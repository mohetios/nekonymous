import type {
  ProfileVaultRecordStatus,
  VectorRouteRole,
  VectorRouteStatus,
} from "../../storage/profile-vault/profile-vault.types";
import type {
  RequestTicketStatus,
  SuggestionTicketStatus,
} from "../../storage/conversation-vault/conversation-vault.types";
import { isCapabilityRef } from "./conversation-keys.ts";

export const SUGGESTION_CAPABILITY_TTL_MS = 2 * 60 * 60 * 1000;
export const REQUEST_CAPABILITY_TTL_MS = 72 * 60 * 60 * 1000;
export const INDEX_JOB_CAPABILITY_TTL_MS = 15 * 60 * 1000;

export type ProfileRouteCapsule = {
  revision: number;
  /** Internal user id for request delivery; only inside encrypted route capsule. */
  deliveryUserId?: string;
  selfVectorizeId?: string;
  desiredVectorizeId?: string;
};

export type VectorRouteCapsule = {
  revision: number;
  vectorizeId: string;
  role: VectorRouteRole;
  profileHash: string;
};

export type IndexJobRouteCapsule = {
  revision: number;
  profileHash: string;
};

export type IndexJobVectorsCapsule = {
  selfVectorizeId: string;
  desiredVectorizeId: string;
};

export type SuggestionRouteCapsule = {
  candidateProfileHash: string;
};

export type RequestRouteCapsule = {
  requesterProfileHash: string;
  candidateProfileHash: string;
  requesterUserId: string;
  pairTag: string;
};

export type ProfileVaultRecord = {
  profileHash: string;
  ownerProofTag: string;
  profileEnc: string;
  routeEnc: string;
  revision: number;
  status: ProfileVaultRecordStatus;
  createdAt: number;
  updatedAt: number;
};

export type VectorRouteRecord = {
  vectorHash: string;
  vectorRouteEnc: string;
  role: VectorRouteRole;
  revision: number;
  status: VectorRouteStatus;
  createdAt: number;
  updatedAt: number;
};

export type IndexJobRecord = {
  jobHash: string;
  routeEnc: string;
  revision: number;
  status: "pending" | "completed" | "expired";
  createdAt: number;
  expiresAt: number;
};

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

export class CapabilityInvalidError extends Error {
  constructor(message = "Invalid capability") {
    super(message);
    this.name = "CapabilityInvalidError";
  }
}

export class CapabilityExpiredError extends Error {
  constructor(message = "Capability expired") {
    super(message);
    this.name = "CapabilityExpiredError";
  }
}

export class CapabilityProofError extends Error {
  constructor(message = "Capability proof mismatch") {
    super(message);
    this.name = "CapabilityProofError";
  }
}

export class CapabilityStateError extends Error {
  constructor(message = "Capability state rejected") {
    super(message);
    this.name = "CapabilityStateError";
  }
}

export const assertCapabilityRef = (value: string, label: string): string => {
  if (!isCapabilityRef(value)) {
    throw new CapabilityInvalidError(`${label} shape rejected`);
  }
  return value;
};

export const isExpiredAt = (expiresAt: number, now = Date.now()): boolean =>
  expiresAt <= now;

export const terminalSuggestionStatuses = new Set<SuggestionTicketStatus>([
  "dismissed",
  "converted_to_request",
  "expired",
]);

export const terminalRequestStatuses = new Set<RequestTicketStatus>([
  "accepted",
  "declined",
  "canceled",
  "expired",
]);

export const activeProfileStatuses = new Set<ProfileVaultRecordStatus>([
  "private",
  "indexing",
  "discoverable",
  "index_failed",
]);
