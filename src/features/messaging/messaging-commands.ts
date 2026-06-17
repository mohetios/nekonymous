import type { Context } from "grammy";
import type { Environment } from "../../types";
import {
  handlePendingSettingsInput,
  handleSettingsMenu,
} from "../settings/settings-handlers";
import { handleMatchIntroInput } from "../matching/match-handlers";
import { handleMatchSystemMenu } from "../matching/match-system-handlers";
import {
  buildDraftMenu,
  createMessageKeyboard,
  mainMenu,
} from "../../bot/keyboards";
import { handleMenuCommand } from "../../bot/menu";
import { logBotError } from "../../utils/logs";
import {
  EMPTY_INBOX_MESSAGE,
  HuhMessage,
  INBOX_FULL_MESSAGE,
  MESSAGE_SENT_MESSAGE,
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
  UnsupportedMessageTypeMessage,
  USER_IS_BLOCKED_MESSAGE,
  WelcomeMessage,
} from "../../i18n/messages";
import {
  ContactLabelLimitError,
  sanitizeNickname,
  setContactLabel,
} from "../../utils/contact";
import { messageToPayload } from "./payload-service";
import { sendDecryptedMessage } from "../../utils/sender";
import {
  deliveryContextFromTicket,
  hasDeliverablePayload,
  notifyMessageSeen,
  notifyRecipientInbox,
  sendAnonymousMessage,
  toLegacyConversation,
} from "./messaging-service";
import {
  getActiveSlugForUser,
  getUserByPublicSlug,
  resolveOrCreateUser,
  toBotUser,
  getUserById,
} from "../identity/identity-service";
import {
  checkCanReceive,
  clearDraft,
  getDraft,
  isRateLimited,
  listPendingInbox,
  markTicketDelivered,
  setDraft,
  touchRateLimit,
} from "../../storage/user-state-client";
import {
  escapeHtml,
  replyHtml,
  withHtml,
} from "../../utils/tools";
import { buildUserDeepLink, isUserLinkId, publicDisplayName } from "../../utils/user";

