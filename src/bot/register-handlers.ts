import type { Bot, Context } from "grammy";
import type { Message } from "grammy/types";
import type { Environment } from "../types";
import { UNKNOWN_COMMAND_MESSAGE } from "../i18n/messages";
import { mainMenu } from "./keyboards";
import {
  handleBlockAction,
  handleNicknameAction,
  handleOpenTicketAction,
  handleReportAction,
  handleReplyAction,
  handleUnblockAction,
} from "../features/messaging/messaging-actions";
import {
  handleInboxCommand,
  handleMessage,
  handleStartCommand,
} from "../features/messaging/messaging-commands";
import { handleSettingsCommand } from "../features/settings/settings-handlers";
import {
  handleAssessmentCallback,
  handleAssessmentCommand,
} from "../features/assessment/assessment-handlers";
import {
  handleMatchCallback,
  handleMatchCommand,
} from "../features/matching/match-handlers";
import {
  handleMatchSystemCallback,
  handleMatchSystemCommand,
} from "../features/matching/match-system-handlers";

const isCommandMessage = (message: Message): boolean =>
  message.text?.startsWith("/") === true ||
  message.entities?.some(
    (entity) => entity.type === "bot_command" && entity.offset === 0
  ) === true;

const KNOWN_COMMANDS = new Set([
  "start",
  "inbox",
  "settings",
  "assessment",
  "match",
  "match_system",
]);

const unknownCommandName = (text: string): string | null => {
  if (!text.startsWith("/")) {
    return null;
  }
  const token = text.split(/\s/)[0]?.slice(1);
  if (!token) {
    return null;
  }
  return token.split("@")[0]?.toLowerCase() ?? null;
};

export const registerHandlers = (bot: Bot, env: Environment): void => {
  const { BOT_USERNAME } = env;

  bot.command("start", (ctx) => handleStartCommand(ctx, env, BOT_USERNAME));

  bot.command("inbox", (ctx) => handleInboxCommand(ctx, env));

  bot.command("settings", (ctx) => handleSettingsCommand(ctx, env));

  bot.command("assessment", (ctx) => handleAssessmentCommand(ctx, env));

  bot.command("match", (ctx) => handleMatchCommand(ctx, env));

  bot.command("match_system", (ctx) => handleMatchSystemCommand(ctx, env));

  bot.on("message", (ctx) => {
    if (ctx.message && isCommandMessage(ctx.message)) {
      return;
    }

    return handleMessage(ctx, env, BOT_USERNAME);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message?.text;
    if (!text) {
      return;
    }

    const command = unknownCommandName(text);
    if (!command || KNOWN_COMMANDS.has(command)) {
      return;
    }

    await ctx.reply(UNKNOWN_COMMAND_MESSAGE, { reply_markup: mainMenu });
  });

  const onInboxCallback =
    (handler: (ctx: Context, env: Environment) => Promise<void>) =>
    (ctx: Context) =>
      handler(ctx, env);

  bot.callbackQuery(/^o:([A-Za-z0-9_-]{32})$/, onInboxCallback(handleOpenTicketAction));
  bot.callbackQuery(/^r:([A-Za-z0-9_-]{32})$/, onInboxCallback(handleReplyAction));
  bot.callbackQuery(/^b:([A-Za-z0-9_-]{32})$/, onInboxCallback(handleBlockAction));
  bot.callbackQuery(/^u:([A-Za-z0-9_-]{32})$/, onInboxCallback(handleUnblockAction));
  bot.callbackQuery(/^n:([A-Za-z0-9_-]{32})$/, onInboxCallback(handleNicknameAction));
  bot.callbackQuery(/^rp:([A-Za-z0-9_-]{32})$/, onInboxCallback(handleReportAction));

  bot.callbackQuery(/^t:/, (ctx) => handleAssessmentCallback(ctx, env));

  bot.callbackQuery(/^m:/, (ctx) => handleMatchCallback(ctx, env));

  bot.callbackQuery(/^ms:/, (ctx) => handleMatchSystemCallback(ctx, env));
};
