import { webhookCallback } from "grammy";
import { AboutPageContent } from "../front/about";
import { TechnicalPageContent } from "../front/technical";
import { HomePageContent } from "../front/home";
import pageLayout from "../front/layout";
import type { Environment } from "../types";
import { Router } from "../utils/router";
import { timingSafeEqual } from "../utils/tools";
import {
  registerUpdateDefer,
  unregisterUpdateDefer,
} from "../utils/worker";
import { createBot } from "./create-bot";

const router = new Router();

router.get(
  "/",
  async (_request: Request, env: Environment, _ctx: ExecutionContext) => {
    const content = await HomePageContent(env);
    const html = pageLayout(
      "پیام ناشناس تلگرام",
      env.BOT_NAME,
      content,
      env.PUBLIC_SITE_URL
    );
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  }
);

router.get(
  "/about",
  (_request: Request, env: Environment, _ctx: ExecutionContext) => {
    const content = AboutPageContent();
    const html = pageLayout(
      "نحوه کار",
      env.BOT_NAME,
      content,
      env.PUBLIC_SITE_URL
    );
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  }
);

router.get(
  "/about/technical",
  (_request: Request, env: Environment, _ctx: ExecutionContext) => {
    const content = TechnicalPageContent();
    const html = pageLayout(
      "جزئیات فنی",
      env.BOT_NAME,
      content,
      env.PUBLIC_SITE_URL
    );
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  }
);

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
