import type { OutboxQueueJob } from "./queues/events";
import type { ProfileIndexJob } from "./conversation/profile-index";
import type { StatsEvent } from "./stats/events";

export interface Environment extends CloudflareEnv {
  NEKO_OUTBOX_QUEUE: Queue<OutboxQueueJob>;
  NEKO_STATS_QUEUE: Queue<StatsEvent>;
  NEKO_PROFILE_INDEX_QUEUE: Queue<ProfileIndexJob>;
}
