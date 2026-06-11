import type { Context } from "grammy";
import type { Conversation, Environment, InboxMessage, User } from "../types";
import {
  createMessageKeyboard,
  handleMenuCommand,
  mainMenu,
} from "../utils/constant";
import type { KVModel } from "../utils/kv-storage";
import { incrementStat } from "../utils/logs";
import {
  EMPTY_INBOX_MESSAGE,
  HuhMessage,
  MESSAGE_SENT_MESSAGE,
  NEW_INBOX_MESSAGE,
  NoUserFoundMessage,
  RATE_LIMIT_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  StartConversationMessage,
  USER_IS_BLOCKED_MESSAGE,
  WelcomeMessage,
  YOUR_MESSAGE_SEEN_MESSAGE,
} from "../utils/messages";
import { sendDecryptedMessage } from "../utils/sender";
import {
  decryptPayload,
  encryptedPayload,
  generateTicketId,
  getConversationId,
} from "../utils/ticket";
import { checkRateLimit, convertToPersianNumbers } from "../utils/tools";
import { generateUserLinkId } from "../utils/uuid";

/**
 * Handles the /start command to initiate or continue a user's interaction with the bot.
 * Generates a unique UUID for new users and continues the interaction for existing users.
 *
 * @param {Context} ctx - The context of the current Telegram update.
 * @param {KVModel<User>} userModel - KVModel instance for managing user data.
 * @param {KVModel<string>} userUUIDtoId - KVModel instance for managing UUID to user ID mapping.
 * @param {KVModel<number>} statsModel - KVModel instance for storing stats.
 */
export const handleStartCommand = async (
  ctx: Context,
  userModel: KVModel<User>,
  userUUIDtoId: KVModel<string>,
  statsModel: KVModel<number>
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }
  const currentUserId = from.id;

  if (!ctx.match) {
    try {
      let currentUserUUID = "";
      const currentUser = await userModel.get(currentUserId.toString());

      if (!currentUser) {
        currentUserUUID = generateUserLinkId();
        await userUUIDtoId.save(currentUserUUID, currentUserId.toString());
        await userModel.save(currentUserId.toString(), {
          userUUID: currentUserUUID,
          userName: ctx.from?.first_name ?? "بدون نام!",
          blockList: [],
          lastMessage: Date.now(),
          currentConversation: {},
        });
        await incrementStat(statsModel, "newUser");
      } else {
        currentUserUUID = currentUser.userUUID;
      }

      await ctx.reply(
        WelcomeMessage.replace(
          "UUID_USER_URL",
          `https://t.me/nekonymous_bot?start=${currentUserUUID}`
        ),
        {
          reply_markup: mainMenu,
        }
      );
    } catch (error) {
      await ctx.reply(HuhMessage + JSON.stringify(error), {
        reply_markup: mainMenu,
      });
    }
  } else if (typeof ctx.match === "string") {
    const otherUserUUID = ctx.match;
    const otherUserId = await userUUIDtoId.get(otherUserUUID);
    let currentUser = await userModel.get(currentUserId.toString());

    if (!currentUser) {
      const currentUserUUID = generateUserLinkId();
      await userUUIDtoId.save(currentUserUUID, currentUserId.toString());
      await userModel.save(currentUserId.toString(), {
        userUUID: currentUserUUID,
        userName: ctx.from?.first_name ?? "بدون نام!",
        blockList: [],
        lastMessage: Date.now(),
        currentConversation: {},
      });
      await incrementStat(statsModel, "newUser");
      currentUser = await userModel.get(currentUserId.toString());
    }

    if (!currentUser) {
      await ctx.reply(NoUserFoundMessage);
      return;
    }

    // Check rate limit
    if (checkRateLimit(currentUser.lastMessage)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      return;
    }

    // disable self message
    if (otherUserId?.toString() === currentUserId.toString()) {
      await ctx.reply(SELF_MESSAGE_DISABLE_MESSAGE);
      return;
    }

    if (otherUserId) {
      const otherUser = await userModel.get(otherUserId);

      if (otherUser?.blockList.includes(currentUserId.toString())) {
        await ctx.reply(USER_IS_BLOCKED_MESSAGE);
        return;
      }

      const newConversation = await ctx.reply(
        StartConversationMessage.replace(
          "USER_NAME",
          otherUser?.userName ?? "کاربر"
        )
      );
      await userModel.updateField(
        currentUserId.toString(),
        "currentConversation",
        { to: otherUserId, parent_message_id: newConversation.message_id }
      );
    } else {
      await ctx.reply(NoUserFoundMessage);
    }
  } else {
    await ctx.reply(HuhMessage, {
      reply_markup: mainMenu,
    });
  }
};

