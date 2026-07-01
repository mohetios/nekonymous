import type { Context } from "grammy";
import type { BotUser, Environment } from "../../types";
import { buildSettingsMenu, buildStatsPageKeyboard } from "../../bot/keyboards";
import { logBotError } from "../../utils/logs";
import { withHtml } from "../../utils/tools";
import { getPublicBotStats } from "../../stats/stats-reader";
import {
  formatPublicBotStatsMessage,
  SETTINGS_STATS_ERROR_MESSAGE,
} from "../../stats/stats-format";
import { formatSettingsHome } from "./settings-home";

export const renderStatsPage = async (
  ctx: Context,
  user: BotUser,
  env: Environment
): Promise<void> => {
  try {
    const stats = await getPublicBotStats(env);
    const message = formatPublicBotStatsMessage(stats);
    await ctx.reply(message, withHtml({ reply_markup: buildStatsPageKeyboard() }));
  } catch (error) {
    logBotError("renderStatsPage", error);
    await ctx.reply(SETTINGS_STATS_ERROR_MESSAGE, withHtml({
      reply_markup: buildSettingsMenu(user.paused),
    }));
  }
};

export const renderSettingsHome = async (
  ctx: Context,
  user: BotUser
): Promise<void> => {
  await ctx.reply(
    formatSettingsHome(user),
    withHtml({ reply_markup: buildSettingsMenu(user.paused) })
  );
};
