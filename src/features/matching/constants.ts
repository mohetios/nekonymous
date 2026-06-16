export const MATCH_CALLBACK = {
  search: "m:search",
  /** Legacy — old result messages may still emit this. */
  refresh: "m:refresh",
  /** Legacy — old dashboard messages may still emit this. */
  back: "m:back",
  request: (suggestionId: string) => `m:req:${suggestionId}`,
  accept: (requestId: string) => `m:acc:${requestId}`,
  decline: (requestId: string) => `m:dec:${requestId}`,
  cancel: (requestId: string) => `m:can:${requestId}`,
} as const;

/** Max pending requests shown in the hub pending list. */
export const MATCH_PENDING_LIST_LIMIT = 20;

export const MATCH_INTRO_MAX_CHARS = 500;

export const MATCH_SEARCH_TOP_K = 50;

/** Max suggestions shown per search; no minimum score gate. */
export const MATCH_RESULT_COUNT = 5;

export const MATCH_MIN_SCORE_TO_SHOW = 0;

export const MATCH_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const MATCH_SEARCH_LIMIT_PER_HOUR = 50;

export const MATCH_REQUEST_LIMIT_PER_DAY = 300;

export const MATCH_RECENT_DECLINE_MS = 7 * 24 * 60 * 60 * 1000;

export const MATCH_DISMISS_BLOCK_MS = 30 * 24 * 60 * 60 * 1000;
