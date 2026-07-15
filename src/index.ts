import { UserStateDurableObject as UserStateDurableObjectBase } from "./storage/user-state-do";
import { TelegramOutboxDurableObject as TelegramOutboxDurableObjectBase } from "./storage/telegram-outbox-do";
import { TicketVaultDurableObject as TicketVaultDurableObjectBase } from "./storage/ticket-vault/ticket-vault.do";
import { SafetyStateDurableObject as SafetyStateDurableObjectBase } from "./storage/safety-state/safety-state.do";
import { ProfileVaultShardDurableObject as ProfileVaultShardDurableObjectBase } from "./storage/profile-vault/profile-vault.do";
import { ConversationVaultShardDurableObject as ConversationVaultShardDurableObjectBase } from "./storage/conversation-vault/conversation-vault.do";
import { PairLedgerShardDurableObject as PairLedgerShardDurableObjectBase } from "./storage/pair-ledger/pair-ledger.do";
import type { Environment } from "./contracts/runtime";
import { handleWebhook } from "./bot/webhook";
import { handleOutboxBatch } from "./queues/outbox-consumer";
import type { OutboxQueueJob, QueueEvent } from "./contracts/queues/events";
import { handleProfileIndexBatch } from "./queues/profile-index-consumer";
import type { ProfileIndexJob } from "./contracts/conversation/profile-index";
import { handleStatsBatch } from "./stats/stats-consumer";
import type { StatsEvent } from "./contracts/stats/events";

export class UserStateDurableObject extends UserStateDurableObjectBase {}
export class TelegramOutboxDurableObject extends TelegramOutboxDurableObjectBase {}
export class TicketVaultDurableObject extends TicketVaultDurableObjectBase {}
export class SafetyStateDurableObject extends SafetyStateDurableObjectBase {}

export class ProfileVaultShardDurableObject extends ProfileVaultShardDurableObjectBase {}
export class ConversationVaultShardDurableObject extends ConversationVaultShardDurableObjectBase {}
export class PairLedgerShardDurableObject extends PairLedgerShardDurableObjectBase {}

export default {
  fetch: async (request: Request, env: Environment, ctx: ExecutionContext) => {
    return handleWebhook(request, env, ctx);
  },
  queue: async (
    batch: MessageBatch<QueueEvent>,
    env: Environment
  ) => {
    const queueName =
      "queue" in batch && typeof batch.queue === "string" ? batch.queue : "";

    switch (queueName) {
      case "neko-outbox":
        await handleOutboxBatch(batch as MessageBatch<OutboxQueueJob>, env);
        return;
      case "neko-stats":
        await handleStatsBatch(batch as MessageBatch<StatsEvent>, env);
        return;
      case "neko-profile-index":
        await handleProfileIndexBatch(batch as MessageBatch<ProfileIndexJob>, env);
        return;
      default:
        throw new Error(`Unknown queue: ${queueName || "<missing>"}`);
    }
  },
};
