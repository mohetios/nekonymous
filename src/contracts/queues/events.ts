import type { InboxDrainJob } from "../inbox/events";
import type { TelegramOutboxJob } from "../telegram/outbox";
import type { ProfileIndexJob } from "../conversation/profile-index";
import type { StatsEvent } from "../../stats/events";

export type OutboxQueueJob = TelegramOutboxJob | InboxDrainJob;
export type QueueEvent = OutboxQueueJob | StatsEvent | ProfileIndexJob;
