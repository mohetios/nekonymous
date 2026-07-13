import type { ConversationProfile } from "./profile";
import type { VectorRouteRole } from "./profile-vault";

export type RetrievalChannel = "desired_to_self" | "self_to_desired";

export type VectorHit = {
  vectorizeId: string;
  channel: RetrievalChannel;
};

export type ResolvedVectorHit = {
  vectorizeId: string;
  channel: RetrievalChannel;
  profileHash: string;
  revision: number;
  role: VectorRouteRole;
};

export type CandidateProfile = {
  profileHash: string;
  revision: number;
  profile: ConversationProfile;
  channels: RetrievalChannel[];
};

export type RetrievalRequest = {
  requesterProfileHash: string;
  requesterProfile: ConversationProfile;
};

export type RetrievalResult = {
  candidates: CandidateProfile[];
  vectorHits: number;
  resolvedHits: number;
};
