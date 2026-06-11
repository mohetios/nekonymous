import type { Context } from "grammy";
import type { Environment, User } from "../types";
import { buildDraftMenu, createMessageKeyboard } from "../utils/constant";
import {
  getContactLabelForSender,
  lookupContactLabel,
} from "../utils/contact";
import type { KVModel } from "../utils/kv-storage";
import { loadConversationForAction } from "../utils/inbox";
import { incrementStat } from "../utils/logs";
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
import { getSenderAlias } from "../utils/ticket";
import { checkRateLimit, escapeHtml, withHtml } from "../utils/tools";
import { scheduleWork } from "../utils/worker";

type ActionContext = {
  userModel: KVModel<User>;
  conversationModel: KVModel<string>;
  inbox: Environment["INBOX_DO"];
  appSecureKey: string;
};

const isRecipient = (to: number, userId: number): boolean => to === userId;

const loadAction = async (ctx: Context, deps: ActionContext) => {
  const ref = ctx.match?.[1];
  const userId = ctx.from?.id;
  if (!ref || userId === undefined) {
    return null;
  }

  return loadConversationForAction(
    deps.inbox,
    userId,
    ref,
    deps.appSecureKey,
    deps.conversationModel
  );
};

export const handleReplyAction = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  statsModel: KVModel<number>,
  inbox: Environment["INBOX_DO"],
  appSecureKey: string
): Promise<void> => {
  const deps: ActionContext = {
    userModel,
    conversationModel,
    inbox,
    appSecureKey,
  };
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  const currentUserId = ctx.from?.id;

  if (callbackMessageId === undefined || currentUserId === undefined) {
    await ctx.answerCallbackQuery();
    return;
  }

  const loaded = await loadAction(ctx, deps);
  if (!loaded) {
    await ctx.reply(NoConversationFoundMessage);
    await ctx.answerCallbackQuery();
    return;
  }

  const { conversation } = loaded;
  if (!isRecipient(conversation.connection.to, currentUserId)) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    if (conversation.connection.from === currentUserId) {
      await ctx.reply(SELF_MESSAGE_DISABLE_MESSAGE);
      return;
    }

    const currentUser = await userModel.get(currentUserId.toString());
    if (checkRateLimit(currentUser?.lastMessage)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      return;
    }

    const sender = await userModel.get(conversation.connection.from.toString());
    if (sender?.blockList.includes(currentUserId.toString())) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      return;
    }

    const senderLabel = await getContactLabelForSender(
      currentUserId,
      conversation.connection.from,
      currentUser?.contactLabels,
      appSecureKey
    );

    await userModel.updateField(currentUserId.toString(), "currentConversation", {
      to: conversation.connection.from,
      parent_message_id: callbackMessageId,
      reply_to_message_id: conversation.connection.parent_message_id,
    });
    await scheduleWork(ctx, incrementStat(statsModel, "newConversation"));

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
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  _statsModel: KVModel<number>,
  inbox: Environment["INBOX_DO"],
  appSecureKey: string
): Promise<void> => {
  const deps: ActionContext = {
    userModel,
    conversationModel,
    inbox,
    appSecureKey,
  };
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  const currentUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (
    callbackMessageId === undefined ||
    currentUserId === undefined ||
    chatId === undefined
  ) {
    await ctx.answerCallbackQuery();
    return;
  }

  const loaded = await loadAction(ctx, deps);
  if (!loaded) {
    await ctx.reply(HuhMessage);
    await ctx.answerCallbackQuery();
    return;
  }

  const { entry, conversation } = loaded;
  if (!isRecipient(conversation.connection.to, currentUserId)) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    await userModel.updateField(
      currentUserId.toString(),
      "blockList",
      conversation.connection.from.toString(),
      true
    );

    await ctx.api.sendMessage(
      currentUserId,
      USER_BLOCKED_MESSAGE,
      withHtml({ reply_to_message_id: callbackMessageId })
    );
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: createMessageKeyboard(entry.ref, true),
    });
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

export const handleUnblockAction = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  _statsModel: KVModel<number>,
  inbox: Environment["INBOX_DO"],
  appSecureKey: string
): Promise<void> => {
  const deps: ActionContext = {
    userModel,
    conversationModel,
    inbox,
    appSecureKey,
  };
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  const currentUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (
    callbackMessageId === undefined ||
    currentUserId === undefined ||
    chatId === undefined
  ) {
    await ctx.answerCallbackQuery();
    return;
  }

  const loaded = await loadAction(ctx, deps);
  if (!loaded) {
    await ctx.reply(HuhMessage);
    await ctx.answerCallbackQuery();
    return;
  }

  const { entry, conversation } = loaded;
  if (!isRecipient(conversation.connection.to, currentUserId)) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const currentUser = await userModel.get(currentUserId.toString());
    const senderId = conversation.connection.from.toString();

    if (!currentUser?.blockList.includes(senderId)) {
      await ctx.reply(HuhMessage);
      return;
    }

    await userModel.popItemFromField(
      currentUserId.toString(),
      "blockList",
      senderId
    );

    await ctx.api.sendMessage(
      currentUserId,
      USER_UNBLOCKED_MESSAGE,
      withHtml({ reply_to_message_id: callbackMessageId })
    );
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: createMessageKeyboard(entry.ref, false),
    });
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

export const handleNicknameAction = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  _statsModel: KVModel<number>,
  inbox: Environment["INBOX_DO"],
  appSecureKey: string
): Promise<void> => {
  const deps: ActionContext = {
    userModel,
    conversationModel,
    inbox,
    appSecureKey,
  };
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  const currentUserId = ctx.from?.id;

  if (callbackMessageId === undefined || currentUserId === undefined) {
    await ctx.answerCallbackQuery();
    return;
  }

  const loaded = await loadAction(ctx, deps);
  if (!loaded) {
    await ctx.reply(NoConversationFoundMessage);
    await ctx.answerCallbackQuery();
    return;
  }

  const { conversation } = loaded;
  if (!isRecipient(conversation.connection.to, currentUserId)) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const currentUser = await userModel.get(currentUserId.toString());
    if (checkRateLimit(currentUser?.lastMessage)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      return;
    }

    const senderAlias = await getSenderAlias(
      currentUserId,
      conversation.connection.from,
      appSecureKey
    );
    const currentNick =
      lookupContactLabel(currentUser?.contactLabels, senderAlias) ?? "—";

    await userModel.updateField(currentUserId.toString(), "currentConversation", {
      pendingNickname: senderAlias,
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
