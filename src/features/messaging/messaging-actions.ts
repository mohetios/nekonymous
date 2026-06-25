import type { Context } from "grammy";
import type { Environment } from "../../types";
import { buildDraftMenu, createMessageKeyboard } from "../../bot/keyboards";
import {
  getContactLabelForSender,
  lookupContactLabel,
} from "../../utils/contact";
import {
  createBlockHash,
  createCapabilityLookupHash,
  createReportPeerHash,
  randomCapability,
} from "../../ticketing/ticketing-service";
import {
  HuhMessage,
  NICKNAME_PROMPT_MESSAGE,
  NoConversationFoundMessage,
  REPLAY_TO_MESSAGE,
  REPLAY_TO_NICKNAME_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  USER_BLOCKED_MESSAGE,
  USER_IS_BLOCKED_MESSAGE,
  USER_UNBLOCKED_MESSAGE,
} from "../../i18n/messages";
import {
  getActiveSlugForUser,
  getUserById,
  resolveOrCreateUser,
  toBotUser,
} from "../identity/identity-service";
import {
  deliveryContextFromTicket,
  hasDeliverablePayload,
  loadTicketForAction,
  notifyMessageSeen,
  toTicketDeliveryConversation,
} from "./messaging-service";
import { createReport } from "./report-service";
import {
  addBlock,
  markTicketReported,
  markTicketDelivered,
  removeBlock,
  setDraft,
} from "../../storage/user-state-client";
import { escapeHtml, withHtml } from "../../utils/tools";
import { sendDecryptedMessage } from "../../utils/sender";
import { logBotError } from "../../utils/logs";

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

export const handleOpenTicketAction = async (
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
    if (!loaded?.ticket?.payloadCiphertext) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const delivery = await deliveryContextFromTicket(
      env,
      loaded.ticket,
      user.contactLabels
    );
    if (!isRecipient(delivery.connection.recipientUserId, user.id)) {
      await ctx.answerCallbackQuery();
      return;
    }
    if (!hasDeliverablePayload(delivery.payload)) {
      await ctx.reply(HuhMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const senderD1 = await getUserById(delivery.connection.senderUserId, env);
    const isBlocked = senderD1
      ? user.blockedUserIds.includes(
          await createBlockHash(
            env.APP_HMAC_PEPPER,
            d1User.telegram_user_hash,
            senderD1.telegram_user_hash
          )
        )
      : false;

    const actionCapability = randomCapability();
    const actionLookupHash = await createCapabilityLookupHash(
      actionCapability,
      env.APP_HMAC_PEPPER
    );
    await sendDecryptedMessage(
      ctx,
      toTicketDeliveryConversation(delivery.connection, delivery.payload, 0, 0),
      { reply_markup: createMessageKeyboard(actionCapability, isBlocked) },
      delivery.senderLabel
    );
    await markTicketDelivered(env, user.id, loaded.ticket.ref, actionLookupHash);

    if (senderD1) {
      await notifyMessageSeen(
        env,
        senderD1,
        delivery.connection.parent_message_id
      ).catch((error) => logBotError("handleOpenTicketAction:seen", error));
    }
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
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

    const blockHash = await createBlockHash(
      env.APP_HMAC_PEPPER,
      d1User.telegram_user_hash,
      senderD1.telegram_user_hash
    );

    await addBlock(env, user.id, blockHash);

    await ctx.api.sendMessage(
      chatId,
      USER_BLOCKED_MESSAGE,
      withHtml({ reply_to_message_id: callbackMessageId })
    );
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: createMessageKeyboard(ctx.match?.[1] ?? "", true),
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
      reply_markup: createMessageKeyboard(ctx.match?.[1] ?? "", false),
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

    const senderD1 = await getUserById(connection.senderUserId, env);
    if (!senderD1) {
      await ctx.reply(NoConversationFoundMessage);
      await ctx.answerCallbackQuery();
      return;
    }

    const reportedPeerHash = await createReportPeerHash(
      env.APP_HMAC_PEPPER,
      d1User.telegram_user_hash,
      senderD1.telegram_user_hash
    );

    await createReport(env, {
      reporterUserId: d1User.telegram_user_hash,
      reportedUserId: reportedPeerHash,
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
