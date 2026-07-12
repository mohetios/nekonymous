import type { ConversationProfile } from "../profile/types.ts";
import type { RetrievalChannel } from "./types.ts";

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
