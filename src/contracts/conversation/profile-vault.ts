export type ProfileVaultRecordStatus =
  | "private"
  | "indexing"
  | "discoverable"
  | "disabled"
  | "index_failed"
  | "invalidated"
  | "restricted";

export type VectorRouteRole = "self" | "desired";

export type VectorRouteStatus = "pending" | "active" | "deleted";

export type IndexJobStatus = "pending" | "completed" | "expired";

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

export type StoreProfileInput = {
  profileHash: string;
  ownerProofTag: string;
  profileEnc: string;
  routeEnc: string;
  revision: number;
  status: ProfileVaultRecordStatus;
};

export type StoreIndexJobInput = {
  jobHash: string;
  routeEnc: string;
  revision: number;
  status: IndexJobStatus;
  expiresAt: number;
};

export type ProfileIndexJobRecord = {
  jobHash: string;
  routeEnc: string;
  revision: number;
  status: IndexJobStatus;
  vectorsEnc: string | null;
  createdAt: number;
  expiresAt: number;
};

export type StoreVectorRouteInput = {
  vectorHash: string;
  vectorRouteEnc: string;
  role: VectorRouteRole;
  revision: number;
  status: VectorRouteStatus;
};

export type ProfileVectorRouteRecord = {
  vectorHash: string;
  vectorRouteEnc: string;
  role: VectorRouteRole;
  revision: number;
  status: VectorRouteStatus;
  createdAt: number;
  updatedAt: number;
};
