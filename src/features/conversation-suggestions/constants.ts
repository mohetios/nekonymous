/** Hub navigation callbacks (`m:`) — suggestion tickets use `s:` in a later phase. */
export const SUGGESTION_HUB_CALLBACK = {
  hub: "m:hub",
  search: "m:search",
  pending: "m:pending",
  profile: "m:profile",
  enableDiscover: "m:disc:on",
  disableDiscover: "m:disc:off",
  assessment: "m:assess",
} as const;

export const SUGGESTION_CALLBACK = {
  open: (suggestionRef: string) => `s:${suggestionRef}`,
  request: (suggestionRef: string) => `s:r:${suggestionRef}`,
  dismiss: (suggestionRef: string) => `s:d:${suggestionRef}`,
} as const;

export const REQUEST_CALLBACK = {
  open: (requestRef: string) => `q:${requestRef}`,
  accept: (requestRef: string) => `q:a:${requestRef}`,
  decline: (requestRef: string) => `q:d:${requestRef}`,
  cancel: (requestRef: string) => `q:c:${requestRef}`,
} as const;

/** Active hub inline callbacks only. */
export const suggestionHubCallbackQueryRegex = (): RegExp =>
  /^m:(?:hub|search|pending|profile|disc:(?:on|off)|assess)$/;

export const suggestionCallbackQueryRegex = (): RegExp =>
  /^s:(?:d:|r:)?[A-Za-z0-9_-]{16,43}$/;

export const requestCallbackQueryRegex = (): RegExp =>
  /^q:(?:a:|d:|c:)?[A-Za-z0-9_-]{16,43}$/;

export const RETRIEVAL_TOP_K_PER_CHANNEL = 30;
export const RETRIEVAL_MAX_MERGED_VECTOR_HITS = 60;
export const RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE = 50;
export const RETRIEVAL_MAX_CONCURRENT_VAULT_RESOLVES = 4;

export const SUPPORTED_RETRIEVAL_LOCALES = ["fa", "en"] as const;

export const MAX_SUGGESTION_RESULTS = 5;
export const SUGGESTION_SEARCH_LIMIT_PER_HOUR = 50;
export const SUGGESTION_SEARCH_WINDOW_MS = 60 * 60 * 1000;

export const PAIR_DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const PAIR_ACCEPTED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export const PAIR_DECLINED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export const EXPOSURE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const EXPOSURE_RECENT_PENALTY = 0.06;
export const EXPOSURE_LOW_BOOST = 0.04;

export const ELIGIBILITY_MAX_CONCURRENT_PAIR_LOOKUPS = 4;
