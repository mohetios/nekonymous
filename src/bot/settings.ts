import type { Context } from "grammy";
import type { Environment, User } from "../types";
import {
  buildSettingsMenu,
  confirmClearBlocksMenu,
  confirmClearMenu,
  isMenuLabel,
  MENU,
  mainMenu,
} from "../utils/constant";
import type { KVModel } from "../utils/kv-storage";
import { logBotError } from "../utils/logs";
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
  SETTINGS_HOME_MESSAGE,
  SETTINGS_CANCEL_DRAFT_MESSAGE,
  SETTINGS_PAUSE_ON_MESSAGE,
  SETTINGS_RESUME_MESSAGE,
  SETTINGS_NAME_INVALID_MESSAGE,
  SETTINGS_NAME_SAVED_MESSAGE,
  SETTINGS_NAME_TEXT_ONLY_MESSAGE,
} from "../utils/messages-settings";
import { HuhMessage, RATE_LIMIT_MESSAGE } from "../utils/messages";
import {
  checkRateLimit,
  convertToPersianNumbers,
  escapeHtml,
  withHtml,
} from "../utils/tools";
import {
  deleteUserAccount,
  ensureUser,
  sanitizeDisplayName,
} from "../utils/user";

export type SettingsDeps = {
  userModel: KVModel<User>;
  userUUIDtoId: KVModel<string>;
  statsModel: KVModel<number>;
  inbox: Environment["INBOX_DO"];
};

const botLink = (userUUID: string): string =>
  `https://t.me/nekonymous_bot?start=${userUUID}`;

const formatSettingsHome = (user: User): string => {
  const paused = !!user.paused;
  return SETTINGS_HOME_MESSAGE.replace("USER_NAME", escapeHtml(user.userName))
    .replace("PAUSE_STATUS", paused ? "متوقف ⏸" : "فعال ✓")
    .replace(
      "PAUSE_ACTION_LABEL",
      paused ? MENU.resumeInbox : MENU.pauseInbox
    )
    .replace(
      "PAUSE_ACTION_DESC",
      paused
        ? "لینکت رو دوباره روشن می‌کنه."
        : "موقتاً پیام جدید نمی‌رسه."
    );
};

const showSettingsHome = async (
  ctx: Context,
  user: User
): Promise<void> => {
  await ctx.reply(
    formatSettingsHome(user),
    withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
  );
};

