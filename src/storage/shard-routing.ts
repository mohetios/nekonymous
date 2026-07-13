/** Bounded prefix length for vault shard routing from blind lookup hashes. */
export const SHARD_PREFIX_LENGTH = 4;

export type VaultPlane = "profile" | "conversation" | "pair" | "safety";

export const shardNameForLookupHash = (
  plane: VaultPlane,
  lookupHash: string
): string => {
  const normalized = lookupHash.replace(/[^A-Za-z0-9_-]/g, "");
  const prefix =
    normalized.length >= 2
      ? normalized.slice(0, SHARD_PREFIX_LENGTH)
      : "00";
  return `${plane}:${prefix}`;
};
