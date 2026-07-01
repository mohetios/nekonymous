import type { Context } from "grammy";
import type { BotUser, Environment } from "../../types";
import {
  buildConfirmClearBlocksKeyboard,
  buildConfirmClearDataKeyboard,
  buildConfirmResetMatchKeyboard,
  buildSettingsMenu,
  mainMenu,
} from "../../bot/keyboards";
import { isMenuLabel, MENU } from "../../bot/menu";
import { logBotError } from "../../utils/logs";
import {
  SETTINGS_BACK_MESSAGE,
  SETTINGS_BLOCK_LIST_EMPTY_MESSAGE,
  SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE,
  SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE,
  SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE,
  SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE,
  SETTINGS_CLEAR_DATA_DONE_MESSAGE,
  SETTINGS_CLEAR_DATA_WARNING_MESSAGE,
  SETTINGS_EDIT_NAME_MESSAGE,
  SETTINGS_CANCEL_DRAFT_MESSAGE,
  SETTINGS_PAUSE_ON_MESSAGE,
  SETTINGS_RESUME_MESSAGE,
  SETTINGS_NAME_INVALID_MESSAGE,
  SETTINGS_NAME_SAVED_MESSAGE,
  SETTINGS_NAME_TEXT_ONLY_MESSAGE,
  SETTINGS_RESET_MATCH_CANCELLED_MESSAGE,
  SETTINGS_RESET_MATCH_DONE_MESSAGE,
  SETTINGS_RESET_MATCH_EMPTY_MESSAGE,
  SETTINGS_RESET_MATCH_WARNING_MESSAGE,
  SETTINGS_RESET_MATCH_REQUESTS_CLEARED,
  SETTINGS_RESET_MATCH_BLOCKS_CLEARED,
  TECHNICAL_ABOUT_MESSAGE,
} from "./settings-copy";
import { HuhMessage, ABOUT_PRIVACY_COMMAND_MESSAGE } from "../../i18n/messages";
import { getPlatformStats } from "../platform/platform-stats-service";
import {
  convertToPersianNumbers,
  escapeHtml,
  withHtml,
} from "../../utils/tools";
import {
  buildUserDeepLink,
  sanitizeDisplayName,
} from "../../utils/user";
import {
  clearUserAccountAndRecreate,
  resolveOrCreateUser,
  toBotUser,
} from "../identity/identity-service";
import { encryptDisplayName } from "../../ticketing/ticketing-service";
import {
  countUserMatchHistory,
  resetUserMatchHistory,
} from "../matching/match-service";
import { SETTINGS_CALLBACK } from "./constants";
import {
  clearBlocks,
  clearDraft,
  setDisplayName,
  setDraft,
  setPaused,
} from "../../storage/user-state-client";
import { renderSettingsHome, renderStatsPage } from "./render-stats-page";
import { emitStat } from "../../stats/emit-stat";
import { STAT_EVENTS } from "../../stats/events";

const formatAboutPrivacyMessage = async (env: Environment): Promise<string> => {
  const stats = await getPlatformStats(env);
  return ABOUT_PRIVACY_COMMAND_MESSAGE.replace(
    "USERS_COUNT",
    convertToPersianNumbers(stats.usersCount)
  )
    .replace("MESSAGES_COUNT", convertToPersianNumbers(stats.conversationsCount))
    .replace(
      "ASSESSMENT_PROFILES_COUNT",
      convertToPersianNumbers(stats.assessmentProfilesCount)
    )
    .replace(
      "DISCOVERABLE_COUNT",
      convertToPersianNumbers(stats.discoverableProfilesCount)
    )
    .replace(
      "MATCH_REQUESTS_COUNT",
      convertToPersianNumbers(stats.matchRequestsCount)
    );
};

const showAboutPrivacy = async (
  ctx: Context,
  user: BotUser,
  env: Environment
): Promise<void> => {
  const message = await formatAboutPrivacyMessage(env);
  await ctx.reply(message, withHtml({ reply_markup: buildSettingsMenu(user.paused) }));
};

const showTechnicalAbout = async (
  ctx: Context,
  user: BotUser
): Promise<void> => {
  await ctx.reply(
    TECHNICAL_ABOUT_MESSAGE,
    withHtml({ reply_markup: buildSettingsMenu(user.paused) })
  );
};

const showSettingsHome = renderSettingsHome;

