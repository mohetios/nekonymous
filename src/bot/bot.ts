import { Bot, type Context } from "grammy";
import type { Message } from "grammy/types";
import type { Environment } from "../types";
import { deferForUpdate, type NekoContext } from "../utils/worker";
import {
  handleBlockAction,
  handleNicknameAction,
  handleReportAction,
  handleReplyAction,
  handleUnblockAction,
} from "./actions";
import {
  handleInboxCommand,
  handleMessage,
  handleStartCommand,
} from "./commands";
import { handleSettingsCommand } from "./settings";

type BotConfig = NonNullable<ConstructorParameters<typeof Bot>[1]>;

const isCommandMessage = (message: Message): boolean =>
  message.text?.startsWith("/") === true ||
  message.entities?.some(
    (entity) => entity.type === "bot_command" && entity.offset === 0
  ) === true;

let cachedBot: { key: string; bot: Bot } | null = null;

const botCacheKey = (env: Environment): string =>
  `${env.SECRET_TELEGRAM_API_TOKEN}\0${env.BOT_INFO}\0${env.APP_MASTER_KEY}`;

export const createBot = (env: Environment) => {
  const cacheKey = botCacheKey(env);
  if (cachedBot?.key === cacheKey) {
    return cachedBot.bot;
  }

  const {
    SECRET_TELEGRAM_API_TOKEN,
    BOT_INFO,
    BOT_USERNAME,
    PUBLIC_SITE_URL,
  } = env;

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

  bot.command("start", (ctx) => handleStartCommand(ctx, env, BOT_USERNAME));

  bot.command("inbox", (ctx) => handleInboxCommand(ctx, env));

  bot.command("settings", (ctx) => handleSettingsCommand(ctx, env));

  bot.on("message", (ctx) => {
    if (ctx.message && isCommandMessage(ctx.message)) {
      return;
    }

    return handleMessage(ctx, env, BOT_USERNAME, PUBLIC_SITE_URL);
  });

  const onInboxCallback =
    (handler: (ctx: Context, env: Environment) => Promise<void>) =>
    (ctx: Context) =>
      handler(ctx, env);

  bot.callbackQuery(/^r:([a-f0-9]{8})$/, onInboxCallback(handleReplyAction));
  bot.callbackQuery(/^b:([a-f0-9]{8})$/, onInboxCallback(handleBlockAction));
  bot.callbackQuery(/^u:([a-f0-9]{8})$/, onInboxCallback(handleUnblockAction));
  bot.callbackQuery(/^n:([a-f0-9]{8})$/, onInboxCallback(handleNicknameAction));
  bot.callbackQuery(/^rp:([a-f0-9]{8})$/, onInboxCallback(handleReportAction));

  cachedBot = { key: cacheKey, bot };
  return bot;
};
