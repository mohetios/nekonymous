import type { Context } from "grammy";
import type { Environment } from "../types";
import { buildDraftMenu, createMessageKeyboard } from "../utils/constant";
import {
  getContactLabelForSender,
  lookupContactLabel,
} from "../utils/contact";
import {
  HuhMessage,
  NICKNAME_PROMPT_MESSAGE,
  NoConversationFoundMessage,
  RATE_LIMIT_MESSAGE,
  REPLAY_TO_MESSAGE,
  REPLAY_TO_NICKNAME_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  USER_BLOCKED_MESSAGE,
  USER_IS_BLOCKED_MESSAGE,
  USER_UNBLOCKED_MESSAGE,
} from "../utils/messages";
import {
  getActiveSlugForUser,
  getUserById,
  resolveOrCreateUser,
  toBotUser,
} from "../services/identity-service";
import { loadTicketForAction } from "../services/messaging-service";
import { createReport } from "../services/report-service";
import {
  addBlock,
  isRateLimited,
  markTicketReported,
  removeBlock,
  setDraft,
} from "../services/user-state-service";
import { escapeHtml, withHtml } from "../utils/tools";

const isRecipient = (
  recipientUserId: string,
  currentUserId: string
): boolean => recipientUserId === currentUserId;

const loadAction = async (
  ctx: Context,
  env: Environment,
  recipientUserId: string
) => {
  const ref = ctx.match?.[1];
  if (!ref) {
    return null;
  }

  return loadTicketForAction(env, recipientUserId, ref);
};

export const handleReplyAction = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  const from = ctx.from;
  if (callbackMessageId === undefined || !from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);

    const loaded = await loadAction(ctx, env, user.id);
    if (!loaded) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const { connection } = loaded;
    if (!isRecipient(connection.recipientUserId, user.id)) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (connection.senderUserId === user.id) {
      await ctx.reply(SELF_MESSAGE_DISABLE_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    if (await isRateLimited(env, user.id)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserById(connection.senderUserId, env);
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
    if (sender.blockedUserIds.includes(user.id)) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderLabel = connection.senderAlias
      ? getContactLabelForSender(
          user.id,
          connection.senderUserId,
          user.contactLabels,
          connection.senderAlias
        )
      : undefined;

    await setDraft(env, user.id, {
      id: "primary",
      mode: "reply",
      toUserId: connection.senderUserId,
      linkSlug: senderSlug ?? undefined,
      replyRef: loaded.ticket?.ref,
      parent_message_id: callbackMessageId,
      reply_to_message_id: connection.parent_message_id,
    });

    const replyPrompt = senderLabel
      ? REPLAY_TO_NICKNAME_MESSAGE.replace("NICKNAME", escapeHtml(senderLabel))
      : REPLAY_TO_MESSAGE;

    await ctx.reply(replyPrompt, withHtml({ reply_markup: buildDraftMenu() }));
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
  const from = ctx.from;
  if (callbackMessageId === undefined || chatId === undefined || !from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const loaded = await loadAction(ctx, env, user.id);
    if (!loaded || !loaded.ticket) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const { connection, ticket } = loaded;
    if (!isRecipient(connection.recipientUserId, user.id)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserById(connection.senderUserId, env);
    if (!senderD1) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    await addBlock(env, user.id, connection.senderUserId);

    await ctx.api.sendMessage(
      chatId,
      USER_BLOCKED_MESSAGE,
      withHtml({ reply_to_message_id: callbackMessageId })
    );
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: createMessageKeyboard(ticket.ref, true),
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
  const from = ctx.from;
  if (callbackMessageId === undefined || chatId === undefined || !from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const loaded = await loadAction(ctx, env, user.id);
    if (!loaded || !loaded.ticket) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const { connection, ticket } = loaded;
    if (!isRecipient(connection.recipientUserId, user.id)) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (!user.blockedUserIds.includes(connection.senderUserId)) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    await removeBlock(env, user.id, connection.senderUserId);

    await ctx.api.sendMessage(
      chatId,
      USER_UNBLOCKED_MESSAGE,
      withHtml({ reply_to_message_id: callbackMessageId })
    );
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: createMessageKeyboard(ticket.ref, false),
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
  const from = ctx.from;
  if (callbackMessageId === undefined || !from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const loaded = await loadAction(ctx, env, user.id);
    if (!loaded) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const { connection } = loaded;
    if (!isRecipient(connection.recipientUserId, user.id)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserById(connection.senderUserId, env);
    if (!senderD1) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    if (await isRateLimited(env, user.id)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    if (!connection.senderAlias) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const currentNick =
      lookupContactLabel(user.contactLabels, connection.senderAlias) ?? "—";

    await setDraft(env, user.id, {
      id: "primary",
      mode: "nickname",
      toUserId: connection.senderUserId,
      pendingNicknameAlias: connection.senderAlias,
      parent_message_id: callbackMessageId,
    });

    await ctx.reply(
      NICKNAME_PROMPT_MESSAGE.replace("CURRENT_NICK", escapeHtml(currentNick)),
      withHtml({ reply_markup: buildDraftMenu() })
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
  const from = ctx.from;
  if (!from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const loaded = await loadAction(ctx, env, user.id);
    if (!loaded || !loaded.ticket) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const { connection, ticket } = loaded;
    if (!isRecipient(connection.recipientUserId, user.id)) {
      await ctx.answerCallbackQuery();
      return;
    }

    await createReport(env, {
      reporterUserId: user.id,
      reportedUserId: connection.senderUserId,
      conversationId: connection.conversationId,
      ticketRef: ticket.ref,
      reasonCode: "inbox_report",
    });
    await markTicketReported(env, user.id, ticket.ref);
    await ctx.reply("گزارش ثبت شد.", withHtml());
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};