/**
 * Handles all incoming messages that are not menu commands, routing them based on the user's current conversation state.
 *
 * @param {Context} ctx - The context of the current Telegram update.
 * @param {KVModel<User>} userModel - KVModel instance for managing user data.
 * @param {KVModel<string>} conversationModel - KVModel instance for managing conversation data.
 * @param {KVModel<string>} userUUIDtoId - KVModel instance for managing UUID to user ID mapping.
 * @param {DurableObjectNamespace} inboxNamespace - Durable Object Namespace for inbox handling.
 * @param {KVModel<number>} statsModel - KVModel instance for storing stats.
 * @param {string} APP_SECURE_KEY - The application-specific secure key.
 */
export const handleMessage = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  userUUIDtoId: KVModel<string>,
  inboxNamespace: Environment["INBOX_DO"],
  statsModel: KVModel<number>,
  APP_SECURE_KEY: string
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }
  const currentUserId = from.id;
  let currentUser = await userModel.get(currentUserId.toString());

  if (!currentUser) {
    const currentUserUUID = generateUserLinkId();
    await userUUIDtoId.save(currentUserUUID, currentUserId.toString());
    await userModel.save(currentUserId.toString(), {
      userUUID: currentUserUUID,
      userName: from.first_name ?? "بدون نام!",
      blockList: [],
      lastMessage: Date.now(),
      currentConversation: {},
    });
    await incrementStat(statsModel, "newUser");
    currentUser = await userModel.get(currentUserId.toString());
  }
  const isMenuCommandHandled = await handleMenuCommand(
    ctx,
    currentUser?.userUUID || ""
  );
  if (isMenuCommandHandled) return;

  if (!currentUser?.currentConversation?.to) {
    await ctx.reply(HuhMessage, {
      reply_markup: mainMenu,
    });
    return;
  }

  try {
    const ticketId = await generateTicketId(APP_SECURE_KEY);

    const conversation: Conversation = {
      connection: {
        from: currentUserId,
        to: currentUser.currentConversation.to,
        parent_message_id: ctx.message?.message_id,
        reply_to_message_id:
          currentUser.currentConversation.reply_to_message_id,
      },
      payload: {},
    };

    if (ctx.message?.text) {
      conversation.payload.message_text = ctx.message.text;
      conversation.payload.message_type = "text";
    } else if (ctx.message?.photo) {
      conversation.payload.message_type = "photo";
      conversation.payload.photo_id =
        ctx.message.photo[ctx.message.photo.length - 1].file_id;
      if (ctx.message.caption)
        conversation.payload.caption = ctx.message.caption;
    } else if (ctx.message?.video) {
      conversation.payload.message_type = "video";
      conversation.payload.video_id = ctx.message.video.file_id;
      if (ctx.message.caption)
        conversation.payload.caption = ctx.message.caption;
    } else if (ctx.message?.animation) {
      conversation.payload.message_type = "animation";
      conversation.payload.animation_id = ctx.message.animation.file_id;
      if (ctx.message.caption)
        conversation.payload.caption = ctx.message.caption;
    } else if (ctx.message?.document) {
      conversation.payload.message_type = "document";
      conversation.payload.document_id = ctx.message.document.file_id;
      if (ctx.message.caption)
        conversation.payload.caption = ctx.message.caption;
    } else if (ctx.message?.sticker) {
      conversation.payload.message_type = "sticker";
      conversation.payload.sticker_id = ctx.message.sticker.file_id;
    } else if (ctx.message?.voice) {
      conversation.payload.message_type = "voice";
      conversation.payload.voice_id = ctx.message.voice.file_id;
    } else if (ctx.message?.video_note) {
      conversation.payload.message_type = "video_note";
      conversation.payload.video_note_id = ctx.message.video_note.file_id;
    } else if (ctx.message?.audio) {
      conversation.payload.message_type = "audio";
      conversation.payload.audio_id = ctx.message.audio.file_id;
      if (ctx.message.caption)
        conversation.payload.caption = ctx.message.caption;
    }

    const conversationId = await getConversationId(ticketId, APP_SECURE_KEY);
    const conversationData = await encryptedPayload(
      ticketId,
      JSON.stringify(conversation),
      APP_SECURE_KEY
    );

    // Store the encrypted conversation in KV
    await conversationModel.save(conversationId, conversationData);

    // Interact with Durable Object for inbox management
    const inboxId = inboxNamespace.idFromName(
      currentUser.currentConversation.to.toString()
    );
    const inboxStub = inboxNamespace.get(inboxId);

    await inboxStub.fetch("https://inbox/add", {
      method: "POST",
      body: JSON.stringify({ timestamp: Date.now(), ticketId }),
    });

    const counter = await inboxStub.fetch("https://inbox/counter");
    const inbox: InboxMessage[] = await counter.json();

    // Notify the user
    await ctx.reply(MESSAGE_SENT_MESSAGE, {
      reply_to_message_id: conversation.connection.parent_message_id,
    });
    await ctx.api.sendMessage(
      currentUser.currentConversation.to,
      NEW_INBOX_MESSAGE.replace("COUNT", convertToPersianNumbers(inbox.length))
    );

    // Clear current conversation for the user
    await userModel.updateField(
      currentUserId.toString(),
      "currentConversation",
      undefined
    );

    // Update rate limit
    await userModel.updateField(
      currentUserId.toString(),
      "lastMessage",
      Date.now()
    );
    await incrementStat(statsModel, "newConversation");
  } catch {
    await ctx.reply(HuhMessage, {
      reply_markup: mainMenu,
    });
  }
};