export const handleStartCommand = async (
  ctx: Context,
  env: Environment,
  botUsername: string
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);

    if (!ctx.match) {
      const welcome = WelcomeMessage.replace(
        "UUID_USER_URL",
        buildUserDeepLink(botUsername, user.slug)
      );
      await ctx.reply(
        user.paused ? `${OWNER_PAUSED_NOTE}\n\n${welcome}` : welcome,
        withHtml({ reply_markup: mainMenu })
      );
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

    if (await isRateLimited(env, user.id)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      return;
    }

    const recipientD1 = await getUserByPublicSlug(linkId, env);
    if (!recipientD1 || recipientD1.id === user.id) {
      await ctx.reply(
        recipientD1 ? SELF_MESSAGE_DISABLE_MESSAGE : NoUserFoundMessage
      );
      return;
    }

    const recipient = await toBotUser(recipientD1, env);

    if (recipient.blockedUserIds.includes(user.id)) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      return;
    }

    if (recipient.paused) {
      await ctx.reply(
        RECIPIENT_PAUSED_MESSAGE.replace(
          "USER_NAME",
          escapeHtml(publicDisplayName(recipient, "این کاربر"))
        ),
        withHtml()
      );
      return;
    }

    const prompt = await ctx.reply(
      StartConversationMessage.replace(
        "USER_NAME",
        escapeHtml(publicDisplayName(recipient))
      ),
      withHtml({ reply_markup: buildDraftMenu() })
    );

    await setDraft(env, user.id, {
      id: "primary",
      mode: "compose",
      toUserId: recipient.id,
      linkSlug: linkId,
      parent_message_id: prompt.message_id,
    });
  } catch (error) {
    logBotError("handleStartCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleMessage = async (
  ctx: Context,
  env: Environment,
  botUsername: string,
  publicSiteUrl?: string
): Promise<void> => {
  const from = ctx.from;
  const message = ctx.message;
  if (!from || !message) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);

    if (await handleMenuCommand(ctx, user, botUsername)) {
      return;
    }

    if (await handleMatchSystemMenu(ctx, env)) {
      return;
    }

    if (await handleSettingsMenu(ctx, user, env, botUsername, publicSiteUrl)) {
      return;
    }

    if (await handlePendingSettingsInput(ctx, user, env)) {
      return;
    }

    const draft = (await getDraft(env, user.id)) ?? user.draft;

    if (draft?.mode === "match_intro" && draft.replyRef) {
      await handleMatchIntroInput(ctx, user.id, draft.replyRef, env);
      return;
    }

    const pendingNickname = draft?.pendingNicknameAlias;
    if (pendingNickname) {
      if (!message.text) {
        await ctx.reply(
          NICKNAME_TEXT_ONLY_MESSAGE,
          withHtml({ reply_markup: buildDraftMenu() })
        );
        return;
      }

      if (await isRateLimited(env, user.id)) {
        await ctx.reply(RATE_LIMIT_MESSAGE);
        return;
      }

      try {
        const nickname = sanitizeNickname(message.text);
        await setContactLabel(
          env,
          user.id,
          pendingNickname,
          draft?.toUserId ?? user.id,
          nickname,
          user.contactLabels
        );
        await clearDraft(env, user.id);
        await touchRateLimit(env, user.id);
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

    const recipientId = draft?.toUserId;
    if (!recipientId) {
      if (draft?.mode === "match_intro") {
        await ctx.reply(HuhMessage, { reply_markup: buildDraftMenu() });
        return;
      }
      await ctx.reply(HuhMessage, { reply_markup: mainMenu });
      return;
    }

    if (await isRateLimited(env, user.id)) {
      await ctx.reply(RATE_LIMIT_MESSAGE);
      return;
    }

    const recipientD1 = await getUserById(recipientId, env);
    const isThreadReply = draft?.reply_to_message_id !== undefined;

    if (!recipientD1) {
      await ctx.reply(NoUserFoundMessage, { reply_markup: mainMenu });
      await clearDraft(env, user.id);
      return;
    }

    const recipient = await toBotUser(recipientD1, env);
    const linkSlug = draft?.linkSlug;
    const activeSlug = await getActiveSlugForUser(recipient.id, env);

    if (!linkSlug || activeSlug !== linkSlug) {
      await ctx.reply(NoUserFoundMessage, { reply_markup: mainMenu });
      await clearDraft(env, user.id);
      return;
    }

    if (recipient.blockedUserIds.includes(user.id)) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      await clearDraft(env, user.id);
      return;
    }

    const canReceive = await checkCanReceive(env, recipientD1.id, user.id);
    if (!canReceive.ok && !isThreadReply) {
      if (canReceive.reason === "blocked") {
        await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      } else {
        await ctx.reply(
          RECIPIENT_PAUSED_MESSAGE.replace(
            "USER_NAME",
            escapeHtml(publicDisplayName(recipient, "این کاربر"))
          ),
          withHtml()
        );
      }
      await clearDraft(env, user.id);
      return;
    }

    const payload = messageToPayload(message);
    if (!hasDeliverablePayload(payload)) {
      await ctx.reply(UnsupportedMessageTypeMessage, {
        reply_markup: buildDraftMenu(),
        reply_to_message_id: draft?.parent_message_id,
      });
      return;
    }

    const result = await sendAnonymousMessage(env, {
      sender: d1User,
      recipient: recipientD1,
      payload,
      linkSlug,
      isThreadReply,
      replyToMessageId: draft?.reply_to_message_id,
    });

    if (!result.ok) {
      await ctx.reply(
        result.status === 429 ? INBOX_FULL_MESSAGE : HuhMessage,
        { reply_to_message_id: draft?.parent_message_id }
      );
      return;
    }

    await replyHtml(ctx, MESSAGE_SENT_MESSAGE, {
      reply_to_message_id: draft?.parent_message_id,
    });

    if (result.notify) {
      try {
        await notifyRecipientInbox(
          env,
          recipientD1,
          result.pendingCount ?? 1
        );
      } catch (error) {
        logBotError("handleMessage:notify", error);
      }
    }

    await clearDraft(env, user.id);
    await touchRateLimit(env, user.id);
  } catch (error) {
    logBotError("handleMessage", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleInboxCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);
    const pending = await listPendingInbox(env, user.id);

    if (pending.length === 0) {
      await ctx.reply(EMPTY_INBOX_MESSAGE, withHtml({ reply_markup: mainMenu }));
      return;
    }

    let delivered = 0;
    let failed = 0;

    for (const ticket of pending) {
      if (!ticket.payloadCiphertext) {
        failed += 1;
        continue;
      }

      try {
        const delivery = await deliveryContextFromTicket(
          env,
          ticket,
          user.contactLabels,
          user.blockedUserIds
        );

        if (!hasDeliverablePayload(delivery.payload)) {
          failed += 1;
          continue;
        }

        const legacy = toLegacyConversation(
          delivery.connection,
          delivery.payload,
          0,
          0
        );

        await sendDecryptedMessage(
          ctx,
          legacy,
          {
            reply_markup: createMessageKeyboard(ticket.ref, delivery.isBlocked),
          },
          delivery.senderLabel
        );

        const senderD1 = await getUserById(
          delivery.connection.senderUserId,
          env
        );
        await markTicketDelivered(env, user.id, ticket.ref);
        if (senderD1) {
          await notifyMessageSeen(
            env,
            senderD1,
            delivery.connection.parent_message_id
          ).catch((error) => logBotError("handleInboxCommand:seen", error));
        }
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
