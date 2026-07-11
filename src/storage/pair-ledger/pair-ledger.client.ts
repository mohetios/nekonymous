import type { Environment } from "../../types";
import { shardNameForLookupHash } from "../shard-routing";
import type { PairLedgerShardPing, PairStateRecord, UpsertPairStateInput } from "./pair-ledger.types";

const stub = (env: Environment, pairTag: string) =>
  env.PAIR_LEDGER_DO.get(
    env.PAIR_LEDGER_DO.idFromName(shardNameForLookupHash("pair", pairTag))
  );

const doFetch = async <T>(
  env: Environment,
  pairTag: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await stub(env, pairTag).fetch(
    `https://pair-ledger${path}`,
    init
  );
  if (!response.ok) {
    throw new Error(`PairLedgerDO ${path} failed: ${response.status}`);
  }
  return response.json<T>();
};

export const pingPairLedgerShard = async (
  env: Environment,
  pairTag: string
): Promise<PairLedgerShardPing> => {
  const shard = stub(env, pairTag);
  return shard.ping();
};

export const getPairStateRecord = async (
  env: Environment,
  pairTag: string
): Promise<PairStateRecord | null> => {
  const body = await doFetch<{ record: PairStateRecord | null }>(
    env,
    pairTag,
    `/pair-states/${encodeURIComponent(pairTag)}`
  );
  return body.record;
};

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
    const body = await doFetch<{ records: Record<string, PairStateRecord | null> }>(
      env,
      anchorTag,
      "/pair-states/batch",
      {
        method: "POST",
        body: JSON.stringify({ pairTags: tags }),
      }
    );
    for (const [pairTag, record] of Object.entries(body.records)) {
      merged.set(pairTag, record);
    }
  });

  return merged;
};

export const upsertPairStateRecord = async (
  env: Environment,
  input: UpsertPairStateInput
): Promise<void> => {
  await doFetch(env, input.pairTag, "/pair-states", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export type AcquirePairPendingResult =
  | { ok: true }
  | { ok: false; reason: "blocked" };

export const acquirePairPendingLock = async (
  env: Environment,
  pairTag: string,
  expiresAt: number
): Promise<AcquirePairPendingResult> => {
  const response = await stub(env, pairTag).fetch(
    "https://pair-ledger/pair-states/acquire-pending",
    {
      method: "POST",
      body: JSON.stringify({ pairTag, expiresAt }),
    }
  );
  if (response.status === 409) {
    return { ok: false, reason: "blocked" };
  }
  if (!response.ok) {
    throw new Error(`PairLedgerDO acquire-pending failed: ${response.status}`);
  }
  return { ok: true };
};

export const releasePairPendingLock = async (
  env: Environment,
  pairTag: string
): Promise<void> => {
  const response = await stub(env, pairTag).fetch(
    "https://pair-ledger/pair-states/release-pending",
    {
      method: "POST",
      body: JSON.stringify({ pairTag }),
    }
  );
  if (!response.ok) {
    throw new Error(`PairLedgerDO release-pending failed: ${response.status}`);
  }
};
