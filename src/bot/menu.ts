import type { Context } from "grammy";
import type { Environment } from "../types";
import type { BotUser } from "../types";
import {
  OWNER_PAUSED_NOTE,
  USER_LINK_MESSAGE,
} from "../i18n/messages";
import { withHtml } from "../utils/tools";
import { buildUserDeepLink } from "../utils/user";
import { mainMenu } from "./keyboards";
import { isMainMenuLabel, MENU } from "./menu-labels";
import { handleInboxCommand } from "../features/messaging/messaging-commands";
import { renderSettingsHome } from "../features/settings/render-stats-page";
import { renderSuggestionHub } from "../features/conversation-suggestions/suggestion-hub";

export { MENU, isMainMenuLabel, isReservedDisplayName } from "./menu-labels";

export const handleMainMenuCommand = async (
  ctx: Context,
  user: BotUser,
  env: Environment,
  botUsername: string
): Promise<boolean> => {
  const msgPayload = ctx.message?.text;
  if (!msgPayload || !isMainMenuLabel(msgPayload)) {
    return false;
  }

  switch (msgPayload) {
    case MENU.link: {
      const linkText = USER_LINK_MESSAGE.replace(
        "UUID_USER_URL",
        buildUserDeepLink(botUsername, user.slug)
      );
      await ctx.reply(
        user.paused ? `${OWNER_PAUSED_NOTE}\n\n${linkText}` : linkText,
        withHtml({ reply_markup: mainMenu })
      );
      return true;
    }
    case MENU.inbox:
      await handleInboxCommand(ctx, env);
      return true;
    case MENU.matchSystem:
      await renderSuggestionHub(ctx, env, user.id);
      return true;
    case MENU.settings:
      await renderSettingsHome(ctx, user);
      return true;
    default:
      return false;
  }
};
