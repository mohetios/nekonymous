import type { ConversationProfile } from "../conversation-profile/types.ts";
import type { VectorRouteRole } from "../../storage/profile-vault/profile-vault.types";

export type SuggestionHubMenuVariant = "default" | "can_enable" | "can_disable";

export type SuggestionHubMenuOptions = {
  assessmentLabel: string;
  showFind: boolean;
  showProfile: boolean;
  discoverabilityVariant: SuggestionHubMenuVariant;
};

/** Requester desired vector queried against candidate self namespace. */
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
