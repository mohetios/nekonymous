import type { PairLedgerState, PairStateRecord } from "../../../storage/pair-ledger/pair-ledger.types";
import type { CandidateProfile } from "./types.ts";

const BLOCKING_PAIR_STATES = new Set<PairLedgerState>([
  "pending",
  "blocked",
  "dismiss_cooldown",
  "accepted_cooldown",
  "declined_cooldown",
]);

export const isPairStateBlocking = (
  record: PairStateRecord | null | undefined,
  now = Date.now()
): boolean => {
  if (!record) {
    return false;
  }
  if (record.state === "blocked") {
    return true;
  }
  if (record.expiresAt !== null && record.expiresAt <= now) {
    return false;
  }
  return BLOCKING_PAIR_STATES.has(record.state);
};

export const filterEligibleCandidates = (
  candidates: CandidateProfile[],
  pairTagsByProfile: Map<string, string>,
  pairStates: Map<string, PairStateRecord | null>,
  now = Date.now()
): CandidateProfile[] =>
  candidates.filter((candidate) => {
    const pairTag = pairTagsByProfile.get(candidate.profileHash);
    if (!pairTag) {
      return false;
    }
    return !isPairStateBlocking(pairStates.get(pairTag), now);
  });