export const handleSettingsCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    await showSettingsHome(ctx, user);
  } catch (error) {
    logBotError("handleSettingsCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handlePendingSettingsInput = async (
  ctx: Context,
  user: BotUser,
  env: Environment
): Promise<boolean> => {
  if (user.pendingSettings !== "editName") {
    return false;
  }

  const text = ctx.message?.text;
  if (!text) {
    await ctx.reply(
      SETTINGS_NAME_TEXT_ONLY_MESSAGE,
      withHtml({ reply_markup: buildSettingsMenu(user.paused) })
    );
    return true;
  }

  if (isMenuLabel(text)) {
    return false;
  }

  if (!ctx.from) {
    return true;
  }

  const displayName = sanitizeDisplayName(text);
  if (!displayName) {
    await ctx.reply(
      SETTINGS_NAME_INVALID_MESSAGE,
      withHtml({ reply_markup: buildSettingsMenu(user.paused) })
    );
    return true;
  }

  try {
    const ciphertext = await encryptDisplayName(
      displayName,
      env.APP_MASTER_KEY
    );
    await setDisplayName(env, user.id, ciphertext);
    await clearDraft(env, user.id);
    await ctx.reply(
      SETTINGS_NAME_SAVED_MESSAGE.replace("NAME", escapeHtml(displayName)),
      withHtml({ reply_markup: buildSettingsMenu(user.paused) })
    );
  } catch (error) {
    logBotError("handlePendingSettingsInput", error);
    await ctx.reply(HuhMessage, {
      reply_markup: buildSettingsMenu(user.paused),
    });
  }

  return true;
};

export const handleSettingsMenu = async (
  ctx: Context,
  user: BotUser,
  env: Environment
): Promise<boolean> => {
  const text = ctx.message?.text;
  if (!text || !ctx.from) {
    return false;
  }

  switch (text) {
    case MENU.settings:
      await clearDraft(env, user.id);
      await showSettingsHome(ctx, user);
      return true;

    case MENU.settingsBack:
    case MENU.home:
      await clearDraft(env, user.id);
      await ctx.reply(SETTINGS_BACK_MESSAGE, withHtml({ reply_markup: mainMenu }));
      return true;

    case MENU.about:
      await showAboutPrivacy(ctx, user, env);
      return true;

    case MENU.stats:
      await clearDraft(env, user.id);
      await renderStatsPage(ctx, user, env);
      return true;

    case MENU.technical:
      await showTechnicalAbout(ctx, user);
      return true;

    case MENU.editName:
      await setDraft(env, user.id, {
        id: "primary",
        mode: "settings",
        pendingSettings: "editName",
      });
      await ctx.reply(
        SETTINGS_EDIT_NAME_MESSAGE,
        withHtml({ reply_markup: buildSettingsMenu(user.paused) })
      );
      return true;

    case MENU.cancelDraft:
      await clearDraft(env, user.id);
      await ctx.reply(
        SETTINGS_CANCEL_DRAFT_MESSAGE,
        withHtml({ reply_markup: mainMenu })
      );
      return true;

    case MENU.pauseInbox:
      await setPaused(env, user.id, true);
      await clearDraft(env, user.id);
      await emitStat(env, STAT_EVENTS.PAUSE_ENABLED);
      await ctx.reply(
        SETTINGS_PAUSE_ON_MESSAGE,
        withHtml({ reply_markup: buildSettingsMenu(true) })
      );
      return true;

    case MENU.resumeInbox:
      await setPaused(env, user.id, false);
      await emitStat(env, STAT_EVENTS.PAUSE_DISABLED);
      await ctx.reply(
        SETTINGS_RESUME_MESSAGE,
        withHtml({ reply_markup: buildSettingsMenu(false) })
      );
      return true;

    case MENU.clearBlockList:
      if (user.blockedUserIds.length === 0) {
        await ctx.reply(
          SETTINGS_BLOCK_LIST_EMPTY_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(user.paused) })
        );
        return true;
      }

      await setDraft(env, user.id, {
        id: "primary",
        mode: "settings",
        pendingSettings: "confirmClearBlockList",
      });
      await ctx.reply(
        SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE.replace(
          "COUNT",
          convertToPersianNumbers(user.blockedUserIds.length)
        ),
        withHtml({ reply_markup: buildConfirmClearBlocksKeyboard() })
      );
      return true;

    case MENU.resetMatchHistory: {
      const history = await countUserMatchHistory(user.id, env);
      if (history.requests === 0 && history.blocks === 0) {
        await ctx.reply(
          SETTINGS_RESET_MATCH_EMPTY_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(user.paused) })
        );
        return true;
      }

      await setDraft(env, user.id, {
        id: "primary",
        mode: "settings",
        pendingSettings: "confirmResetMatchHistory",
      });
      await ctx.reply(
        SETTINGS_RESET_MATCH_WARNING_MESSAGE.replace(
          "REQUEST_COUNT",
          convertToPersianNumbers(history.requests)
        ).replace(
          "BLOCK_COUNT",
          convertToPersianNumbers(history.blocks)
        ),
        withHtml({ reply_markup: buildConfirmResetMatchKeyboard() })
      );
      return true;
    }

    case MENU.clearData:
      await setDraft(env, user.id, {
        id: "primary",
        mode: "settings",
        pendingSettings: "confirmClearData",
      });
      await ctx.reply(
        SETTINGS_CLEAR_DATA_WARNING_MESSAGE,
        withHtml({ reply_markup: buildConfirmClearDataKeyboard() })
      );
      return true;

    default:
      return false;
  }
};

