import type { Context } from "grammy";
import type { Conversation, User } from "../types";
import { createMessageKeyboard } from "../utils/constant";
import type { KVModel } from "../utils/kv-storage";
import { incrementStat } from "../utils/logs";
import {
  HuhMessage,
  NoConversationFoundMessage,
  RATE_LIMIT_MESSAGE,
  REPLAY_TO_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  USER_BLOCKED_MESSAGE,
  USER_IS_BLOCKED_MESSAGE,
  USER_UNBLOCKED_MESSAGE,
} from "../utils/messages";
import { decryptPayload, getConversationId } from "../utils/ticket";
import { checkRateLimit } from "../utils/tools";

/**
 * Handles the reply action triggered from an inline keyboard.
 * This function manages the process when a user clicks on the "reply" button in an inline keyboard.
 * It verifies the conversation context and initiates a reply by linking it to the correct conversation.
 *
 * @param {Context} ctx - The context of the current Telegram update.
 * @param {KVModel<User>} userModel - KVModel instance for managing user data.
 * @param {KVModel<string>} conversationModel - KVModel instance for managing encrypted conversation data.
 * @param {KVModel<number>} statsModel - KVModel instance for managing stats data.
 * @param {string} APP_SECURE_KEY - The application-specific secure key.
 */
export const handleReplyAction = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  statsModel: KVModel<number>,
  APP_SECURE_KEY: string
): Promise<void> => {
  const ticketId = ctx.match?.[1];
  const currentUserId = ctx.from?.id;
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;

  if (
    !ticketId ||
    currentUserId === undefined ||
    callbackMessageId === undefined
  ) {
    await ctx.answerCallbackQuery();
    return;
  }

  // Retrieve the conversation data
  const conversationId = await getConversationId(ticketId, APP_SECURE_KEY);
  const conversationData = await conversationModel.get(conversationId);

  if (!conversationData) {
    await ctx.reply(NoConversationFoundMessage);
    await ctx.answerCallbackQuery();
    return;
  }

  const rawConversation = await decryptPayload(
    ticketId,
    conversationData,
    APP_SECURE_KEY
  );
  const parentConversation = JSON.parse(rawConversation) as Conversation;

  try {
    const otherUser = await userModel.get(
      parentConversation.connection.from.toString()
    );

    // disable self message
    if (
      parentConversation.connection.from.toString() === currentUserId.toString()
    ) {
      await ctx.reply(SELF_MESSAGE_DISABLE_MESSAGE);
      return;
    }
    // Check rate limit
    const currentUser = await userModel.get(currentUserId.toString());
    if (checkRateLimit(currentUser?.lastMessage)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      return;
    }

    // Check if the other user has blocked the current user
    if (otherUser?.blockList.includes(currentUserId.toString())) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      await ctx.answerCallbackQuery();
      return;
    }

    const conversation = {
      to: parentConversation.connection.from,
      parent_message_id: callbackMessageId,
      reply_to_message_id: parentConversation.connection.parent_message_id,
    };

    // Update the user's current conversation
    await userModel.updateField(
      currentUserId.toString(),
      "currentConversation",
      conversation
    );

    // Increment the reply stat
    await incrementStat(statsModel, "newConversation");

    await ctx.reply(REPLAY_TO_MESSAGE, {
      reply_markup: { force_reply: true },
      reply_to_message_id: callbackMessageId,
    });
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

/**
 * Handles the block action triggered from an inline keyboard.
 * This function adds a user to the block list when the "block" button is clicked.
 * It ensures that further communication from the blocked user is prevented until they are unblocked.
 *
 * @param {Context} ctx - The context of the current Telegram update.
 * @param {KVModel<User>} userModel - KVModel instance for managing user data.
 * @param {KVModel<string>} conversationModel - KVModel instance for managing encrypted conversation data.
 * @param {KVModel<number>} statsModel - KVModel instance for managing stats data.
 * @param {string} APP_SECURE_KEY - The application-specific secure key.
 */
export const handleBlockAction = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  statsModel: KVModel<number>,
  APP_SECURE_KEY: string
): Promise<void> => {
  const ticketId = ctx.match?.[1];
  const currentUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;

  if (
    !ticketId ||
    currentUserId === undefined ||
    chatId === undefined ||
    callbackMessageId === undefined
  ) {
    await ctx.answerCallbackQuery();
    return;
  }

  // Retrieve the conversation data
  const conversationId = await getConversationId(ticketId, APP_SECURE_KEY);
  const conversationData = await conversationModel.get(conversationId);

  if (!conversationData) {
    await ctx.reply(HuhMessage);
    await ctx.answerCallbackQuery();
    return;
  }

  const rawConversation = await decryptPayload(
    ticketId,
    conversationData,
    APP_SECURE_KEY
  );
  const parentConversation = JSON.parse(rawConversation) as Conversation;

  try {
    // Block the user
    await userModel.updateField(
      currentUserId.toString(),
      "blockList",
      parentConversation.connection.from.toString(),
      true
    );

    // Increment the blocked user stat
    await incrementStat(statsModel, "blockedUsers");

    // Send confirmation to the user
    await ctx.api.sendMessage(currentUserId, USER_BLOCKED_MESSAGE, {
      reply_to_message_id: callbackMessageId,
    });

    // Update the reply markup to reflect the block
    const replyKeyboard = createMessageKeyboard(ticketId, true);
    await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
      reply_markup: replyKeyboard,
    });
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};

