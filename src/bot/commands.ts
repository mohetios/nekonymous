import type { Context } from "grammy";
import type { Conversation, Environment, User } from "../types";
import {
  handlePendingSettingsInput,
  handleSettingsMenu,
} from "./settings";
import {
  buildDraftMenu,
  createMessageKeyboard,
  handleMenuCommand,
  mainMenu,
} from "../utils/constant";
import type { KVModel } from "../utils/kv-storage";
import {
  addInboxEntry,
  decryptEntry,
  listPendingInbox,
  markInboxDelivered,
} from "../utils/inbox";
import { incrementStat, logBotError } from "../utils/logs";
import {
  EMPTY_INBOX_MESSAGE,
  HuhMessage,
  INBOX_FULL_MESSAGE,
  MESSAGE_SENT_MESSAGE,
  NEW_INBOX_MESSAGE,
  NICKNAME_LIMIT_MESSAGE,
  NICKNAME_REMOVED_MESSAGE,
  NICKNAME_SAVED_MESSAGE,
  NICKNAME_TEXT_ONLY_MESSAGE,
  NoUserFoundMessage,
  OWNER_PAUSED_NOTE,
  RECIPIENT_PAUSED_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  StartConversationMessage,
  USER_IS_BLOCKED_MESSAGE,
  WelcomeMessage,
  YOUR_MESSAGE_SEEN_MESSAGE,
} from "../utils/messages";
import {
  ContactLabelLimitError,
  getContactLabelForSender,
  sanitizeNickname,
  setContactLabel,
} from "../utils/contact";
import { applyMessagePayload } from "../utils/payload";
import { hasDeliverablePayload, sendDecryptedMessage } from "../utils/sender";
import {
  encryptedPayload,
  encryptConversationPayload,
  generateTicketId,
} from "../utils/ticket";
import {
  checkRateLimit,
  convertToPersianNumbers,
  escapeHtml,
  replyHtml,
  withHtml,
} from "../utils/tools";
import {
  buildUserDeepLink,
  ensureUser,
  isUserLinkId,
  publicDisplayName,
} from "../utils/user";
import { scheduleWork } from "../utils/worker";

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
      const user = await ensureUser(
        currentUserId,
        from.first_name,
        userModel,
        userUUIDtoId,
        statsModel,
        ctx
      );

      const welcome = WelcomeMessage.replace(
        "UUID_USER_URL",
        buildUserDeepLink(user.userUUID)
      );
      await ctx.reply(
        user.paused ? `${OWNER_PAUSED_NOTE}\n\n${welcome}` : welcome,
        withHtml({ reply_markup: mainMenu })
      );
    } catch (error) {
      logBotError("handleStartCommand", error);
      await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    }
    return;
  }

  if (typeof ctx.match !== "string") {
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    return;
  }

  const linkId = ctx.match.trim();
  if (!isUserLinkId(linkId)) {
    await ctx.reply(NoUserFoundMessage);
    return;
  }

  const otherUserId = await userUUIDtoId.get(linkId);
  const currentUser = await ensureUser(
    currentUserId,
    from.first_name,
    userModel,
    userUUIDtoId,
    statsModel,
    ctx
  );

  if (checkRateLimit(currentUser.lastMessage)) {
    await ctx.reply(RATE_LIMIT_MESSAGE);
    return;
  }

  if (!otherUserId || otherUserId.toString() === currentUserId.toString()) {
    await ctx.reply(
      otherUserId ? SELF_MESSAGE_DISABLE_MESSAGE : NoUserFoundMessage
    );
    return;
  }

  const otherUser = await userModel.get(otherUserId.toString());
  if (!otherUser) {
    await userUUIDtoId.remove(linkId);
    await ctx.reply(NoUserFoundMessage);
    return;
  }

  if (otherUser.blockList.includes(currentUserId.toString())) {
    await ctx.reply(USER_IS_BLOCKED_MESSAGE);
    return;
  }

  if (otherUser.paused) {
    await ctx.reply(
      RECIPIENT_PAUSED_MESSAGE.replace(
        "USER_NAME",
        escapeHtml(publicDisplayName(otherUser, "این کاربر"))
      ),
      withHtml()
    );
    return;
  }

  const prompt = await ctx.reply(
    StartConversationMessage.replace(
      "USER_NAME",
      escapeHtml(publicDisplayName(otherUser))
    ),
    withHtml({ reply_markup: buildDraftMenu() })
  );

  await userModel.updateField(currentUserId.toString(), "currentConversation", {
    to: Number(otherUserId),
    parent_message_id: prompt.message_id,
  });
};

