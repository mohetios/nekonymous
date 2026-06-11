import { handleAdminCleanup } from "./admin/cleanup";
import { webhookCallback } from "grammy";
import { createBot } from "./bot/bot";
import { InboxSqliteDurableObject } from "./bot/inboxDU";
import { AboutPageContent } from "./front/about";
import { HomePageContent } from "./front/home";
import pageLayout from "./front/layout";
import type { Environment } from "./types";
import { Router } from "./utils/router";
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
    const html = pageLayout("پیام ناشناس تلگرام", env.BOT_NAME, content);
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
    const html = pageLayout("درباره", env.BOT_NAME, content);
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  }
);

/**
 * Define the bot webhook route.
 * This handles incoming webhook requests from Telegram to the bot.
 */
router.post(
  "/admin/cleanup",
  (request: Request, env: Environment, _ctx: ExecutionContext) =>
    handleAdminCleanup(request, env)
);

router.post(
  "/bot",
  async (request: Request, env: Environment, executionCtx: ExecutionContext) => {
    try {
      const update = await request.clone().json<{ update_id: number }>();
      registerUpdateDefer(update.update_id, (promise) =>
        executionCtx.waitUntil(promise)
      );

      try {
        const bot = createBot(env);
        return await webhookCallback(bot, "cloudflare-mod", {
          secretToken: env.BOT_SECRET_KEY,
        })(request);
      } finally {
        unregisterUpdateDefer(update.update_id);
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