/**
 * Handles the unblock action triggered from an inline keyboard.
 * This function removes a user from the block list when the "unblock" button is clicked,
 * allowing communication to resume between the two users.
 *
 * @param {Context} ctx - The context of the current Telegram update.
 * @param {KVModel<User>} userModel - KVModel instance for managing user data.
 * @param {KVModel<string>} conversationModel - KVModel instance for managing encrypted conversation data.
 * @param {KVModel<number>} statsModel - KVModel instance for managing stats data.
 * @param {string} APP_SECURE_KEY - The application-specific secure key.
 */
export const handleUnblockAction = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  statsModel: KVModel<number>,
  APP_SECURE_KEY: string
): Promise<void> => {
  const ticketId = ctx.match?.[1];
  const currentUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;

  if (
    !ticketId ||
    currentUserId === undefined ||
    chatId === undefined ||
    callbackMessageId === undefined
  ) {
    await ctx.answerCallbackQuery();
    return;
  }

  // Retrieve the conversation data
  const conversationId = await getConversationId(ticketId, APP_SECURE_KEY);
  const conversationData = await conversationModel.get(conversationId);

  if (!conversationData) {
    await ctx.reply(HuhMessage);
    await ctx.answerCallbackQuery();
    return;
  }

  const rawConversation = await decryptPayload(
    ticketId,
    conversationData,
    APP_SECURE_KEY
  );
  const parentConversation = JSON.parse(rawConversation) as Conversation;

  try {
    const currentUser = await userModel.get(currentUserId.toString());

    if (
      currentUser?.blockList.includes(
        parentConversation.connection.from.toString()
      )
    ) {
      // Unblock the user
      await userModel.popItemFromField(
        currentUserId.toString(),
        "blockList",
        parentConversation.connection.from.toString()
      );

      // Increment the unblocked user stat
      await incrementStat(statsModel, "unblockedUsers");

      // Send confirmation to the user
      await ctx.api.sendMessage(currentUserId, USER_UNBLOCKED_MESSAGE, {
        reply_to_message_id: callbackMessageId,
      });

      // Update the reply markup to reflect the unblock
      const replyKeyboard = createMessageKeyboard(ticketId, false);
      await ctx.api.editMessageReplyMarkup(chatId, callbackMessageId, {
        reply_markup: replyKeyboard,
      });
    } else {
      await ctx.reply(HuhMessage);
    }
  } catch {
    await ctx.reply(HuhMessage);
  } finally {
    await ctx.answerCallbackQuery();
  }
};
