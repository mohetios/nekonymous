import type { Context } from "grammy";
import type { Environment } from "../../contracts/runtime";
import {
  DRAFT_CANCEL_LABEL,
  buildDraftCancelKeyboard,
  cancelActiveInput,
  draftPlaceholder,
  restoreMainMenu,
} from "../../bot/input-navigation";
import { handleMainMenuCommand } from "../../bot/menu";
import { getResolvedUser, type NekoContext } from "../../bot/context";
import { logBotError, logBotTiming } from "../../utils/logs";
import {
  HuhMessage,
  INBOX_FULL_MESSAGE,
  MESSAGE_SENT_MESSAGE,
  REPLY_SENT_MESSAGE,
  NICKNAME_LIMIT_MESSAGE,
  NICKNAME_REMOVED_MESSAGE,
  NICKNAME_SAVED_MESSAGE,
  NICKNAME_TEXT_ONLY_MESSAGE,
  NoUserFoundMessage,
  OWNER_PAUSED_NOTE,
  RECIPIENT_PAUSED_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  StartConversationMessage,
  UnsupportedMessageTypeMessage,
  USER_IS_BLOCKED_MESSAGE,
  WelcomeMessage,
} from "../../i18n/messages";
import { PEER_USER_DEFAULT } from "../../i18n/defaults";
import {
  ContactLabelLimitError,
  sanitizeNickname,
  setContactLabel,
} from "./contact";
import { messageToPayload } from "./payload";
import {
  hasDeliverablePayload,
  sendAnonymousMessage,
} from "./service";
import { enqueueInboxNotification } from "./inbox-notification";
import {
  getActiveSlugForUser,
  getUserByPublicSlug,
  toBotUser,
  getUserById,
} from "../identity/identity-service";
import {
  clearDraft,
  getDraft,
  setDraft,
} from "../../storage/user-state-client";
import { escapeHtml, replyHtml, withHtml } from "../../utils/text";
import { buildUserDeepLink, isUserLinkId, publicDisplayName } from "../identity/user";
import { renderInbox } from "./inbox";
import { handleDisplayNameInput } from "../settings/settings-handlers";
import { handleConversationIntroInput } from "../conversation/suggestions/suggestion-handlers";
import { mainMenu } from "../../bot/keyboards";
import { hmacTelegramUserId } from "./ticketing-service";
import type { UserDraft } from "../../contracts/user-state/model";
import {
  recordLinkOpened,
  recordMessageCreated,
  recordReplySent,
} from "../../stats/product-events";
import { createBlockTag } from "./blind-tags";

