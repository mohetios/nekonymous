import { webhookCallback } from "grammy";
import type { Environment } from "../types";
import { Router } from "../utils/router";
import {
  claimProcessedEvent,
  completeProcessedEvent,
  failProcessedEvent,
} from "../storage/user-state-client";
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
    let claimedEventKey: string | null = null;
    const expectedSecret = env.BOT_SECRET_KEY?.trim();
    if (expectedSecret) {
      const telegramSecret =
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
      if (!timingSafeEqual(telegramSecret, expectedSecret)) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    try {
      let update: { update_id?: unknown };
      try {
        update = await request.clone().json<{ update_id?: unknown }>();
      } catch {
        return new Response("Invalid update payload", { status: 400 });
      }
      const updateId =
        typeof update.update_id === "number" ? update.update_id : undefined;
      if (updateId === undefined) {
        return new Response("Invalid update_id", { status: 400 });
      }
      const eventKey = `tg:update:${updateId}`;
      const claimState = await claimProcessedEvent(env, eventKey, 30 * 1000);
      if (claimState === "done" || claimState === "processing") {
        return new Response("OK", { status: 200 });
      }
      claimedEventKey = eventKey;
      if (updateId !== undefined) {
        registerUpdateDefer(updateId, (promise) =>
          executionCtx.waitUntil(promise)
        );
      }

      try {
        const bot = createBot(env);
        const response = await webhookCallback(bot, "cloudflare-mod", {
          secretToken: env.BOT_SECRET_KEY,
        })(request);
        if (response.status >= 500) {
          await failProcessedEvent(env, eventKey).catch(() => {});
        } else {
          await completeProcessedEvent(env, eventKey).catch(() => {});
        }
        return response;
      } finally {
        if (updateId !== undefined) {
          unregisterUpdateDefer(updateId);
        }
      }
    } catch {
      if (claimedEventKey) {
        await failProcessedEvent(env, claimedEventKey).catch(() => {});
      }
      return new Response("Error handling bot request", { status: 500 });
    }
  }
);

export const handleRequest = (
  request: Request,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> => router.handle(request, env, ctx);
