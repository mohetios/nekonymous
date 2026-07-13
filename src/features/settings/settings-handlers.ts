import type { Context } from "grammy";
import type { BotUser } from "../../contracts/identity/model";
import type { Environment } from "../../contracts/runtime";
import { mainMenu } from "../../bot/keyboards";
import {
  buildDraftCancelKeyboard,
  INPUT_PLACEHOLDERS,
} from "../../bot/input-navigation";
import { renderScreen } from "../../bot/render-screen";
import { logBotError } from "../../utils/logs";
import {
  SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE,
  SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE,
  SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE,
  SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE,
  SETTINGS_CLEAR_DATA_DONE_MESSAGE,
  SETTINGS_CLEAR_DATA_WARNING_MESSAGE,
  SETTINGS_EDIT_NAME_MESSAGE,
  SETTINGS_NAME_INVALID_MESSAGE,
  SETTINGS_NAME_SAVED_MESSAGE,
  SETTINGS_NAME_TEXT_ONLY_MESSAGE,
  SETTINGS_RESET_MATCH_CANCELLED_MESSAGE,
  SETTINGS_RESET_MATCH_DONE_MESSAGE,
  SETTINGS_RESET_MATCH_WARNING_MESSAGE,
  SETTINGS_RESET_MATCH_REQUESTS_CLEARED,
  SETTINGS_RESET_MATCH_BLOCKS_CLEARED,
  SETTINGS_PAUSE_DONE_CALLBACK,
  SETTINGS_RESUME_DONE_CALLBACK,
  SETTINGS_BLOCK_LIST_EMPTY_CALLBACK,
  SETTINGS_RESET_MATCH_EMPTY_CALLBACK,
} from "../../i18n/settings";
import { HuhMessage, ABOUT_PRIVACY_COMMAND_MESSAGE } from "../../i18n/messages";
import {
  convertToPersianNumbers,
  escapeHtml,
  withHtml,
} from "../../utils/text";
import {
  buildUserDeepLink,
  sanitizeDisplayName,
} from "../../features/identity/user";
import {
  clearUserAccountAndRecreate,
  resolveOrCreateUser,
  toBotUser,
} from "../identity/identity-service";
import { encryptDisplayName } from "../ticketing/ticketing-service";
import {
  countUserMatchHistory,
  resetUserMatchHistory,
} from "../conversation/suggestions/pair-history";
import { SETTINGS_CALLBACK } from "./constants";
import {
  buildConfirmClearBlocksKeyboard,
  buildConfirmClearDataKeyboard,
  buildConfirmResetMatchKeyboard,
  buildSettingsAboutKeyboard,
  buildSettingsHomeKeyboard,
} from "./keyboards";
import {
  clearBlocks,
  clearDraft,
  setDisplayName,
  setDraft,
  setPaused,
} from "../../storage/user-state-client";
import { renderSettingsHome, renderStatsPage } from "./render-stats-page";
import {
  recordPauseEnabled,
  recordPauseDisabled,
  recordHardReset,
} from "../../stats/product-events";
import { formatSettingsHome } from "./settings-home";

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
    await renderSettingsHome(ctx, user);
  } catch (error) {
    logBotError("handleSettingsCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleDisplayNameInput = async (
  ctx: Context,
  user: BotUser,
  env: Environment
): Promise<boolean> => {
  const text = ctx.message?.text;
  if (!text) {
    await ctx.reply(
      SETTINGS_NAME_TEXT_ONLY_MESSAGE,
      withHtml({
        reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.display_name),
      })
    );
    return true;
  }

  if (!ctx.from) {
    return true;
  }

  const displayName = sanitizeDisplayName(text);
  if (!displayName) {
    await ctx.reply(
      SETTINGS_NAME_INVALID_MESSAGE,
      withHtml({
        reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.display_name),
      })
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
    const updatedUser = { ...user, displayName };
    await ctx.reply(
      SETTINGS_NAME_SAVED_MESSAGE.replace("NAME", escapeHtml(displayName)),
      withHtml({ reply_markup: mainMenu })
    );
    await renderSettingsHome(ctx, updatedUser);
  } catch (error) {
    logBotError("handleDisplayNameInput", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }

  return true;
};

const resetMatchHistoryForUser = async (
  ctx: Context,
  user: BotUser,
  env: Environment
): Promise<void> => {
  const cleared = await resetUserMatchHistory(user.id, env);
  await clearDraft(env, user.id);
  await ctx.answerCallbackQuery();
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
    withHtml({ reply_markup: mainMenu })
  );
  await renderSettingsHome(ctx, user);
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

    if (data === SETTINGS_CALLBACK.home) {
      await renderSettingsHome(ctx, user);
      return;
    }

    if (data === SETTINGS_CALLBACK.editName) {
      await setDraft(env, user.id, {
        id: "primary",
        mode: "display_name",
      });
      await ctx.answerCallbackQuery();
      await ctx.reply(
        SETTINGS_EDIT_NAME_MESSAGE,
        withHtml({
          reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.display_name),
        })
      );
      return;
    }

    if (data === SETTINGS_CALLBACK.pause) {
      await setPaused(env, user.id, true);
      await recordPauseEnabled(env);
      const updated = await toBotUser(d1User, env);
      await ctx.answerCallbackQuery({ text: SETTINGS_PAUSE_DONE_CALLBACK });
      await ctx.editMessageText(
        formatSettingsHome(updated),
        withHtml({ reply_markup: buildSettingsHomeKeyboard(true) })
      );
      return;
    }

    if (data === SETTINGS_CALLBACK.resume) {
      await setPaused(env, user.id, false);
      await recordPauseDisabled(env);
      const updated = await toBotUser(d1User, env);
      await ctx.answerCallbackQuery({ text: SETTINGS_RESUME_DONE_CALLBACK });
      await ctx.editMessageText(
        formatSettingsHome(updated),
        withHtml({ reply_markup: buildSettingsHomeKeyboard(false) })
      );
      return;
    }

    if (data === SETTINGS_CALLBACK.about) {
      await renderScreen(ctx, {
        text: ABOUT_PRIVACY_COMMAND_MESSAGE,
        replyMarkup: buildSettingsAboutKeyboard(),
      });
      return;
    }

    if (data === SETTINGS_CALLBACK.stats) {
      await renderStatsPage(ctx, user, env);
      return;
    }

    if (data === SETTINGS_CALLBACK.clearBlocks) {
      if (user.blockTags.length === 0) {
        await ctx.answerCallbackQuery({ text: SETTINGS_BLOCK_LIST_EMPTY_CALLBACK });
        return;
      }
      await setDraft(env, user.id, {
        id: "primary",
        mode: "settings",
        pendingSettings: "confirmClearBlockList",
      });
      await renderScreen(ctx, {
        text: SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE.replace(
          "COUNT",
          convertToPersianNumbers(user.blockTags.length)
        ),
        replyMarkup: buildConfirmClearBlocksKeyboard(),
      });
      return;
    }

    if (data === SETTINGS_CALLBACK.resetMatch) {
      const history = await countUserMatchHistory(user.id, env);
      if (history.requests === 0 && history.blocks === 0) {
        await ctx.answerCallbackQuery({ text: SETTINGS_RESET_MATCH_EMPTY_CALLBACK });
        return;
      }
      await setDraft(env, user.id, {
        id: "primary",
        mode: "settings",
        pendingSettings: "confirmResetMatchHistory",
      });
      await renderScreen(ctx, {
        text: SETTINGS_RESET_MATCH_WARNING_MESSAGE.replace(
          "REQUEST_COUNT",
          convertToPersianNumbers(history.requests)
        ).replace("BLOCK_COUNT", convertToPersianNumbers(history.blocks)),
        replyMarkup: buildConfirmResetMatchKeyboard(),
      });
      return;
    }

    if (data === SETTINGS_CALLBACK.clearData) {
      await setDraft(env, user.id, {
        id: "primary",
        mode: "settings",
        pendingSettings: "confirmClearData",
      });
      await renderScreen(ctx, {
        text: SETTINGS_CLEAR_DATA_WARNING_MESSAGE,
        replyMarkup: buildConfirmClearDataKeyboard(),
      });
      return;
    }

    if (data === SETTINGS_CALLBACK.cancel) {
      if (user.pendingSettings === "confirmClearBlockList") {
        await clearDraft(env, user.id);
        await ctx.reply(
          SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE,
          withHtml({ reply_markup: mainMenu })
        );
        await renderSettingsHome(ctx, user);
        return;
      }
      if (user.pendingSettings === "confirmClearData") {
        await clearDraft(env, user.id);
        await ctx.reply(
          SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE,
          withHtml({ reply_markup: mainMenu })
        );
        await renderSettingsHome(ctx, user);
        return;
      }
      if (user.pendingSettings === "confirmResetMatchHistory") {
        await clearDraft(env, user.id);
        await ctx.reply(
          SETTINGS_RESET_MATCH_CANCELLED_MESSAGE,
          withHtml({ reply_markup: mainMenu })
        );
        await renderSettingsHome(ctx, user);
      }
      return;
    }

    if (data === SETTINGS_CALLBACK.confirmClearBlocks) {
      if (user.pendingSettings !== "confirmClearBlockList") {
        await ctx.answerCallbackQuery();
        return;
      }
      await clearBlocks(env, user.id);
      await clearDraft(env, user.id);
      await ctx.answerCallbackQuery();
      await ctx.reply(
        SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE,
        withHtml({ reply_markup: mainMenu })
      );
      await renderSettingsHome(ctx, user);
      return;
    }

    if (data === SETTINGS_CALLBACK.confirmResetMatch) {
      if (user.pendingSettings !== "confirmResetMatchHistory") {
        await ctx.answerCallbackQuery();
        return;
      }
      await resetMatchHistoryForUser(ctx, user, env);
      return;
    }

    if (data === SETTINGS_CALLBACK.confirmClearData) {
      if (user.pendingSettings !== "confirmClearData") {
        await ctx.answerCallbackQuery();
        return;
      }
      const freshD1 = await clearUserAccountAndRecreate(ctx, user.id, env);
      await recordHardReset(env);
      const freshUser = await toBotUser(freshD1, env);
      await clearDraft(env, freshUser.id);
      await ctx.answerCallbackQuery();
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