export const handleMessage = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  userUUIDtoId: KVModel<string>,
  inbox: Environment["INBOX_DO"],
  statsModel: KVModel<number>,
  appSecureKey: string
): Promise<void> => {
  const from = ctx.from;
  const message = ctx.message;
  if (!from || !message) {
    return;
  }

  const currentUser = await ensureUser(
    from.id,
    from.first_name,
    userModel,
    userUUIDtoId,
    statsModel,
    ctx
  );

  const settingsDeps = {
    userModel,
    userUUIDtoId,
    statsModel,
    inbox,
  };

  if (await handleMenuCommand(ctx, currentUser)) {
    return;
  }

  if (await handleSettingsMenu(ctx, currentUser, settingsDeps)) {
    return;
  }

  if (await handlePendingSettingsInput(ctx, currentUser, settingsDeps)) {
    return;
  }

  const activeUser =
    (await userModel.get(from.id.toString())) ?? currentUser;

  const pendingNickname = activeUser.currentConversation?.pendingNickname;
  if (pendingNickname) {
    if (!message.text) {
      await ctx.reply(
        NICKNAME_TEXT_ONLY_MESSAGE,
        withHtml({ reply_markup: buildDraftMenu() })
      );
      return;
    }

    if (checkRateLimit(activeUser.lastMessage)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      return;
    }

    try {
      const nickname = sanitizeNickname(message.text);
      await setContactLabel(
        userModel,
        from.id,
        pendingNickname,
        nickname
      );
      await userModel.updateFields(from.id.toString(), {
        currentConversation: undefined,
        lastMessage: Date.now(),
      });
      await ctx.reply(
        nickname
          ? NICKNAME_SAVED_MESSAGE.replace("NAME", escapeHtml(nickname))
          : NICKNAME_REMOVED_MESSAGE,
        withHtml({ reply_markup: mainMenu })
      );
    } catch (error) {
      if (error instanceof ContactLabelLimitError) {
        await ctx.reply(NICKNAME_LIMIT_MESSAGE, { reply_markup: mainMenu });
      } else {
        logBotError("handleMessage:nickname", error);
        await ctx.reply(HuhMessage, { reply_markup: mainMenu });
      }
    }
    return;
  }

  const recipientId = activeUser.currentConversation?.to;
  if (!recipientId) {
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    return;
  }

  if (checkRateLimit(activeUser.lastMessage)) {
    await ctx.reply(RATE_LIMIT_MESSAGE);
    return;
  }

  const recipient = await userModel.get(recipientId.toString());
  if (recipient?.blockList.includes(from.id.toString())) {
    await ctx.reply(USER_IS_BLOCKED_MESSAGE);
    await userModel.updateFields(from.id.toString(), {
      currentConversation: undefined,
    });
    return;
  }

  const isThreadReply =
    activeUser.currentConversation?.reply_to_message_id !== undefined;

  if (recipient?.paused && !isThreadReply) {
    const senderLabel = await getContactLabelForSender(
      from.id,
      Number(recipientId),
      activeUser.contactLabels,
      appSecureKey
    );
    await ctx.reply(
      RECIPIENT_PAUSED_MESSAGE.replace(
        "USER_NAME",
        escapeHtml(
          senderLabel ?? publicDisplayName(recipient, "این کاربر")
        )
      ),
      withHtml()
    );
    await userModel.updateFields(from.id.toString(), {
      currentConversation: undefined,
    });
    return;
  }

  try {
    const ticketId = generateTicketId();
    const conversation: Conversation = {
      connection: {
        from: from.id,
        to: Number(recipientId),
        parent_message_id: message.message_id,
        reply_to_message_id: activeUser.currentConversation?.reply_to_message_id,
      },
      payload: {},
    };

    applyMessagePayload(conversation, message);

    const payloadJson = JSON.stringify(conversation);
    const { conversationId, ciphertext } = await encryptConversationPayload(
      ticketId,
      payloadJson,
      appSecureKey
    );

    await conversationModel.saveText(conversationId, ciphertext);

    const addResult = await addInboxEntry(inbox, Number(recipientId), {
      ticketId,
      conversationId,
      ciphertext,
    });

    if (!addResult.ok) {
      await conversationModel.remove(conversationId);
      await ctx.reply(
        addResult.status === 429 ? INBOX_FULL_MESSAGE : HuhMessage,
        { reply_to_message_id: conversation.connection.parent_message_id }
      );
      return;
    }

    const pendingCount = addResult.pendingCount ?? 1;

    await replyHtml(ctx, MESSAGE_SENT_MESSAGE, {
      reply_to_message_id: conversation.connection.parent_message_id,
    });
    await ctx.api.sendMessage(
      Number(recipientId),
      NEW_INBOX_MESSAGE.replace(
        "COUNT",
        convertToPersianNumbers(pendingCount)
      ),
      withHtml()
    );

    await userModel.updateFields(from.id.toString(), {
      currentConversation: undefined,
      lastMessage: Date.now(),
    });
    await scheduleWork(ctx, incrementStat(statsModel, "newConversation"));
  } catch (error) {
    logBotError("handleMessage", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleInboxCommand = async (
  ctx: Context,
  userModel: KVModel<User>,
  conversationModel: KVModel<string>,
  inbox: Environment["INBOX_DO"],
  appSecureKey: string
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const pending = await listPendingInbox(inbox, from.id);

    if (pending.length === 0) {
      await ctx.reply(EMPTY_INBOX_MESSAGE, withHtml({ reply_markup: mainMenu }));
      return;
    }

    const owner = await userModel.get(from.id.toString());
    const aliasCache = new Map<number, string>();
    let delivered = 0;
    let failed = 0;

    for (const entry of pending) {
      if (!entry.ciphertext) {
        failed += 1;
        continue;
      }

      try {
        const decrypted = await decryptEntry(
          entry,
          entry.ciphertext,
          appSecureKey
        );

        if (!decrypted || !hasDeliverablePayload(decrypted)) {
          failed += 1;
          continue;
        }

        const senderId = decrypted.connection.from.toString();
        const isBlocked = !!owner?.blockList.includes(senderId);
        const senderLabel = await getContactLabelForSender(
          from.id,
          decrypted.connection.from,
          owner?.contactLabels,
          appSecureKey,
          aliasCache
        );

        await sendDecryptedMessage(
          ctx,
          decrypted,
          {
            reply_markup: createMessageKeyboard(entry.ref, isBlocked),
          },
          senderLabel
        );

        const clearedCiphertext = encryptedPayload(
          entry.ticketId,
          JSON.stringify({ connection: decrypted.connection, payload: {} }),
          appSecureKey
        );

        await Promise.all([
          ctx.api
            .sendMessage(
              decrypted.connection.from,
              YOUR_MESSAGE_SEEN_MESSAGE,
              decrypted.connection.parent_message_id
                ? { reply_to_message_id: decrypted.connection.parent_message_id }
                : undefined
            )
            .catch((error) => logBotError("handleInboxCommand:seen", error)),
          conversationModel.saveText(entry.conversationId, await clearedCiphertext),
          markInboxDelivered(inbox, from.id, entry.ref),
        ]);
        delivered += 1;
      } catch (error) {
        failed += 1;
        logBotError("handleInboxCommand:deliver", error);
      }
    }

    if (delivered === 0 && failed > 0) {
      await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    }
  } catch (error) {
    logBotError("handleInboxCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
