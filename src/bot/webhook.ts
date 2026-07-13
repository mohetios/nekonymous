import { webhookCallback } from "grammy";
import type { Environment } from "../types";
import {
  claimProcessedEvent,
  completeProcessedEvent,
  failProcessedEvent,
} from "../storage/user-state-client";
import { timingSafeEqual } from "../utils/timing-safe-equal";
import { createBot } from "./create-bot";

const WEBHOOK_PATH = "/bot";
const UPDATE_CLAIM_LEASE_MS = 30 * 1000;

const readUpdateId = async (request: Request): Promise<number | null> => {
  try {
    const update = await request.clone().json<{ update_id?: unknown }>();
    return typeof update.update_id === "number" ? update.update_id : null;
  } catch {
    return null;
  }
};

export const handleWebhook = async (
  request: Request,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> => {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== WEBHOOK_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const expectedSecret = env.BOT_SECRET_KEY?.trim();
  if (expectedSecret) {
    const telegramSecret =
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (!timingSafeEqual(telegramSecret, expectedSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const updateId = await readUpdateId(request);
  if (updateId === null) {
    return new Response("Invalid update_id", { status: 400 });
  }

  const eventKey = `tg:update:${updateId}`;
  const claimState = await claimProcessedEvent(
    env,
    eventKey,
    UPDATE_CLAIM_LEASE_MS
  );
  if (claimState === "done") {
    return new Response("OK", { status: 200 });
  }
  if (claimState === "processing") {
    return new Response("Processing", {
      status: 503,
      headers: { "Retry-After": "1" },
    });
  }

  try {
    const bot = createBot(env, (promise) => ctx.waitUntil(promise));
    const response = await webhookCallback(bot, "cloudflare-mod", {
      secretToken: env.BOT_SECRET_KEY,
    })(request);

    if (response.status >= 500) {
      await failProcessedEvent(env, eventKey).catch(() => {});
    } else {
      await completeProcessedEvent(env, eventKey).catch(() => {});
    }

    return response;
  } catch {
    await failProcessedEvent(env, eventKey).catch(() => {});
    return new Response("Error handling bot request", { status: 500 });
  }
};