const isTextInputDraft = (
  draft: UserDraft | null | undefined
): draft is UserDraft => {
  if (!draft) {
    return false;
  }
  return (
    draft.mode === "compose" ||
    draft.mode === "reply" ||
    draft.mode === "nickname" ||
    draft.mode === "display_name" ||
    draft.mode === "conversation_intro"
  );
};

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
    const d1User = await getResolvedUser(ctx, env);
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

    const recipientD1 = await getUserByPublicSlug(linkId, env);
    if (!recipientD1 || recipientD1.id === user.id) {
      await ctx.reply(
        recipientD1 ? SELF_MESSAGE_DISABLE_MESSAGE : NoUserFoundMessage
      );
      return;
    }

    const recipient = await toBotUser(recipientD1, env);

    const startBlockTag = await createBlockTag(
      env.APP_HMAC_PEPPER,
      recipientD1.id,
      d1User.telegram_user_hash
    );

    if (recipient.blockTags.includes(startBlockTag)) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      return;
    }

    if (recipient.paused) {
      await ctx.reply(
        RECIPIENT_PAUSED_MESSAGE.replace(
          "USER_NAME",
          escapeHtml(publicDisplayName(recipient, PEER_USER_DEFAULT))
        ),
        withHtml()
      );
      return;
    }

    await recordLinkOpened(env);

    const prompt = await ctx.reply(
      StartConversationMessage.replace(
        "USER_NAME",
        escapeHtml(publicDisplayName(recipient))
      ),
      withHtml({
        reply_markup: buildDraftCancelKeyboard(draftPlaceholder("compose")),
      })
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
  botUsername: string
): Promise<void> => {
  const from = ctx.from;
  const message = ctx.message;
  if (!from || !message) {
    return;
  }

  const startedAt = Date.now();
  try {
    const d1User = await getResolvedUser(ctx, env);
    const afterIdentity = Date.now();
    const draft = await getDraft(env, d1User.id);
    const afterDraft = Date.now();
    const text = message.text;

    if (isTextInputDraft(draft)) {
      if (text === DRAFT_CANCEL_LABEL) {
        await cancelActiveInput(ctx, env, d1User.id);
        return;
      }

      if (draft?.mode === "display_name") {
        const user = await toBotUser(d1User, env);
        await handleDisplayNameInput(ctx, user, env);
        return;
      }

      if (draft?.mode === "conversation_intro") {
        if (!message.text) {
          const { MATCH_INTRO_TEXT_ONLY } = await import("../../i18n/matching");
          await ctx.reply(
            MATCH_INTRO_TEXT_ONLY,
            withHtml({
              reply_markup: buildDraftCancelKeyboard(
                draftPlaceholder("conversation_intro")
              ),
            })
          );
          return;
        }

        const actorHash = await hmacTelegramUserId(
          env.APP_HMAC_PEPPER,
          from.id
        );
        const suggestionRef = draft.linkSlug;
        if (!suggestionRef) {
          await ctx.reply(HuhMessage, { reply_markup: mainMenu });
          await clearDraft(env, d1User.id);
          return;
        }

        const handled = await handleConversationIntroInput(
          ctx,
          env,
          d1User.id,
          actorHash,
          suggestionRef,
          message.text
        );
        if (handled) {
          await clearDraft(env, d1User.id);
        }
        return;
      }

      if (draft?.pendingNicknameContactTag) {
        const user = await toBotUser(d1User, env);
        if (!message.text) {
          await ctx.reply(
            NICKNAME_TEXT_ONLY_MESSAGE,
            withHtml({
              reply_markup: buildDraftCancelKeyboard(draftPlaceholder("nickname")),
            })
          );
          return;
        }

        try {
          const nickname = sanitizeNickname(message.text);
          await setContactLabel(
            env,
            user.id,
            draft.pendingNicknameContactTag,
            nickname
          );
          await clearDraft(env, user.id);
          await restoreMainMenu(
            ctx,
            nickname
              ? NICKNAME_SAVED_MESSAGE.replace("NAME", escapeHtml(nickname))
              : NICKNAME_REMOVED_MESSAGE
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
        await ctx.reply(HuhMessage, { reply_markup: mainMenu });
        await clearDraft(env, d1User.id);
        return;
      }

      const recipientD1 = await getUserById(recipientId, env);
      const afterRecipient = Date.now();
      const isThreadReply = draft?.reply_to_message_id !== undefined;
      const draftKeyboard = buildDraftCancelKeyboard(
        draftPlaceholder(draft?.mode === "reply" ? "reply" : "compose")
      );

      if (!recipientD1) {
        await ctx.reply(NoUserFoundMessage, { reply_markup: mainMenu });
        await clearDraft(env, d1User.id);
        return;
      }

      const linkSlug = draft?.linkSlug;
      const activeSlug = await getActiveSlugForUser(recipientD1.id, env);
      const afterSlug = Date.now();

      if (!linkSlug || activeSlug !== linkSlug) {
        await ctx.reply(NoUserFoundMessage, { reply_markup: mainMenu });
        await clearDraft(env, d1User.id);
        return;
      }

      const payload = messageToPayload(message);
      if (!hasDeliverablePayload(payload)) {
        await ctx.reply(UnsupportedMessageTypeMessage, {
          reply_markup: draftKeyboard,
          ...(draft?.parent_message_id !== undefined
            ? { reply_to_message_id: draft.parent_message_id }
            : {}),
        });
        return;
      }

      const beforeSeal = Date.now();
      const result = await sendAnonymousMessage(env, {
        sender: d1User,
        recipient: recipientD1,
        payload,
        linkSlug,
        isThreadReply,
        ...(draft?.reply_to_message_id !== undefined
          ? { replyToMessageId: draft.reply_to_message_id }
          : {}),
      });
      const afterSeal = Date.now();

      if (!result.ok) {
        if (result.reason === "blocked") {
          await ctx.reply(USER_IS_BLOCKED_MESSAGE, { reply_markup: mainMenu });
          await clearDraft(env, d1User.id);
          return;
        }
        if (result.reason === "paused") {
          await ctx.reply(
            RECIPIENT_PAUSED_MESSAGE.replace(
              "USER_NAME",
              escapeHtml(PEER_USER_DEFAULT)
            ),
            withHtml({ reply_markup: mainMenu })
          );
          await clearDraft(env, d1User.id);
          return;
        }
        await ctx.reply(
          result.status === 429 || result.reason === "full"
            ? INBOX_FULL_MESSAGE
            : HuhMessage,
          {
            reply_markup: draftKeyboard,
            ...(draft?.parent_message_id !== undefined
              ? { reply_to_message_id: draft.parent_message_id }
              : {}),
          }
        );
        return;
      }

      const sentMessage =
        draft?.mode === "reply" ? REPLY_SENT_MESSAGE : MESSAGE_SENT_MESSAGE;
      await replyHtml(ctx, sentMessage, {
        reply_markup: mainMenu,
        ...(draft?.parent_message_id !== undefined
          ? { reply_to_message_id: draft.parent_message_id }
          : {}),
      });
      const afterAck = Date.now();

      const nekoCtx = ctx as NekoContext;
      nekoCtx.deferWork?.(
        (async () => {
          if (result.notify) {
            try {
              await enqueueInboxNotification(
                env,
                recipientD1.id,
                result.notify.eventId
              );
            } catch (error) {
              logBotError("inbox-notification:enqueue", error, {
                retryable: true,
              });
              try {
                await enqueueInboxNotification(
                  env,
                  recipientD1.id,
                  result.notify.eventId
                );
              } catch (retryError) {
                logBotError("inbox-notification:enqueue", retryError, {
                  permanent: true,
                });
              }
            }
          }
          await recordMessageCreated(env);
          if (draft?.mode === "reply") {
            await recordReplySent(env);
          }
        })().catch((error) => logBotError("handleMessage:deferred", error))
      );

      await clearDraft(env, d1User.id);

      logBotTiming("send:hot-path", {
        identityMs: afterIdentity - startedAt,
        draftMs: afterDraft - afterIdentity,
        recipientMs: afterRecipient - afterDraft,
        slugMs: afterSlug - afterRecipient,
        sealMs: afterSeal - beforeSeal,
        ackMs: afterAck - afterSeal,
        totalMs: afterAck - startedAt,
      });
      return;
    }

    const user = await toBotUser(d1User, env);
    if (await handleMainMenuCommand(ctx, user, env, botUsername)) {
      return;
    }

    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  } catch (error) {
    logBotError("handleMessage", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleInboxCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  await renderInbox(ctx, env);
};
