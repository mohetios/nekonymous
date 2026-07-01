export const STATS_EVENT_NAMES = [
  "messages_relayed",
  "assessment_completions",
  "match_requests",
] as const;

export type StatsEventName = (typeof STATS_EVENT_NAMES)[number];

export type StatsEvent = {
  eventName: StatsEventName;
  at: number;
  statKey?: string;
  uniqueHash?: string;
};
