import type { Context } from "grammy";
import type { Environment } from "../../types";
import { logBotError } from "../../utils/logs";
import { HuhMessage } from "../../i18n/messages";
import { SETTINGS_BACK_MESSAGE } from "../../i18n/settings";
import {
  buildMatchHubDiscoverabilityKeyboard,
  buildMatchProfileEmptyMenu,
  buildMatchProfileReadyMenu,
  buildMatchSystemMenu,
  mainMenu,
} from "../../bot/keyboards";
import { MENU } from "../../bot/menu";
import { withHtml } from "../../utils/tools";
import { resolveOrCreateUser } from "../identity/identity-service";
import { emitStat } from "../../stats/emit-stat";
import { STAT_EVENTS } from "../../stats/events";
import { getLatestAssessmentProfile } from "../assessment/assessment-profile-service";
import { MATCH_SYSTEM_CALLBACK, MATCH_SYSTEM_INTRO } from "./match-system-callbacks";
import { MATCH_DISABLED, MATCH_ENABLED } from "./match-copy";
import { formatMatchProfileMessage } from "./match-profile-view";
import {
  disableDiscoverability,
  enableDiscoverability,
  expireOldMatchRequests,
  resolveMatchHubMenuOptions,
  resolveMatchHubMenuVariant,
} from "./match-service";
import { sendAssessmentDashboard } from "../assessment/assessment-handlers";
import { sendMatchDashboard, sendPendingMatchRequests } from "./match-handlers";
import { ASSESSMENT_BUTTON } from "../../i18n/labels";

const matchHubReplyMenu = async (userId: string, env: Environment) => {
  const options = await resolveMatchHubMenuOptions(userId, env);
  return buildMatchSystemMenu(options);
};

export const sendMatchSystemHub = async (
  ctx: Context,
  env: Environment,
  userId: string
): Promise<void> => {
  const [variant, replyMenu] = await Promise.all([
    resolveMatchHubMenuVariant(userId, env),
    matchHubReplyMenu(userId, env),
  ]);
  const discoverabilityKeyboard = buildMatchHubDiscoverabilityKeyboard(variant);

  if (discoverabilityKeyboard) {
    await ctx.reply(MATCH_SYSTEM_INTRO, withHtml({
      reply_markup: discoverabilityKeyboard,
    }));
    await ctx.reply("از دکمه‌های پایین برای ادامه استفاده کن.", {
      reply_markup: replyMenu,
    });
    return;
  }

  await ctx.reply(MATCH_SYSTEM_INTRO, withHtml({ reply_markup: replyMenu }));
};

const sendMatchHubIntro = (
  ctx: Context,
  env: Environment,
  userId: string
): Promise<void> => sendMatchSystemHub(ctx, env, userId);

export const sendMatchProfileScreen = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const profile = await getLatestAssessmentProfile(userId, env);
  const { text, hasProfile } = formatMatchProfileMessage(profile);
  const replyMenu = hasProfile
    ? buildMatchProfileReadyMenu()
    : buildMatchProfileEmptyMenu();
  const variant = await resolveMatchHubMenuVariant(userId, env);
  const discoverabilityKeyboard = buildMatchHubDiscoverabilityKeyboard(variant);

  if (discoverabilityKeyboard) {
    await ctx.reply(text, withHtml({ reply_markup: discoverabilityKeyboard }));
    await ctx.reply("از دکمه‌های پایین برای ادامه استفاده کن.", {
      reply_markup: replyMenu,
    });
    return;
  }

  await ctx.reply(text, withHtml({ reply_markup: replyMenu }));
};

const isAssessmentMenuLabel = (text: string): boolean =>
  text === MENU.matchAssessment ||
  text === MENU.matchAssessmentRetry ||
  text === ASSESSMENT_BUTTON.continue;

const MATCH_SYSTEM_MENU_LABELS = new Set<string>([
  MENU.matchSystem,
  MENU.matchProfile,
  MENU.matchFind,
  MENU.matchPending,
  MENU.matchAssessment,
  MENU.matchAssessmentRetry,
  ASSESSMENT_BUTTON.continue,
  MENU.hubBack,
  MENU.home,
]);