const resetMatchHistoryForUser = async (
  ctx: Context,
  user: BotUser,
  env: Environment
): Promise<void> => {
  const cleared = await resetUserMatchHistory(user.id, env);
  await clearDraft(env, user.id);
  const detailLines: string[] = [];
  if (cleared.requests > 0) {
    detailLines.push(
      SETTINGS_RESET_MATCH_REQUESTS_CLEARED.replace(
        "COUNT",
        convertToPersianNumbers(cleared.requests)
      )
    );
  }
  if (cleared.blocks > 0) {
    detailLines.push(
      SETTINGS_RESET_MATCH_BLOCKS_CLEARED.replace(
        "COUNT",
        convertToPersianNumbers(cleared.blocks)
      )
    );
  }
  const detail = detailLines.length > 0 ? `${detailLines.join("\n")}\n\n` : "";
  await ctx.reply(
    SETTINGS_RESET_MATCH_DONE_MESSAGE.replace("DETAIL_LINES", detail),
    withHtml({ reply_markup: buildSettingsMenu(user.paused) })
  );
};

export const handleSettingsCallback = async (
  ctx: Context,
  env: Environment,
  botUsername: string
): Promise<void> => {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  if (!from || !data) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);

    await ctx.answerCallbackQuery();

    if (data === SETTINGS_CALLBACK.stats) {
      await renderStatsPage(ctx, user, env);
      return;
    }

    if (data === SETTINGS_CALLBACK.back) {
      await showSettingsHome(ctx, user);
      return;
    }

    if (ctx.callbackQuery.message) {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    }

    if (data === SETTINGS_CALLBACK.cancel) {
      if (user.pendingSettings === "confirmClearBlockList") {
        await clearDraft(env, user.id);
        await ctx.reply(
          SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(user.paused) })
        );
        return;
      }
      if (user.pendingSettings === "confirmClearData") {
        await clearDraft(env, user.id);
        await ctx.reply(
          SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(user.paused) })
        );
        return;
      }
      if (user.pendingSettings === "confirmResetMatchHistory") {
        await clearDraft(env, user.id);
        await ctx.reply(
          SETTINGS_RESET_MATCH_CANCELLED_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(user.paused) })
        );
      }
      return;
    }

    if (data === SETTINGS_CALLBACK.confirmClearBlocks) {
      if (user.pendingSettings !== "confirmClearBlockList") {
        return;
      }
      await clearBlocks(env, user.id);
      await clearDraft(env, user.id);
      await ctx.reply(
        SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE,
        withHtml({ reply_markup: buildSettingsMenu(user.paused) })
      );
      return;
    }

    if (data === SETTINGS_CALLBACK.confirmResetMatch) {
      if (user.pendingSettings !== "confirmResetMatchHistory") {
        return;
      }
      await resetMatchHistoryForUser(ctx, user, env);
      return;
    }

    if (data === SETTINGS_CALLBACK.confirmClearData) {
      if (user.pendingSettings !== "confirmClearData") {
        return;
      }
      const freshD1 = await clearUserAccountAndRecreate(ctx, user.id, env);
      await emitStat(env, STAT_EVENTS.HARD_RESET);
      const freshUser = await toBotUser(freshD1, env);
      await clearDraft(env, freshUser.id);
      await ctx.reply(
        SETTINGS_CLEAR_DATA_DONE_MESSAGE.replace(
          "UUID_USER_URL",
          buildUserDeepLink(botUsername, freshUser.slug)
        ),
        withHtml({ reply_markup: mainMenu })
      );
    }
  } catch (error) {
    logBotError("handleSettingsCallback", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
