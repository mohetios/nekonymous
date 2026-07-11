import { UserStateDurableObject as UserStateDurableObjectBase } from "./storage/user-state-do";
import { TelegramOutboxDurableObject as TelegramOutboxDurableObjectBase } from "./storage/telegram-outbox-do";
import { TicketVaultDurableObject as TicketVaultDurableObjectBase } from "./storage/ticket-vault/ticket-vault.do";
import { ReportLedgerDurableObject as ReportLedgerDurableObjectBase } from "./storage/report-ledger/report-ledger.do";
import { ProfileVaultShardDurableObject as ProfileVaultShardDurableObjectBase } from "./storage/profile-vault/profile-vault.do";
import { ConversationVaultShardDurableObject as ConversationVaultShardDurableObjectBase } from "./storage/conversation-vault/conversation-vault.do";
import { PairLedgerShardDurableObject as PairLedgerShardDurableObjectBase } from "./storage/pair-ledger/pair-ledger.do";
import type { Environment } from "./types";
import { handleRequest } from "./bot/router";
import { handleOutboxBatch } from "./queues/outbox-consumer";
import type { TelegramOutboxJob } from "./queues/telegram-outbox.types";
import { handleProfileIndexBatch } from "./queues/profile-index-consumer";
import type { ProfileIndexJob } from "./queues/profile-index.types";
import { handleStatsBatch } from "./stats/stats-consumer";
import type { StatsEvent } from "./stats/events";

export class UserStateDurableObjectV2 extends UserStateDurableObjectBase {}
export class TelegramOutboxDurableObjectV2 extends TelegramOutboxDurableObjectBase {
}
export class TicketVaultDurableObjectV2 extends TicketVaultDurableObjectBase {}
export class ReportLedgerDurableObjectV2 extends ReportLedgerDurableObjectBase {}

export class UserStateDurableObjectV3 extends UserStateDurableObjectBase {}
export class TelegramOutboxDurableObjectV3 extends TelegramOutboxDurableObjectBase {}
export class TicketVaultDurableObjectV3 extends TicketVaultDurableObjectBase {}
export class ReportLedgerDurableObjectV3 extends ReportLedgerDurableObjectBase {}

export class UserStateDurableObjectV4 extends UserStateDurableObjectBase {}
export class TelegramOutboxDurableObjectV4 extends TelegramOutboxDurableObjectBase {}
export class TicketVaultDurableObjectV4 extends TicketVaultDurableObjectBase {}
export class ReportLedgerDurableObjectV4 extends ReportLedgerDurableObjectBase {}

export class ProfileVaultShardDurableObject extends ProfileVaultShardDurableObjectBase {}
export class ConversationVaultShardDurableObject extends ConversationVaultShardDurableObjectBase {}
export class PairLedgerShardDurableObject extends PairLedgerShardDurableObjectBase {}

export class ProfileVaultShardDurableObjectV2 extends ProfileVaultShardDurableObjectBase {}
export class ConversationVaultShardDurableObjectV2 extends ConversationVaultShardDurableObjectBase {}
export class PairLedgerShardDurableObjectV2 extends PairLedgerShardDurableObjectBase {}

export default {
  fetch: async (request: Request, env: Environment, ctx: ExecutionContext) => {
    return handleRequest(request, env, ctx);
  },
  queue: async (
    batch: MessageBatch<TelegramOutboxJob | StatsEvent | ProfileIndexJob>,
    env: Environment
  ) => {
    const queueName =
      "queue" in batch && typeof batch.queue === "string" ? batch.queue : "";
    if (queueName === "neko-stats") {
      await handleStatsBatch(batch as MessageBatch<StatsEvent>, env);
      return;
    }
    if (queueName === "neko-profile-index") {
      await handleProfileIndexBatch(batch as MessageBatch<ProfileIndexJob>, env);
      return;
    }
    await handleOutboxBatch(batch as MessageBatch<TelegramOutboxJob>, env);
  },
};
