import type { Context } from "grammy";
import type { Environment } from "../../types";
import { createMessageKeyboard } from "../../bot/keyboards";
import {
  buildDraftCancelKeyboard,
  INPUT_PLACEHOLDERS,
} from "../../bot/input-navigation";
import {
  getContactLabelForSender,
  lookupContactLabel,
} from "../../utils/contact";
import { createBlockHash } from "../ticketing/ticketing-service";
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
  USER_IS_BLOCKED_MESSAGE,
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
  markInboxPointerBlocked,
  markInboxPointerReported,
  removeBlock,
  setDraft,
} from "../../storage/user-state-client";
import { escapeHtml, withHtml } from "../../utils/tools";
import { emitStat } from "../../stats/emit-stat";
import { STAT_EVENTS } from "../../stats/events";
import {
  resolveTicketAction,
  isExpiredTicketAction,
  type TicketAction,
} from "./resolve-ticket-action";
import type { ResolveTicketActionResult } from "./resolve-ticket-action";
import { createBlindReport } from "../moderation/create-blind-report";
import {
  markTicketBlocked,
  markTicketRecordReported,
} from "../../storage/ticket-vault/ticket-vault.client";

const ticketRefFromContext = (ctx: Context): string | null => {
  const ref = ctx.match?.[1];
  return typeof ref === "string" ? ref : null;
};

const isRecipientRoute = (
  recipientRouteTag: string,
  currentRouteTag: string
): boolean => recipientRouteTag === currentRouteTag;

const loadAction = async (
  ctx: Context,
  env: Environment,
  action: TicketAction,
  actorHash: string
): Promise<ResolveTicketActionResult | null> => {
  const ticketRef = ticketRefFromContext(ctx);
  if (!ticketRef) {
    return null;
  }
  return resolveTicketAction(ctx, env, action, ticketRef, actorHash);
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
      d1User.telegram_user_hash
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

    if (!isRecipientRoute(resolved.route.recipientRouteTag, d1User.telegram_user_hash)) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (!resolved.route.replyPolicy.canReply) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (resolved.route.senderRouteTag === d1User.telegram_user_hash) {
      await ctx.reply(SELF_MESSAGE_DISABLE_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserByTelegramHash(
      resolved.route.senderRouteTag,
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

    const sender = await toBotUser(senderD1, env);
    const replyBlockHash = await createBlockHash(
      env.APP_HMAC_PEPPER,
      senderD1.telegram_user_hash,
      d1User.telegram_user_hash
    );
    if (sender.blockedUserIds.includes(replyBlockHash)) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderLabel = resolved.route.senderAlias
      ? getContactLabelForSender(
          user.id,
          senderD1.id,
          user.contactLabels,
          resolved.route.senderAlias
        )
      : undefined;

    await setDraft(env, user.id, {
      id: "primary",
      mode: "reply",
      toUserId: senderD1.id,
      linkSlug: senderSlug,
      replyRef: resolved.ticketHash,
      parent_message_id: callbackMessageId,
      reply_to_message_id: resolved.route.parentMessageId,
    });

    const replyPrompt = senderLabel
      ? REPLY_TO_NICKNAME_MESSAGE.replace("NICKNAME", escapeHtml(senderLabel))
      : REPLY_TO_MESSAGE;

    await ctx.reply(replyPrompt, withHtml({
      reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.reply),
    }));
  } catch {
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
      d1User.telegram_user_hash
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

    if (!isRecipientRoute(resolved.route.recipientRouteTag, d1User.telegram_user_hash)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserByTelegramHash(
      resolved.route.senderRouteTag,
      env
    );
    if (!senderD1) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const blockHash = await createBlockHash(
      env.APP_HMAC_PEPPER,
      d1User.telegram_user_hash,
      senderD1.telegram_user_hash
    );

    await addBlock(env, user.id, blockHash);
    await emitStat(env, STAT_EVENTS.BLOCK_CREATED);
    await Promise.all([
      markInboxPointerBlocked(env, user.id, resolved.ticketHash),
      markTicketBlocked(env, resolved.ticketHash),
    ]);

    await ctx.api.sendMessage(
      chatId,
      USER_BLOCKED_MESSAGE,
      withHtml({ reply_to_message_id: callbackMessageId })
    );
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: createMessageKeyboard(resolved.ticketRef, true),
    });
  } catch {
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
      d1User.telegram_user_hash
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

    if (!isRecipientRoute(resolved.route.recipientRouteTag, d1User.telegram_user_hash)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserByTelegramHash(
      resolved.route.senderRouteTag,
      env
    );
    if (!senderD1) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const blockHash = await createBlockHash(
      env.APP_HMAC_PEPPER,
      d1User.telegram_user_hash,
      senderD1.telegram_user_hash
    );

    if (!user.blockedUserIds.includes(blockHash)) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    await removeBlock(env, user.id, blockHash);

    await ctx.api.sendMessage(
      chatId,
      USER_UNBLOCKED_MESSAGE,
      withHtml({ reply_to_message_id: callbackMessageId })
    );
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: createMessageKeyboard(resolved.ticketRef, false),
    });
  } catch {
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
      d1User.telegram_user_hash
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

    if (!isRecipientRoute(resolved.route.recipientRouteTag, d1User.telegram_user_hash)) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (!resolved.route.senderAlias) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const currentNick =
      lookupContactLabel(user.contactLabels, resolved.route.senderAlias) ?? "-";

    await setDraft(env, user.id, {
      id: "primary",
      mode: "nickname",
      pendingNicknameAlias: resolved.route.senderAlias,
      parent_message_id: callbackMessageId,
    });

    await ctx.reply(
      NICKNAME_PROMPT_MESSAGE.replace("CURRENT_NICK", escapeHtml(currentNick)),
      withHtml({
        reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.nickname),
      })
    );
  } catch {
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
    const user = await toBotUser(d1User, env);
    const resolved = await loadAction(
      ctx,
      env,
      "report",
      d1User.telegram_user_hash
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

    if (!isRecipientRoute(resolved.route.recipientRouteTag, d1User.telegram_user_hash)) {
      await ctx.answerCallbackQuery();
      return;
    }

    await createBlindReport(env, {
      actorHash: d1User.telegram_user_hash,
      ticketHash: resolved.ticketHash,
      route: resolved.route,
      reasonCode: "inbox_report",
    });
    await emitStat(env, STAT_EVENTS.REPORT_CREATED, {
      statKey: "inbox_report",
    });
    await Promise.all([
      markInboxPointerReported(env, user.id, resolved.ticketHash),
      markTicketRecordReported(env, resolved.ticketHash),
    ]);
    await ctx.reply(REPORT_SUBMITTED_MESSAGE, withHtml());
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};
