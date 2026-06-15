import { webhookCallback } from "grammy";
import { createBot } from "./bot/bot";
import { InboxSqliteDurableObject } from "./bot/inboxDU";
import { AboutPageContent } from "./front/about";
import { TechnicalPageContent } from "./front/technical";
import { HomePageContent } from "./front/home";
import pageLayout from "./front/layout";
import type { Environment } from "./types";
import { Router } from "./utils/router";
import { timingSafeEqual } from "./utils/tools";
import {
  registerUpdateDefer,
  unregisterUpdateDefer,
} from "./utils/worker";

// INBOX DURABLE OBJECTS
export { InboxSqliteDurableObject };

// Initialize a Router instance for handling different routes
const router = new Router();

/**
 * Define the route for the home page.
 * This will serve the main page of the application.
 */
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

/**
 * Define the route for the about page.
 * This will serve a page with information about the application or service.
 */
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

/**
 * Export the fetch handler.
 * This is the entry point for handling all incoming requests to the worker.
 */
export default {
  fetch: async (request: Request, env: Environment, ctx: ExecutionContext) => {
    return router.handle(request, env, ctx);
  },
};
