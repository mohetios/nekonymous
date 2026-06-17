import { webhookCallback } from "grammy";
import type { Environment } from "../types";
import { Router } from "../utils/router";
import { timingSafeEqual } from "../utils/tools";
import {
  registerUpdateDefer,
  unregisterUpdateDefer,
} from "../utils/worker";
import { createBot } from "./create-bot";

const router = new Router();

router.post(
  "/bot",
  async (request: Request, env: Environment, executionCtx: ExecutionContext) => {
    const telegramSecret =
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (!timingSafeEqual(telegramSecret, env.BOT_SECRET_KEY)) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const update = await request.clone().json<{ update_id?: unknown }>();
      const updateId =
        typeof update.update_id === "number" ? update.update_id : undefined;
      if (updateId !== undefined) {
        registerUpdateDefer(updateId, (promise) =>
          executionCtx.waitUntil(promise)
        );
      }

      try {
        const bot = createBot(env);
        return await webhookCallback(bot, "cloudflare-mod", {
          secretToken: env.BOT_SECRET_KEY,
        })(request);
      } finally {
        if (updateId !== undefined) {
          unregisterUpdateDefer(updateId);
        }
      }
    } catch {
      return new Response("Error initializing bot", { status: 500 });
    }
  }
);

export const handleRequest = (
  request: Request,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> => router.handle(request, env, ctx);
