export type PairLedgerState =
  | "pending"
  | "dismiss_cooldown"
  | "accepted_cooldown"
  | "declined_cooldown"
  | "blocked";

export type PairStateRecord = {
  pairTag: string;
  state: PairLedgerState;
  expiresAt: number | null;
  updatedAt: number;
};

export type UpsertPairStateInput = {
  pairTag: string;
  state: PairLedgerState;
  expiresAt: number | null;
};

export type PairLedgerShardPing = {
  ok: true;
  plane: "pair";
  pairStates: number;
};

export interface PairLedgerShardRpc {
  ping(): PairLedgerShardPing;
}
