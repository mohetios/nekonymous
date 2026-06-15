import { Bot, type Context } from "grammy";
import type { Message } from "grammy/types";
import type { Environment, User } from "../types";
import { KVModel } from "../utils/kv-storage";
import { deferForUpdate, type NekoContext } from "../utils/worker";
import {
  handleBlockAction,
  handleNicknameAction,
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
  `${env.SECRET_TELEGRAM_API_TOKEN}\0${env.BOT_INFO}\0${env.APP_SECURE_KEY}`;

export const createBot = (env: Environment) => {
  const cacheKey = botCacheKey(env);
  if (cachedBot?.key === cacheKey) {
    return cachedBot.bot;
  }

  const {
    SECRET_TELEGRAM_API_TOKEN,
    NekonymousKV,
    BOT_INFO,
    BOT_USERNAME,
    APP_SECURE_KEY,
    INBOX_DO,
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

  const userModel = new KVModel<User>("user", NekonymousKV);
  const conversationModel = new KVModel<string>("conversation", NekonymousKV);
  const userUUIDtoId = new KVModel<string>("userUUIDtoId", NekonymousKV);
  const statsModel = new KVModel<number>("stats", NekonymousKV);

  bot.command("start", (ctx) =>
    handleStartCommand(ctx, userModel, userUUIDtoId, statsModel, BOT_USERNAME)
  );

  bot.command("inbox", (ctx) =>
    handleInboxCommand(
      ctx,
      userModel,
      conversationModel,
      INBOX_DO,
      APP_SECURE_KEY
    )
  );

  bot.command("settings", (ctx) =>
    handleSettingsCommand(ctx, {
      userModel,
      userUUIDtoId,
      conversationModel,
      statsModel,
      inbox: INBOX_DO,
      botUsername: BOT_USERNAME,
      publicSiteUrl: PUBLIC_SITE_URL,
    })
  );

  bot.on("message", (ctx) => {
    if (ctx.message && isCommandMessage(ctx.message)) {
      return;
    }

    return handleMessage(
      ctx,
      userModel,
      conversationModel,
      userUUIDtoId,
      INBOX_DO,
      statsModel,
      APP_SECURE_KEY,
      BOT_USERNAME,
      PUBLIC_SITE_URL
    );
  });

  const onInboxCallback =
    (
      handler: (
        ctx: Context,
        userModel: KVModel<User>,
        conversationModel: KVModel<string>,
        statsModel: KVModel<number>,
        inbox: Environment["INBOX_DO"],
        appSecureKey: string
      ) => Promise<void>
    ) =>
    (ctx: Context) =>
      handler(
        ctx,
        userModel,
        conversationModel,
        statsModel,
        INBOX_DO,
        APP_SECURE_KEY
      );

  bot.callbackQuery(/^rpl:([a-f0-9]{8})$/, onInboxCallback(handleReplyAction));
  bot.callbackQuery(/^blk:([a-f0-9]{8})$/, onInboxCallback(handleBlockAction));
  bot.callbackQuery(/^ubl:([a-f0-9]{8})$/, onInboxCallback(handleUnblockAction));
  bot.callbackQuery(/^nnk:([a-f0-9]{8})$/, onInboxCallback(handleNicknameAction));

  cachedBot = { key: cacheKey, bot };
  return bot;
};
