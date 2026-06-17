import { InlineKeyboard, type Context } from "grammy";
import type { Environment } from "../../types";
import { logBotError } from "../../utils/logs";
import { HuhMessage } from "../../i18n/messages";
import { mainMenu } from "../../bot/keyboards";
import {
  convertToPersianNumbers,
  escapeHtml,
  withHtml,
} from "../../utils/tools";
import { resolveOrCreateUser } from "../identity/identity-service";
import {
  cancelAssessmentSession,
  getAssessmentSession,
  resetAssessmentSession,
  saveAssessmentAnswer,
  setAssessmentCurrentIndex,
  startAssessmentSession,
} from "../../storage/user-state-client";
import { ASSESSMENT_CALLBACK } from "./constants";
import {
  buildQuestionKeyboard,
  buildResetConfirmKeyboard,
  buildResultKeyboard,
  buildAssessmentDashboardKeyboard,
  dashboardStatusLine,
  formatQuestionMessage,
  ASSESSMENT_DASHBOARD_INTRO,
  ASSESSMENT_EXIT_SAVED,
  ASSESSMENT_FUTURE_MATCHING_NOTE,
  ASSESSMENT_RESET_CONFIRM,
} from "./keyboards";
import {
  completeAssessmentFlow,
  resumeQuestionIndex,
  scheduleProfileIndexing,
} from "./assessment-flow-service";
import {
  abandonActiveAssessmentAttempts,
  createAssessmentAttempt,
  getLatestAssessmentProfile,
  parseResultSummary,
  profileScoresFromRow,
} from "./assessment-profile-service";
import {
  CORE_DIMENSION_LABELS,
  type AssessmentResultSummary,
  type AssessmentScores,
} from "./scoring";
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_VERSION,
} from "./question-bank";
import type { NekoContext } from "../../utils/worker";

const formatPercent = (value: number): string =>
  convertToPersianNumbers(`${Math.round(value)}٪`);

const formatResultMessage = (
  summary: AssessmentResultSummary,
  scores: AssessmentScores,
  includeScores: boolean
): string => {
  const highlights = summary.highlights
    .map((line) => `• ${escapeHtml(line)}`)
    .join("\n");
  const cautions = summary.cautions
    .map((line) => `• ${escapeHtml(line)}`)
    .join("\n");

  let text =
    "✅ <b>نتیجه تست آماده شد</b>\n\n" +
    `<b>${escapeHtml(summary.title)}</b>\n\n` +
    `${escapeHtml(summary.shortDescription)}\n\n` +
    `<b>چند سیگنال اصلی:</b>\n${highlights}\n\n` +
    `<b>چند نکته برای گفت‌وگو:</b>\n${cautions}\n\n` +
    "این نتیجه برای کمک به پیشنهادهای آینده استفاده می‌شود، نه برای تشخیص روان‌شناسی." +
    ASSESSMENT_FUTURE_MATCHING_NOTE;

  if (includeScores) {
    const scoreLines = (
      Object.keys(CORE_DIMENSION_LABELS) as Array<
        keyof typeof CORE_DIMENSION_LABELS
      >
    )
      .map(
        (key) =>
          `${CORE_DIMENSION_LABELS[key]}: ${formatPercent(scores[key])}`
      )
      .join("\n");

    text += `\n\n<b>نمای کلی:</b>\n${escapeHtml(scoreLines)}`;
  }

  return text;
};

export const sendAssessmentDashboard = async (
  ctx: Context,
  userId: string,
  env: Environment,
  edit = false
): Promise<void> => {
  const [session, profile] = await Promise.all([
    getAssessmentSession(userId, env),
    getLatestAssessmentProfile(userId, env),
  ]);

  const answeredCount = session ? Object.keys(session.answers).length : 0;

  const status = dashboardStatusLine({
    hasProfile: !!profile,
    hasSession: !!session,
    answeredCount,
  });

  const text =
    `${ASSESSMENT_DASHBOARD_INTRO}\n\n` +
    `<b>وضعیت:</b>\n${escapeHtml(status)}`;

  const keyboard = buildAssessmentDashboardKeyboard({
    hasProfile: !!profile,
    hasSession: !!session,
  });

  const options = withHtml({ reply_markup: keyboard });

  if (edit && ctx.callbackQuery?.message) {
    await ctx.editMessageText(text, options);
  } else {
    await ctx.reply(text, options);
  }
};

const showQuestion = async (
  ctx: Context,
  index: number,
  edit: boolean
): Promise<void> => {
  const text = formatQuestionMessage(index);
  const keyboard = buildQuestionKeyboard(index);
  const options = { reply_markup: keyboard };

  if (edit && ctx.callbackQuery?.message) {
    await ctx.editMessageText(text, options);
  } else {
    await ctx.reply(text, options);
  }
};

