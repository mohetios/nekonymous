import { Bot } from "grammy";
import type { Environment } from "../contracts/runtime";
import type { DeferWork, NekoContext } from "./context";
import { registerHandlers } from "./register-handlers";
import { createUserRateLimitMiddleware } from "./user-rate-limit";

type BotConfig = NonNullable<ConstructorParameters<typeof Bot>[1]>;
type BotInfo = NonNullable<BotConfig["botInfo"]>;

let cachedBotInfoSource: string | null = null;
let cachedBotInfo: BotInfo | null = null;

const parseBotInfo = (source: string): BotInfo => {
  if (cachedBotInfo && cachedBotInfoSource === source) {
    return cachedBotInfo;
  }
  cachedBotInfoSource = source;
  cachedBotInfo = JSON.parse(source) as BotInfo;
  return cachedBotInfo;
};

export const createBot = (env: Environment, deferWork?: DeferWork) => {
  const { SECRET_TELEGRAM_API_TOKEN, BOT_INFO } = env;
  const botInfo = parseBotInfo(BOT_INFO);

  const bot = new Bot(SECRET_TELEGRAM_API_TOKEN, {
    botInfo,
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
