import { Bot } from "grammy";
import type { Environment } from "../types";
import { deferForUpdate, type NekoContext } from "../utils/worker";
import { registerHandlers } from "./register-handlers";
import { createUserRateLimitMiddleware } from "./user-rate-limit";

type BotConfig = NonNullable<ConstructorParameters<typeof Bot>[1]>;

let cachedBot: { key: string; bot: Bot } | null = null;

const botCacheKey = (env: Environment): string =>
  `${env.SECRET_TELEGRAM_API_TOKEN}\0${env.BOT_INFO}\0${env.APP_MASTER_KEY}`;

export const createBot = (env: Environment) => {
  const cacheKey = botCacheKey(env);
  if (cachedBot?.key === cacheKey) {
    return cachedBot.bot;
  }

  const { SECRET_TELEGRAM_API_TOKEN, BOT_INFO } = env;

  const bot = new Bot(SECRET_TELEGRAM_API_TOKEN, {
    botInfo: JSON.parse(BOT_INFO) as BotConfig["botInfo"],
  });

  bot.use(async (ctx, next) => {
    const defer = deferForUpdate(ctx.update.update_id);
    if (defer) {
      (ctx as NekoContext).deferWork = defer;
    }
    await next();
  });

  bot.use(createUserRateLimitMiddleware(env));

  registerHandlers(bot, env);

  cachedBot = { key: cacheKey, bot };
  return bot;
};
