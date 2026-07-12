import { Bot } from "grammy";
import type { Environment } from "../types";
import type { DeferWork, NekoContext } from "./context";
import { registerHandlers } from "./register-handlers";
import { createUserRateLimitMiddleware } from "./user-rate-limit";

type BotConfig = NonNullable<ConstructorParameters<typeof Bot>[1]>;

export const createBot = (env: Environment, deferWork?: DeferWork) => {
  const { SECRET_TELEGRAM_API_TOKEN, BOT_INFO } = env;

  const bot = new Bot(SECRET_TELEGRAM_API_TOKEN, {
    botInfo: JSON.parse(BOT_INFO) as BotConfig["botInfo"],
  });

  bot.use(async (ctx, next) => {
    if (deferWork) {
      (ctx as NekoContext).deferWork = deferWork;
    }
    await next();
  });

  bot.use(createUserRateLimitMiddleware(env));

  registerHandlers(bot, env);

  return bot;
};
