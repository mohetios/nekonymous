import type { ConversationProfile } from "../conversation-profile/types.ts";
import type { RetrievalChannel } from "../conversation-suggestions/types.ts";

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

export type RankedCandidateDraft = Omit<
  RankedCandidate,
  "finalScore" | "explanation"
> & {
  explanation?: string;
};
