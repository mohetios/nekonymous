import type { Environment } from "../../types";

/** Pair history reset is a no-op in V2 — pair state lives in PairLedgerShardDO. */
export const countUserMatchHistory = (
  _userId: string,
  _env: Environment
): Promise<{ requests: number; blocks: number }> =>
  Promise.resolve({ requests: 0, blocks: 0 });

export const resetUserMatchHistory = (
  _userId: string,
  _env: Environment
): Promise<{ requests: number; blocks: number }> =>
  Promise.resolve({ requests: 0, blocks: 0 });