const startNewAssessment = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  await resetAssessmentSession(userId, env);
  await abandonActiveAssessmentAttempts(userId, env);
  const attemptId = await createAssessmentAttempt(
    userId,
    ASSESSMENT_VERSION,
    ASSESSMENT_QUESTION_COUNT,
    env
  );
  await startAssessmentSession(
    userId,
    ASSESSMENT_VERSION,
    ASSESSMENT_QUESTION_COUNT,
    attemptId,
    env
  );
  const session = await getAssessmentSession(userId, env);
  if (!session) {
    throw new Error("Failed to start test session");
  }
  await showQuestion(ctx, 0, !!ctx.callbackQuery);
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
    const d1User = await resolveOrCreateUser(ctx, env);
    await sendAssessmentDashboard(ctx, d1User.id, env);
  } catch (error) {
    logBotError("handleAssessmentCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleAssessmentCallback = async (
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
    const locale = d1User.locale || "fa";

    await ctx.answerCallbackQuery();

    if (data === ASSESSMENT_CALLBACK.start || data === ASSESSMENT_CALLBACK.continue) {
      let session = await getAssessmentSession(userId, env);
      if (!session || data === ASSESSMENT_CALLBACK.start) {
        await startNewAssessment(ctx, userId, env);
        return;
      }
      const index = resumeQuestionIndex(session);
      await setAssessmentCurrentIndex(userId, index, env);
      session = (await getAssessmentSession(userId, env)) ?? session;
      await showQuestion(ctx, index, true);
      return;
    }

    if (data === ASSESSMENT_CALLBACK.menu) {
      await sendAssessmentDashboard(ctx, userId, env, true);
      return;
    }

    if (data === ASSESSMENT_CALLBACK.exit) {
      await cancelAssessmentSession(userId, env);
      await ctx.editMessageText(ASSESSMENT_EXIT_SAVED, {
        reply_markup: new InlineKeyboard().text(
          "بازگشت به منو",
          ASSESSMENT_CALLBACK.menu
        ),
      });
      return;
    }

    if (data === ASSESSMENT_CALLBACK.reset) {
      await ctx.editMessageText(ASSESSMENT_RESET_CONFIRM, {
        reply_markup: buildResetConfirmKeyboard(),
      });
      return;
    }

    if (data === ASSESSMENT_CALLBACK.resetNo) {
      await sendAssessmentDashboard(ctx, userId, env, true);
      return;
    }

    if (data === ASSESSMENT_CALLBACK.resetYes) {
      await resetAssessmentSession(userId, env);
      await startNewAssessment(ctx, userId, env);
      return;
    }

    if (data === ASSESSMENT_CALLBACK.result) {
      const profile = await getLatestAssessmentProfile(userId, env);
      if (!profile) {
        await sendAssessmentDashboard(ctx, userId, env, true);
        return;
      }
      const summary = parseResultSummary(profile);
      const scores = profileScoresFromRow(profile);
      const text = formatResultMessage(summary, scores, true);
      await ctx.editMessageText(text, {
        ...withHtml(),
        reply_markup: buildResultKeyboard(),
      });
      return;
    }

    if (data === ASSESSMENT_CALLBACK.previous) {
      const session = await getAssessmentSession(userId, env);
      if (!session) {
        await sendAssessmentDashboard(ctx, userId, env, true);
        return;
      }
      const index = Math.max(0, session.currentIndex - 1);
      await setAssessmentCurrentIndex(userId, index, env);
      await showQuestion(ctx, index, true);
      return;
    }

    const answerMatch = /^t:a:(\d+):([1-5])$/.exec(data);
    if (answerMatch) {
      const index = Number(answerMatch[1]);
      const value = Number(answerMatch[2]);
      const session = await getAssessmentSession(userId, env);
      if (!session || !session.attemptId) {
        await sendAssessmentDashboard(ctx, userId, env, true);
        return;
      }

      const question = ASSESSMENT_QUESTIONS[index];
      if (!question) {
        return;
      }

      await saveAssessmentAnswer(userId, question.id, value, env, index);

      const updated = await getAssessmentSession(userId, env);
      if (!updated) {
        return;
      }

      const answeredCount = Object.keys(updated.answers).length;
      if (answeredCount >= ASSESSMENT_QUESTION_COUNT) {
        const result = await completeAssessmentFlow(userId, locale, env);
        const text = formatResultMessage(
          result.summary,
          result.scores,
          true
        );
        await ctx.editMessageText(text, {
          ...withHtml(),
          reply_markup: buildResultKeyboard(),
        });

        const localeCode = locale === "en" ? "en" : "fa";
        scheduleProfileIndexing(
          {
            userId,
            version: result.version,
            locale: localeCode,
            scores: result.scores,
            summary: result.summary,
            profileSummaryText: result.profileSummaryText,
            env,
          },
          (ctx as NekoContext).deferWork
        );
        return;
      }

      const nextIndex = index + 1;
      await setAssessmentCurrentIndex(userId, nextIndex, env);
      await showQuestion(ctx, nextIndex, true);
      return;
    }

    await sendAssessmentDashboard(ctx, userId, env, true);
  } catch (error) {
    logBotError("handleAssessmentCallback", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
