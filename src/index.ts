import { UserStateDurableObject } from "./storage/user-state-do";
import { TelegramOutboxDurableObject } from "./storage/telegram-outbox-do";
import type { Environment } from "./types";
import { handleRequest } from "./bot/router";
import { handleTelegramOutboxBatch } from "./queues/telegram-outbox.consumer";
import type { TelegramOutboxJob } from "./queues/telegram-outbox.types";

export { UserStateDurableObject, TelegramOutboxDurableObject };

export default {
  fetch: async (request: Request, env: Environment, ctx: ExecutionContext) => {
    return handleRequest(request, env, ctx);
  },
  queue: async (
    batch: MessageBatch<TelegramOutboxJob>,
    env: Environment
  ) => {
    await handleTelegramOutboxBatch(batch, env);
  },
};
