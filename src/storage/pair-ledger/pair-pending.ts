import type { PairStateRecord } from "./pair-ledger.types";

const BLOCKING_PAIR_STATES = new Set<PairStateRecord["state"]>([
  "pending",
  "blocked",
  "dismiss_cooldown",
  "accepted_cooldown",
  "declined_cooldown",
]);

export const isActiveBlockingPairState = (
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

export type AcquirePairPendingResult =
  | { ok: true }
  | { ok: false; reason: "blocked" };

export const evaluateAcquirePairPending = (
  record: PairStateRecord | null | undefined,
  now = Date.now()
): AcquirePairPendingResult => {
  if (isActiveBlockingPairState(record, now)) {
    return { ok: false, reason: "blocked" };
  }
  return { ok: true };
};
