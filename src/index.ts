import { UserStateDurableObject as UserStateDurableObjectBase } from "./storage/user-state-do";
import { TelegramOutboxDurableObject as TelegramOutboxDurableObjectBase } from "./storage/telegram-outbox-do";
import { TicketVaultDurableObject as TicketVaultDurableObjectBase } from "./storage/ticket-vault/ticket-vault.do";
import { ReportLedgerDurableObject as ReportLedgerDurableObjectBase } from "./storage/report-ledger/report-ledger.do";
import type { Environment } from "./types";
import { handleRequest } from "./bot/router";
import { handleOutboxBatch } from "./queues/outbox-consumer";
import type { TelegramOutboxJob } from "./queues/telegram-outbox.types";
import { handleStatsBatch } from "./stats/stats-consumer";
import type { StatsEvent } from "./stats/events";

export class UserStateDurableObjectV2 extends UserStateDurableObjectBase {}
export class TelegramOutboxDurableObjectV2 extends TelegramOutboxDurableObjectBase {
}
export class TicketVaultDurableObjectV2 extends TicketVaultDurableObjectBase {}
export class ReportLedgerDurableObjectV2 extends ReportLedgerDurableObjectBase {}

export default {
  fetch: async (request: Request, env: Environment, ctx: ExecutionContext) => {
    return handleRequest(request, env, ctx);
  },
  queue: async (
    batch: MessageBatch<TelegramOutboxJob | StatsEvent>,
    env: Environment
  ) => {
    const queueName =
      "queue" in batch && typeof batch.queue === "string" ? batch.queue : "";
    if (queueName === "neko-stats") {
      await handleStatsBatch(batch as MessageBatch<StatsEvent>, env);
      return;
    }
    await handleOutboxBatch(batch as MessageBatch<TelegramOutboxJob>, env);
  },
};
