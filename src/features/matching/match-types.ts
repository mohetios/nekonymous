import type { MatchQualityLabel } from "./match-quality";

export type { MatchQualityLabel };

export type MatchExplanation = {
  title: string;
  reasons: string[];
  cautions: string[];
};

export type MatchCandidate = {
  userId: string;
  score: number;
  vectorScore?: number;
  deterministicScore: number;
  qualityLabel: MatchQualityLabel;
  explanation: MatchExplanation;
};

export type MatchRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export type MatchDashboardState =
  | "no_profile"
  | "vector_pending"
  | "vector_failed"
  | "opt_in_required"
  | "ready";

export type MatchDashboard = {
  state: MatchDashboardState;
  discoverable: boolean;
  profileVersion?: string;
  vectorStatus?: string;
};

export type MatchHubMenuVariant = "default" | "can_enable" | "can_disable";

export type MatchSuggestionRow = {
  id: string;
  user_id: string;
  candidate_user_id: string;
  profile_version: string;
  candidate_profile_version: string;
  score: number;
  vector_score: number | null;
  deterministic_score: number | null;
  explanation_json: string;
  status: string;
  created_at: number;
  action_at: number | null;
};

export type MatchRequestRow = {
  id: string;
  requester_user_id: string;
  candidate_user_id: string;
  requester_profile_version: string;
  candidate_profile_version: string;
  score: number;
  vector_score: number | null;
  deterministic_score: number | null;
  explanation_json: string;
  intro_ciphertext: string;
  status: MatchRequestStatus;
  created_at: number;
  responded_at: number | null;
  expires_at: number | null;
  idempotency_key: string;
};
