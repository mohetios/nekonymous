import type { Context } from "grammy";
import type { Environment } from "../../contracts/runtime";
import { createMessageKeyboard } from "../../bot/keyboards";
import {
  buildDraftCancelKeyboard,
  INPUT_PLACEHOLDERS,
} from "../../bot/input-navigation";
import {
  getContactLabel,
  NICKNAME_DRAFT_TTL,
} from "./contact";
import {
  HuhMessage,
  EXPIRED_TICKET_MESSAGE,
  NICKNAME_PROMPT_MESSAGE,
  NoConversationFoundMessage,
  REPORT_SUBMITTED_MESSAGE,
  REPLY_TO_MESSAGE,
  REPLY_TO_NICKNAME_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  USER_BLOCKED_MESSAGE,
  USER_UNBLOCKED_MESSAGE,
} from "../../i18n/messages";
import {
  getActiveSlugForUser,
  getUserByTelegramHash,
  resolveOrCreateUser,
  toBotUser,
} from "../identity/identity-service";
import {
  addBlock,
  removeBlock,
  setDraft,
} from "../../storage/user-state-client";
import { escapeHtml, withHtml } from "../../utils/text";
import { logBotError } from "../../utils/logs";
import { recordBlockCreated, recordReportCreated } from "../../stats/product-events";
import {
  resolveTicketAction,
  isExpiredTicketAction,
} from "./resolve-ticket-action";
import type {
  ResolveTicketActionResult,
  TicketActionKind,
} from "../../contracts/ticketing/actions";
import { createBlindReport } from "../moderation/create-blind-report";

const ticketRefFromContext = (ctx: Context): string | null => {
  const ref = ctx.match?.[1];
  return typeof ref === "string" ? ref : null;
};

const loadAction = async (
  ctx: Context,
  env: Environment,
  action: TicketActionKind,
  actor: { actorHash: string; actorUserId: string }
): Promise<ResolveTicketActionResult | null> => {
  const ticketRef = ticketRefFromContext(ctx);
  if (!ticketRef) {
    return null;
  }
  return resolveTicketAction(ctx, env, action, ticketRef, actor);
};

const replyExpiredTicket = async (ctx: Context): Promise<void> => {
  await ctx.reply(EXPIRED_TICKET_MESSAGE);
};

export const handleReplyAction = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  if (callbackMessageId === undefined || !ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const resolved = await loadAction(
      ctx,
      env,
      "reply",
      { actorHash: d1User.telegram_user_hash, actorUserId: d1User.id }
    );

    if (!resolved) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (isExpiredTicketAction(resolved)) {
      await replyExpiredTicket(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    if (!resolved.route.replyPolicy.canReply) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (resolved.route.replyRouteTag === d1User.telegram_user_hash) {
      await ctx.reply(SELF_MESSAGE_DISABLE_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserByTelegramHash(
      resolved.route.replyRouteTag,
      env
    );
    if (!senderD1) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderSlug = await getActiveSlugForUser(senderD1.id, env);
    if (!senderSlug) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderLabel = await getContactLabel(
      env,
      user.id,
      resolved.route.contactTag
    );

    await setDraft(env, user.id, {
      id: "primary",
      mode: "reply",
      toUserId: senderD1.id,
      linkSlug: senderSlug,
      parent_message_id: callbackMessageId,
      reply_to_message_id: resolved.route.parentMessageId,
    });

    const replyPrompt = senderLabel
      ? REPLY_TO_NICKNAME_MESSAGE.replace("NICKNAME", escapeHtml(senderLabel))
      : REPLY_TO_MESSAGE;

    await ctx.reply(replyPrompt, withHtml({
      reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.reply),
    }));
  } catch (error) {
    logBotError("reply:action", error);
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

export const handleBlockAction = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  const chatId = ctx.chat?.id;
  if (callbackMessageId === undefined || chatId === undefined || !ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const resolved = await loadAction(
      ctx,
      env,
      "block",
      { actorHash: d1User.telegram_user_hash, actorUserId: d1User.id }
    );
    if (!resolved) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (isExpiredTicketAction(resolved)) {
      await replyExpiredTicket(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    const { inserted } = await addBlock(env, user.id, resolved.route.blockTag);
    if (inserted) {
      await recordBlockCreated(env);
    }

    try {
      await ctx.api.sendMessage(
        chatId,
        USER_BLOCKED_MESSAGE,
        withHtml({ reply_to_message_id: callbackMessageId })
      );
      await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
        reply_markup: createMessageKeyboard(resolved.ticketRef, true),
      });
    } catch (error) {
      logBotError("block:telegram-ui", error);
    }
  } catch (error) {
    logBotError("block:action", error);
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

export const handleUnblockAction = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  const chatId = ctx.chat?.id;
  if (callbackMessageId === undefined || chatId === undefined || !ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const resolved = await loadAction(
      ctx,
      env,
      "unblock",
      { actorHash: d1User.telegram_user_hash, actorUserId: d1User.id }
    );
    if (!resolved) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (isExpiredTicketAction(resolved)) {
      await replyExpiredTicket(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    if (!user.blockTags.includes(resolved.route.blockTag)) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    await removeBlock(env, user.id, resolved.route.blockTag);

    try {
      await ctx.api.sendMessage(
        chatId,
        USER_UNBLOCKED_MESSAGE,
        withHtml({ reply_to_message_id: callbackMessageId })
      );
      await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
        reply_markup: createMessageKeyboard(resolved.ticketRef, false),
      });
    } catch (error) {
      logBotError("unblock:telegram-ui", error);
    }
  } catch (error) {
    logBotError("unblock:action", error);
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

export const handleNicknameAction = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  if (callbackMessageId === undefined || !ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const resolved = await loadAction(
      ctx,
      env,
      "nickname",
      { actorHash: d1User.telegram_user_hash, actorUserId: d1User.id }
    );
    if (!resolved) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (isExpiredTicketAction(resolved)) {
      await replyExpiredTicket(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    const currentNick =
      (await getContactLabel(env, user.id, resolved.route.contactTag)) ?? "-";

    await setDraft(env, user.id, {
      id: "primary",
      mode: "nickname",
      pendingNicknameContactTag: resolved.route.contactTag,
      parent_message_id: callbackMessageId,
      expiresAt: Date.now() + NICKNAME_DRAFT_TTL,
    });

    await ctx.reply(
      NICKNAME_PROMPT_MESSAGE.replace("CURRENT_NICK", escapeHtml(currentNick)),
      withHtml({
        reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.nickname),
      })
    );
  } catch (error) {
    logBotError("nickname:action", error);
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

export const handleReportAction = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const resolved = await loadAction(
      ctx,
      env,
      "report",
      { actorHash: d1User.telegram_user_hash, actorUserId: d1User.id }
    );
    if (!resolved) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (isExpiredTicketAction(resolved)) {
      await replyExpiredTicket(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    const report = await createBlindReport(env, {
      actorHash: d1User.telegram_user_hash,
      ticketHash: resolved.ticketHash,
      route: resolved.route,
      reasonCode: "inbox_report",
    });
    if (!report.duplicate) {
      await recordReportCreated(env, "inbox_report");
    }
    try {
      await ctx.reply(REPORT_SUBMITTED_MESSAGE, withHtml());
    } catch (error) {
      logBotError("report:telegram-ui", error);
    }
  } catch (error) {
    logBotError("report:action", error);
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};
