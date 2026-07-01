export const STAT_EVENTS = {
  USER_CREATED: "user_created",
  USER_ACTIVE: "user_active",
  LINK_CREATED: "link_created",
  LINK_OPENED: "link_opened",
  MESSAGE_CREATED: "message_created",
  MESSAGE_DELIVERED: "message_delivered",
  INBOX_OPENED: "inbox_opened",
  REPLY_SENT: "reply_sent",
  BLOCK_CREATED: "block_created",
  REPORT_CREATED: "report_created",
  MESSAGE_EXPIRED: "message_expired",
  ASSESSMENT_STARTED: "assessment_started",
  ASSESSMENT_COMPLETED: "assessment_completed",
  DISCOVERABILITY_ENABLED: "discoverability_enabled",
  DISCOVERABILITY_DISABLED: "discoverability_disabled",
  SUGGESTION_SEARCH: "suggestion_search",
  REQUEST_SENT: "request_sent",
  REQUEST_ACCEPTED: "request_accepted",
  REQUEST_DECLINED: "request_declined",
  REQUEST_CANCELED: "request_canceled",
  PAUSE_ENABLED: "pause_enabled",
  PAUSE_DISABLED: "pause_disabled",
  HARD_RESET: "hard_reset",
  /** @deprecated use MESSAGE_CREATED */
  MESSAGES_RELAYED: "messages_relayed",
  /** @deprecated use ASSESSMENT_COMPLETED */
  ASSESSMENT_COMPLETIONS: "assessment_completions",
  /** @deprecated use REQUEST_SENT */
  MATCH_REQUESTS: "match_requests",
} as const;

export const STATS_EVENT_NAMES = Object.values(STAT_EVENTS) as [
  (typeof STAT_EVENTS)[keyof typeof STAT_EVENTS],
  ...(typeof STAT_EVENTS)[keyof typeof STAT_EVENTS][],
];

export type StatsEventName = (typeof STATS_EVENT_NAMES)[number];

export type StatsEvent = {
  eventName: StatsEventName;
  at: number;
  statKey?: string;
  uniqueHash?: string;
};

const STATS_EVENT_NAME_SET = new Set<string>(STATS_EVENT_NAMES);

export const isStatsEventName = (value: string): value is StatsEventName =>
  STATS_EVENT_NAME_SET.has(value);
