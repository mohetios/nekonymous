import type { Environment } from "../../types";
import { shardNameForLookupHash } from "../shard-routing";
import type { PairStateRecord, UpsertPairStateInput } from "./pair-ledger.types";

const stub = (env: Environment, pairTag: string) =>
  env.PAIR_LEDGER_DO.get(
    env.PAIR_LEDGER_DO.idFromName(shardNameForLookupHash("pair", pairTag))
  );

const mapBounded = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = [];
  let index = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const current = index++;
        results.push(await fn(items[current]));
      }
    })
  );

  return results;
};

export const getPairStatesBatch = async (
  env: Environment,
  pairTags: string[],
  concurrency = 4
): Promise<Map<string, PairStateRecord | null>> => {
  const uniqueTags = [...new Set(pairTags)];
  const byShard = new Map<string, string[]>();

  for (const pairTag of uniqueTags) {
    const shard = shardNameForLookupHash("pair", pairTag);
    const tags = byShard.get(shard) ?? [];
    tags.push(pairTag);
    byShard.set(shard, tags);
  }

  const merged = new Map<string, PairStateRecord | null>();
  const shardEntries = [...byShard.entries()];

  await mapBounded(shardEntries, concurrency, async ([, tags]) => {
    const anchorTag = tags[0];
    const records = await stub(env, anchorTag).batchGetPairStates(tags);
    for (const [pairTag, record] of Object.entries(records)) {
      merged.set(pairTag, record);
    }
  });

  return merged;
};

export const upsertPairStateRecord = async (
  env: Environment,
  input: UpsertPairStateInput
): Promise<void> => {
  await stub(env, input.pairTag).upsertPairState(input);
};

export type AcquirePairPendingResult =
  | { ok: true }
  | { ok: false; reason: "blocked" };

export const acquirePairPendingLock = async (
  env: Environment,
  pairTag: string,
  expiresAt: number
): Promise<AcquirePairPendingResult> => {
  const result = await stub(env, pairTag).acquirePairPending(pairTag, expiresAt);
  if (!result.ok) {
    return { ok: false, reason: "blocked" };
  }
  return { ok: true };
};

export const releasePairPendingLock = async (
  env: Environment,
  pairTag: string
): Promise<void> => {
  await stub(env, pairTag).releasePairPending(pairTag);
};
