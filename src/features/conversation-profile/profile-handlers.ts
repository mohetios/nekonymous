import type { Context } from "grammy";
import type { Environment } from "../../types";
import { mainMenu } from "../../bot/keyboards";
import { renderScreen } from "../../bot/render-screen";
import { HuhMessage } from "../../i18n/messages";
import {
  PROFILE_COMPLETION_NOTE,
  PROFILE_DASHBOARD_INTRO,
  PROFILE_EXIT_SAVED,
  PROFILE_RESET_CONFIRM,
  PROFILE_RESULT_READY_TITLE,
  PROFILE_STATUS_HEADER,
  PROFILE_SUBMIT_READY,
} from "../../i18n/conversation-profile-ui";
import { resolveOrCreateUser } from "../identity/identity-service";
import { hmacTelegramUserId } from "../ticketing/ticketing-service";
import { emitStat } from "../../stats/emit-stat";
import { STAT_EVENTS } from "../../stats/events";
import { escapeHtml, withHtml } from "../../utils/tools";
import { logBotError } from "../../utils/logs";
import { renderSuggestionHub } from "../conversation-suggestions/suggestion-hub";
import { PROFILE_CALLBACK } from "./constants.ts";
import {
  buildProfileDashboardKeyboard,
  buildQuestionKeyboard,
  buildResetConfirmKeyboard,
  buildResultKeyboard,
  dashboardStatusLine,
  formatQuestionMessage,
  resumeQuestionIndex,
} from "./keyboards.ts";
import {
  getProfileSession,
  getProfileSessionProgress,
  profileSessionIsReady,
  saveProfileAnswer,
  setProfileCurrentIndex,
  startProfileSession,
} from "./profile-session-service.ts";
import {
  finalizeProfileSession,
  getProfileDashboardMeta,
  prepareProfileRetake,
} from "./profile-service.ts";
import { PROFILE_QUESTION_BY_INDEX, PROFILE_QUESTIONS } from "./question-bank.ts";
import {
  assertValidAnswerPatch,
  isConversationIntent,
} from "./validation.ts";
import { buildProfileSummaryText } from "./profile-summary.ts";

const parseAnswerCallback = (
  data: string
): { index: number; value: number } | null => {
  const match = /^t:a:(\d+):(\d+)$/.exec(data);
  if (!match) {
    return null;
  }
  return {
    index: Number(match[1]),
    value: Number(match[2]),
  };
};

const parseIntentCallback = (data: string): string | null => {
  const match = /^t:i:(.+)$/.exec(data);
  return match?.[1] ?? null;
};

export const sendProfileDashboard = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const [session, meta] = await Promise.all([
    getProfileSession(env, userId),
    getProfileDashboardMeta(env, userId),
  ]);

  const progress = session
    ? getProfileSessionProgress(session)
    : { answered: 0, total: 25 };
  const status = dashboardStatusLine({
    hasProfile: meta.hasProfile,
    hasSession: !!session,
    answeredCount: progress.answered,
  });

  const text =
    `${PROFILE_DASHBOARD_INTRO}\n\n` +
    `<b>${PROFILE_STATUS_HEADER}</b>\n${escapeHtml(status)}`;

  await renderScreen(ctx, {
    text,
    replyMarkup: buildProfileDashboardKeyboard({
      hasProfile: meta.hasProfile,
      hasSession: !!session,
      readyToSubmit: session ? profileSessionIsReady(session) : false,
    }),
  });
};

const showQuestion = async (ctx: Context, index: number): Promise<void> => {
  await renderScreen(ctx, {
    text: formatQuestionMessage(index),
    replyMarkup: buildQuestionKeyboard(index),
  });
};

const showSubmitPrompt = async (ctx: Context): Promise<void> => {
  await renderScreen(ctx, {
    text: PROFILE_SUBMIT_READY,
    replyMarkup: buildProfileDashboardKeyboard({
      hasProfile: false,
      hasSession: true,
      readyToSubmit: true,
    }),
  });
};

const startNewProfileSession = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  await prepareProfileRetake(env, userId);
  await startProfileSession(env, userId);
  await emitStat(env, STAT_EVENTS.PROFILE_STARTED);
  await showQuestion(ctx, 0);
};