export const handleSettingsCommand = async (
  ctx: Context,
  deps: SettingsDeps
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const user = await ensureUser(
      from.id,
      from.first_name,
      deps.userModel,
      deps.userUUIDtoId,
      deps.statsModel
    );
    await showSettingsHome(ctx, user);
  } catch (error) {
    logBotError("handleSettingsCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handlePendingSettingsInput = async (
  ctx: Context,
  user: User,
  deps: SettingsDeps
): Promise<boolean> => {
  if (user.pendingSettings !== "editName") {
    return false;
  }

  const text = ctx.message?.text;
  if (!text) {
    await ctx.reply(
      SETTINGS_NAME_TEXT_ONLY_MESSAGE,
      withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
    );
    return true;
  }

  if (isMenuLabel(text)) {
    return false;
  }

  const userId = ctx.from?.id;
  if (userId === undefined) {
    return true;
  }

  if (checkRateLimit(user.lastMessage)) {
    await ctx.reply(RATE_LIMIT_MESSAGE, {
      reply_markup: buildSettingsMenu(!!user.paused),
    });
    return true;
  }

  const displayName = sanitizeDisplayName(text);
  if (!displayName) {
    await ctx.reply(
      SETTINGS_NAME_INVALID_MESSAGE,
      withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
    );
    return true;
  }

  try {
    await deps.userModel.updateField(userId.toString(), "userName", displayName);
    await deps.userModel.updateField(
      userId.toString(),
      "pendingSettings",
      undefined
    );
    await deps.userModel.updateField(
      userId.toString(),
      "lastMessage",
      Date.now()
    );
    const updated = await deps.userModel.get(userId.toString());
    await ctx.reply(
      SETTINGS_NAME_SAVED_MESSAGE.replace("NAME", escapeHtml(displayName)),
      withHtml({ reply_markup: buildSettingsMenu(!!updated?.paused) })
    );
  } catch (error) {
    logBotError("handlePendingSettingsInput", error);
    await ctx.reply(HuhMessage, {
      reply_markup: buildSettingsMenu(!!user.paused),
    });
  }

  return true;
};

export const handleSettingsMenu = async (
  ctx: Context,
  user: User,
  deps: SettingsDeps
): Promise<boolean> => {
  const text = ctx.message?.text;
  const userId = ctx.from?.id;
  if (!text || userId === undefined) {
    return false;
  }

  switch (text) {
    case MENU.settings:
      if (user.pendingSettings) {
        await deps.userModel.updateField(
          userId.toString(),
          "pendingSettings",
          undefined
        );
      }
      await showSettingsHome(ctx, user);
      return true;

    case MENU.back:
      if (user.pendingSettings) {
        await deps.userModel.updateField(
          userId.toString(),
          "pendingSettings",
          undefined
        );
      }
      await ctx.reply(SETTINGS_BACK_MESSAGE, withHtml({ reply_markup: mainMenu }));
      return true;

    case MENU.editName:
      await deps.userModel.updateField(
        userId.toString(),
        "currentConversation",
        undefined
      );
      await deps.userModel.updateField(
        userId.toString(),
        "pendingSettings",
        "editName"
      );
      await ctx.reply(
        SETTINGS_EDIT_NAME_MESSAGE,
        withHtml({ reply_markup: { force_reply: true as const } })
      );
      return true;

    case MENU.cancelDraft:
      await deps.userModel.updateField(
        userId.toString(),
        "currentConversation",
        undefined
      );
      await deps.userModel.updateField(
        userId.toString(),
        "pendingSettings",
        undefined
      );
      await ctx.reply(
        SETTINGS_CANCEL_DRAFT_MESSAGE,
        withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
      );
      return true;

    case MENU.pauseInbox:
      await deps.userModel.updateField(userId.toString(), "paused", true);
      await deps.userModel.updateField(
        userId.toString(),
        "currentConversation",
        undefined
      );
      await ctx.reply(
        SETTINGS_PAUSE_ON_MESSAGE,
        withHtml({ reply_markup: buildSettingsMenu(true) })
      );
      return true;

    case MENU.resumeInbox:
      await deps.userModel.updateField(userId.toString(), "paused", false);
      await ctx.reply(
        SETTINGS_RESUME_MESSAGE,
        withHtml({ reply_markup: buildSettingsMenu(false) })
      );
      return true;

    case MENU.clearBlockList:
      if (user.blockList.length === 0) {
        await ctx.reply(
          SETTINGS_BLOCK_LIST_EMPTY_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
        );
        return true;
      }

      await deps.userModel.updateField(
        userId.toString(),
        "pendingSettings",
        "confirmClearBlockList"
      );
      await ctx.reply(
        SETTINGS_CLEAR_BLOCKS_WARNING_MESSAGE.replace(
          "COUNT",
          convertToPersianNumbers(user.blockList.length)
        ),
        withHtml({ reply_markup: confirmClearBlocksMenu })
      );
      return true;

    case MENU.confirmClearBlocks:
      if (user.pendingSettings !== "confirmClearBlockList") {
        return false;
      }

      try {
        await deps.userModel.updateField(userId.toString(), "blockList", []);
        await deps.userModel.updateField(
          userId.toString(),
          "pendingSettings",
          undefined
        );
        await ctx.reply(
          SETTINGS_CLEAR_BLOCKS_DONE_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
        );
      } catch (error) {
        logBotError("handleSettingsMenu:clearBlockList", error);
        await ctx.reply(HuhMessage, {
          reply_markup: buildSettingsMenu(!!user.paused),
        });
      }
      return true;

    case MENU.clearData:
      await deps.userModel.updateField(
        userId.toString(),
        "currentConversation",
        undefined
      );
      await deps.userModel.updateField(
        userId.toString(),
        "pendingSettings",
        "confirmClearData"
      );
      await ctx.reply(
        SETTINGS_CLEAR_DATA_WARNING_MESSAGE,
        withHtml({ reply_markup: confirmClearMenu })
      );
      return true;

    case MENU.confirmClear:
      if (user.pendingSettings !== "confirmClearData") {
        return false;
      }

      try {
        await deleteUserAccount(
          userId,
          user,
          deps.userModel,
          deps.userUUIDtoId,
          deps.inbox
        );
        const freshUser = await ensureUser(
          userId,
          ctx.from?.first_name,
          deps.userModel,
          deps.userUUIDtoId,
          deps.statsModel
        );
        await ctx.reply(
          SETTINGS_CLEAR_DATA_DONE_MESSAGE.replace(
            "UUID_USER_URL",
            botLink(freshUser.userUUID)
          ),
          withHtml({ reply_markup: mainMenu })
        );
      } catch (error) {
        logBotError("handleSettingsMenu:clearData", error);
        await ctx.reply(HuhMessage, { reply_markup: mainMenu });
      }
      return true;

    case MENU.cancel:
      if (user.pendingSettings === "confirmClearBlockList") {
        await deps.userModel.updateField(
          userId.toString(),
          "pendingSettings",
          undefined
        );
        await ctx.reply(
          SETTINGS_CLEAR_BLOCKS_CANCELLED_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
        );
        return true;
      }
      if (user.pendingSettings === "confirmClearData") {
        await deps.userModel.updateField(
          userId.toString(),
          "pendingSettings",
          undefined
        );
        await ctx.reply(
          SETTINGS_CLEAR_DATA_CANCELLED_MESSAGE,
          withHtml({ reply_markup: buildSettingsMenu(!!user.paused) })
        );
        return true;
      }
      if (user.pendingSettings === "editName") {
        await deps.userModel.updateField(
          userId.toString(),
          "pendingSettings",
          undefined
        );
        await showSettingsHome(ctx, user);
        return true;
      }
      return false;

    default:
      return false;
  }
};