/**
 * Handles the /inbox command, retrieving and displaying messages from the user's inbox.
 *
 * @param {Context} ctx - The context of the current Telegram update.
 * @param {KVModel<User>} userModel - KVModel instance for managing user data.
 * @param {KVModel<string>}  conversationModel - KVModel instance for managing conversation data.
 * @param {DurableObjectNamespace} inboxNamespace - Durable Object Namespace for inbox handling.
 * @param {string} APP_SECURE_KEY - The application-specific secure key.
 */
export const handleInboxCommand = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  inboxNamespace: Environment["INBOX_DO"],
  APP_SECURE_KEY: string
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }
  const currentUserId = from.id;

  try {
    // Fetch the Durable Object associated with this user's inbox
    const inboxId = inboxNamespace.idFromName(currentUserId.toString());
    const inboxStub = inboxNamespace.get(inboxId);

    const response = await inboxStub.fetch("https://inbox/retrieve");

    const inbox: InboxMessage[] = await response.json();
    if (inbox.length > 0) {
      for (const { ticketId } of inbox) {
        try {
          const conversationId = await getConversationId(ticketId, APP_SECURE_KEY);
          const conversationData = await conversationModel.get(conversationId);
          const decryptedMessage = JSON.parse(
            await decryptPayload(ticketId, conversationData!, APP_SECURE_KEY)
          ) as Conversation;

          const otherUser = await userModel.get(
            decryptedMessage.connection.from.toString()
          );
          const isBlocked = !!otherUser?.blockList.includes(
            currentUserId.toString()
          );

          const replyOptions: {
            reply_markup: ReturnType<typeof createMessageKeyboard>;
            reply_to_message_id?: number;
          } = {
            reply_markup: createMessageKeyboard(ticketId, isBlocked),
          };

          if (decryptedMessage.connection.reply_to_message_id) {
            replyOptions.reply_to_message_id =
              decryptedMessage.connection.reply_to_message_id;
          }

          await sendDecryptedMessage(ctx, decryptedMessage, replyOptions);
          await ctx.api.sendMessage(
            decryptedMessage.connection.from,
            YOUR_MESSAGE_SEEN_MESSAGE,
            {
              reply_to_message_id:
                decryptedMessage.connection.parent_message_id,
            }
          );

          // Clear payload data in the conversation to minimize storage
          const clearedConversation = {
            connection: decryptedMessage.connection,
            payload: {}, // Clear the payload after sending the message
          };
          const clearedConversationData = await encryptedPayload(
            ticketId,
            JSON.stringify(clearedConversation),
            APP_SECURE_KEY
          );
          await conversationModel.save(conversationId, clearedConversationData);
        } catch (error) {
          await ctx.reply(HuhMessage + JSON.stringify(error), {
            reply_markup: mainMenu,
          });
        }
      }
    } else {
      await ctx.reply(EMPTY_INBOX_MESSAGE, {
        reply_markup: mainMenu,
      });
    }
  } catch (error) {
    await ctx.reply(HuhMessage + JSON.stringify(error), {
      reply_markup: mainMenu,
    });
  }
};
