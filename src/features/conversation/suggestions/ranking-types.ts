import type { ConversationProfile } from "../../../contracts/conversation/profile";
import type { RetrievalChannel } from "../../../contracts/conversation/retrieval";

export type RankedCandidate = {
  profileHash: string;
  revision: number;
  profile: ConversationProfile;
  pairTag: string;
  channels: RetrievalChannel[];
  requesterToCandidate: number;
  candidateToRequester: number;
  reciprocalScore: number;
  intentAdjustment: number;
  finalScore: number;
  explanation: string;
};
