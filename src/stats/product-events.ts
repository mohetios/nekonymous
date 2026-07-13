import type { Environment } from "../contracts/runtime";
import { emitStat } from "./emit-stat";
import { STAT_EVENTS } from "./events";

/** Product-level stat recordings used across features. Failures are best-effort. */

const emitCount = async (
  env: Environment,
  eventName: (typeof STAT_EVENTS)[keyof typeof STAT_EVENTS],
  count: number
): Promise<void> => {
  if (count <= 0) {
    return;
  }
  await emitStat(env, eventName, { count });
};

export const recordUserCreated = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.USER_CREATED);

export const recordLinkCreated = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.LINK_CREATED);

export const recordLinkOpened = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.LINK_OPENED);

export const recordMessageCreated = (
  env: Environment,
  count = 1
): Promise<void> => emitCount(env, STAT_EVENTS.MESSAGE_CREATED, count);

export const recordMessageDelivered = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.MESSAGE_DELIVERED);

export const recordInboxOpened = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.INBOX_OPENED);

export const recordReplySent = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.REPLY_SENT);

export const recordBlockCreated = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.BLOCK_CREATED);

export const recordReportCreated = (
  env: Environment,
  statKey?: string
): Promise<void> =>
  emitStat(env, STAT_EVENTS.REPORT_CREATED, statKey ? { statKey } : undefined);

export const recordProfileStarted = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.PROFILE_STARTED);

export const recordProfileCompleted = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.PROFILE_COMPLETED);

export const recordProfileIndexRequested = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.PROFILE_INDEX_REQUESTED);

export const recordProfileIndexed = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.PROFILE_INDEXED);

export const recordProfileIndexFailed = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.PROFILE_INDEX_FAILED);

export const recordDiscoverabilityEnabled = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.DISCOVERABILITY_ENABLED);

export const recordDiscoverabilityDisabled = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.DISCOVERABILITY_DISABLED);

export const recordSuggestionSearch = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.SUGGESTION_SEARCH);

export const recordSuggestionShown = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.SUGGESTION_SHOWN);

export const recordSuggestionDismissed = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.SUGGESTION_DISMISSED);

export const recordRequestSent = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.REQUEST_SENT);

export const recordRequestAccepted = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.REQUEST_ACCEPTED);

export const recordRequestDeclined = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.REQUEST_DECLINED);

export const recordRequestCanceled = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.REQUEST_CANCELED);

export const recordPauseEnabled = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.PAUSE_ENABLED);

export const recordPauseDisabled = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.PAUSE_DISABLED);

export const recordHardReset = (env: Environment): Promise<void> =>
  emitStat(env, STAT_EVENTS.HARD_RESET);
