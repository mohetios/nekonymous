import type { Context } from "grammy";
import type { BotUser } from "../../contracts/identity/model";
import type { Environment } from "../../contracts/runtime";
import { renderScreen } from "../../bot/render-screen";
import { logBotError } from "../../utils/logs";
import { withHtml } from "../../utils/text";
import { getPublicBotStats } from "../../stats/stats-reader";
import {
  formatPublicBotStatsMessage,
  SETTINGS_STATS_ERROR_MESSAGE,
} from "../../stats/stats-format";
import { formatSettingsHome } from "./settings-home";
import { buildSettingsBackKeyboard, buildSettingsHomeKeyboard } from "./keyboards";

export const renderSettingsHome = async (
  ctx: Context,
  user: BotUser
): Promise<void> => {
  await renderScreen(ctx, {
    text: formatSettingsHome(user),
    replyMarkup: buildSettingsHomeKeyboard(user.paused),
  });
};

export const renderStatsPage = async (
  ctx: Context,
  _user: BotUser,
  env: Environment
): Promise<void> => {
  try {
    const stats = await getPublicBotStats(env);
    const message = formatPublicBotStatsMessage(stats);
    await renderScreen(ctx, {
      text: message,
      replyMarkup: buildSettingsBackKeyboard(),
    });
  } catch (error) {
    logBotError("renderStatsPage", error);
    await ctx.reply(SETTINGS_STATS_ERROR_MESSAGE, withHtml({
      reply_markup: buildSettingsBackKeyboard(),
    }));
  }
};