const completeProfile = async (
  ctx: Context,
  userId: string,
  env: Environment,
  telegramUserId: number
): Promise<void> => {
  const actorHash = await hmacTelegramUserId(env.APP_HMAC_PEPPER, telegramUserId);
  const result = await finalizeProfileSession(env, userId, actorHash, "fa");
  await emitStat(env, STAT_EVENTS.PROFILE_COMPLETED);

  const summary = escapeHtml(buildProfileSummaryText(result.profile, "fa"));
  const text =
    `${PROFILE_RESULT_READY_TITLE}\n\n${summary}${PROFILE_COMPLETION_NOTE}`;

  await renderScreen(ctx, {
    text,
    replyMarkup: buildResultKeyboard(),
  });
};

export const handleAssessmentCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const user = await resolveOrCreateUser(ctx, env);
    await sendProfileDashboard(ctx, user.id, env);
  } catch (error) {
    logBotError("profile.command", error);
    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  }
};

export const handleAssessmentCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  if (!from || !data) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const user = await resolveOrCreateUser(ctx, env);

    if (data === PROFILE_CALLBACK.hub) {
      await renderSuggestionHub(ctx, env, from.id.toString());
      return;
    }

    if (data === PROFILE_CALLBACK.start || data === PROFILE_CALLBACK.continue) {
      const session = await getProfileSession(env, user.id);
      if (!session || data === PROFILE_CALLBACK.start) {
        await startNewProfileSession(ctx, user.id, env);
        return;
      }
      const index = resumeQuestionIndex(session);
      if (profileSessionIsReady(session)) {
        await showSubmitPrompt(ctx);
      } else {
        await showQuestion(ctx, index);
      }
      return;
    }

    if (data === PROFILE_CALLBACK.exit) {
      await ctx.reply(PROFILE_EXIT_SAVED, withHtml({ reply_markup: mainMenu }));
      return;
    }

    if (data === PROFILE_CALLBACK.reset) {
      await renderScreen(ctx, {
        text: PROFILE_RESET_CONFIRM,
        replyMarkup: buildResetConfirmKeyboard(),
      });
      return;
    }

    if (data === PROFILE_CALLBACK.resetNo) {
      await sendProfileDashboard(ctx, user.id, env);
      return;
    }

    if (data === PROFILE_CALLBACK.resetYes) {
      await startNewProfileSession(ctx, user.id, env);
      return;
    }

    if (data === PROFILE_CALLBACK.submit) {
      await completeProfile(ctx, user.id, env, from.id);
      return;
    }

    if (data === PROFILE_CALLBACK.result) {
      const meta = await getProfileDashboardMeta(env, user.id);
      if (!meta.hasProfile) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      const session = await getProfileSession(env, user.id);
      if (session && profileSessionIsReady(session)) {
        await completeProfile(ctx, user.id, env, from.id);
        return;
      }
      await sendProfileDashboard(ctx, user.id, env);
      return;
    }

    if (data === PROFILE_CALLBACK.previous) {
      const session = await getProfileSession(env, user.id);
      if (!session) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      const index = Math.max(0, session.currentIndex - 1);
      await setProfileCurrentIndex(env, user.id, index);
      await showQuestion(ctx, index);
      return;
    }

    const intent = parseIntentCallback(data);
    if (intent) {
      const session = await getProfileSession(env, user.id);
      const question = PROFILE_QUESTIONS[PROFILE_QUESTIONS.length - 1];
      if (!session || !isConversationIntent(intent)) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      assertValidAnswerPatch(question.id, intent);
      const updated = await saveProfileAnswer(
        env,
        user.id,
        question.id,
        intent,
        question.index
      );
      if (profileSessionIsReady(updated)) {
        await showSubmitPrompt(ctx);
      } else {
        await showQuestion(ctx, updated.currentIndex);
      }
      return;
    }

    const answer = parseAnswerCallback(data);
    if (answer) {
      const question = PROFILE_QUESTION_BY_INDEX.get(answer.index);
      const session = await getProfileSession(env, user.id);
      if (!question || !session) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      assertValidAnswerPatch(question.id, answer.value);
      const updated = await saveProfileAnswer(
        env,
        user.id,
        question.id,
        answer.value,
        answer.index
      );
      if (profileSessionIsReady(updated)) {
        await showSubmitPrompt(ctx);
      } else if (updated.currentIndex >= PROFILE_QUESTIONS.length) {
        await showSubmitPrompt(ctx);
      } else {
        await showQuestion(ctx, updated.currentIndex);
      }
      return;
    }

    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  } catch (error) {
    logBotError("profile.callback", error);
    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  } finally {
    await ctx.answerCallbackQuery();
  }
};