export const handleMatchSystemCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    await sendMatchSystemHub(ctx, env, d1User.id);
  } catch (error) {
    logBotError("handleMatchSystemCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleMatchSystemMenu = async (
  ctx: Context,
  env: Environment
): Promise<boolean> => {
  const text = ctx.message?.text;
  if (!text || !MATCH_SYSTEM_MENU_LABELS.has(text)) {
    return false;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const userId = d1User.id;
    const hubMenu = await matchHubReplyMenu(userId, env);

    switch (text) {
      case MENU.matchSystem:
        await sendMatchHubIntro(ctx, env, userId);
        return true;

      case MENU.hubBack:
        await sendMatchHubIntro(ctx, env, userId);
        return true;

      case MENU.home:
        await ctx.reply(SETTINGS_BACK_MESSAGE, withHtml({ reply_markup: mainMenu }));
        return true;

      case MENU.matchProfile:
        await sendMatchProfileScreen(ctx, userId, env);
        return true;

      case MENU.matchFind: {
        const options = await resolveMatchHubMenuOptions(userId, env);
        if (!options.showFind) {
          await ctx.reply(
            "برای پیدا کردن گزینه‌ها، اول ارزیابی سبک گفت‌وگو را کامل کن.",
            withHtml({ reply_markup: hubMenu })
          );
          return true;
        }
        await expireOldMatchRequests(env);
        await sendMatchDashboard(ctx, userId, env);
        return true;
      }

      case MENU.matchPending:
        await sendPendingMatchRequests(ctx, userId, env);
        return true;

      case MENU.matchAssessment:
      case MENU.matchAssessmentRetry:
        if (isAssessmentMenuLabel(text)) {
          await sendAssessmentDashboard(ctx, userId, env);
          return true;
        }
        return false;

      default:
        if (text === ASSESSMENT_BUTTON.continue) {
          await sendAssessmentDashboard(ctx, userId, env);
          return true;
        }
        return false;
    }
  } catch (error) {
    logBotError("handleMatchSystemMenu", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    return true;
  }
};

/** Inline `ms:` callbacks on existing messages. */
export const handleMatchSystemCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  if (!from || !data) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const userId = d1User.id;

    await ctx.answerCallbackQuery();

    if (ctx.callbackQuery.message) {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    }

    switch (data) {
      case MATCH_SYSTEM_CALLBACK.hub:
      case MATCH_SYSTEM_CALLBACK.back:
        await sendMatchHubIntro(ctx, env, userId);
        return;

      case MATCH_SYSTEM_CALLBACK.profile:
        await sendMatchProfileScreen(ctx, userId, env);
        return;

      case MATCH_SYSTEM_CALLBACK.find: {
        const options = await resolveMatchHubMenuOptions(userId, env);
        if (!options.showFind) {
          await sendMatchHubIntro(ctx, env, userId);
          return;
        }
        await expireOldMatchRequests(env);
        await sendMatchDashboard(ctx, userId, env);
        return;
      }

      case MATCH_SYSTEM_CALLBACK.assessment:
        await sendAssessmentDashboard(ctx, userId, env);
        return;

      case MATCH_SYSTEM_CALLBACK.enable: {
        const result = await enableDiscoverability(userId, env);
        if (!result.ok) {
          await sendMatchDashboard(ctx, userId, env);
          return;
        }
        await emitStat(env, STAT_EVENTS.DISCOVERABILITY_ENABLED);
        await ctx.reply(MATCH_ENABLED, {
          reply_markup: await matchHubReplyMenu(userId, env),
        });
        return;
      }

      case MATCH_SYSTEM_CALLBACK.disable: {
        await disableDiscoverability(userId, env);
        await emitStat(env, STAT_EVENTS.DISCOVERABILITY_DISABLED);
        await ctx.reply(MATCH_DISABLED, {
          reply_markup: await matchHubReplyMenu(userId, env),
        });
        return;
      }

      default:
        await sendMatchHubIntro(ctx, env, userId);
    }
  } catch (error) {
    logBotError("handleMatchSystemCallback", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
