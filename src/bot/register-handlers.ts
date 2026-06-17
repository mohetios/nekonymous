import type { Bot, Context } from "grammy";
import type { Message } from "grammy/types";
import type { Environment } from "../types";
import {
  handleBlockAction,
  handleNicknameAction,
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

  const onInboxCallback =
    (handler: (ctx: Context, env: Environment) => Promise<void>) =>
    (ctx: Context) =>
      handler(ctx, env);

  bot.callbackQuery(/^r:([a-f0-9]{8})$/, onInboxCallback(handleReplyAction));
  bot.callbackQuery(/^b:([a-f0-9]{8})$/, onInboxCallback(handleBlockAction));
  bot.callbackQuery(/^u:([a-f0-9]{8})$/, onInboxCallback(handleUnblockAction));
  bot.callbackQuery(/^n:([a-f0-9]{8})$/, onInboxCallback(handleNicknameAction));
  bot.callbackQuery(/^rp:([a-f0-9]{8})$/, onInboxCallback(handleReportAction));

  bot.callbackQuery(/^t:/, (ctx) => handleAssessmentCallback(ctx, env));

  bot.callbackQuery(/^m:/, (ctx) => handleMatchCallback(ctx, env));

  bot.callbackQuery(/^ms:/, (ctx) => handleMatchSystemCallback(ctx, env));
};
