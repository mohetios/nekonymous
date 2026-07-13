import type { Environment } from "../contracts/runtime";
import type { StatsEventName } from "./events";

const safeStatKey = (statKey?: string): string | undefined => {
  if (!statKey) {
    return undefined;
  }
  const normalized = statKey.trim().slice(0, 64);
  return normalized.length > 0 ? normalized : undefined;
};

const safeUniqueHash = (uniqueHash?: string): string | undefined => {
  if (!uniqueHash) {
    return undefined;
  }
  const normalized = uniqueHash.trim().slice(0, 128);
  return normalized.length > 0 ? normalized : undefined;
};

export const emitStat = async (
  env: Environment,
  eventName: StatsEventName,
  options?: { count?: number; statKey?: string; uniqueHash?: string; at?: number }
): Promise<void> => {
  const count =
    options?.count !== undefined && Number.isFinite(options.count)
      ? Math.max(1, Math.floor(options.count))
      : 1;
  try {
    await env.NEKO_STATS_QUEUE.send(
      {
        eventName,
        at: options?.at ?? Date.now(),
        count,
        ...(safeStatKey(options?.statKey) ? { statKey: safeStatKey(options?.statKey) } : {}),
        ...(safeUniqueHash(options?.uniqueHash)
          ? { uniqueHash: safeUniqueHash(options?.uniqueHash) }
          : {}),
      },
      { contentType: "json" }
    );
  } catch {
    // Stats are best-effort and should never break user flow.
  }
};
