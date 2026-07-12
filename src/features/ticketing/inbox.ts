import type { Context } from "grammy";
import type { Environment } from "../../types";
import { createMessageKeyboard, buildInboxPaginationKeyboard, mainMenu } from "../../bot/keyboards";
import {
  EMPTY_INBOX_MESSAGE,
  HuhMessage,
  INBOX_HAS_MORE_MESSAGE,
} from "../../i18n/messages";
import { createBlockHash } from "./ticketing-service";
import { replyHtml, withHtml } from "../../utils/text";
import { logBotError } from "../../utils/logs";
import { sendDecryptedMessage } from "../../bot/sender";
import { getUserByTelegramHash, resolveOrCreateUser, toBotUser } from "../identity/identity-service";
import { openInboxTicketRef } from "./inbox-pointer";
import {
  deliveryContextFromResolvedTicket,
  hasDeliverablePayload,
  markResolvedTicketViewed,
  notifyMessageSeen,
  toTicketDeliveryConversation,
} from "./service";
import {
  isExpiredTicketAction,
  resolveTicketAction,
} from "./resolve-ticket-action";
import { expireTicketRecord } from "../../storage/ticket-vault/ticket-vault.client";
import { listInboxPage, markInboxPointerViewed } from "../../storage/user-state-client";
import { recordInboxOpened, recordMessageDelivered, recordMessageExpired } from "../../stats/product-events";

const MAX_INBOX_DECRYPT_PER_REQUEST = 10;

const expireTicketsBestEffort = async (
  env: Environment,
  ticketHashes: string[]
): Promise<number> => {
  if (ticketHashes.length === 0) {
    return 0;
  }

  const results = await Promise.all(
    ticketHashes.map((ticketHash) =>
      expireTicketRecord(env, ticketHash)
        .then(() => true)
        .catch((error) => {
          logBotError("renderInbox:expire", error);
          return false;
        })
    )
  );

  return results.filter(Boolean).length;
};

const deliverInboxPage = async (
  ctx: Context,
  env: Environment,
  offset: number
): Promise<{ shown: number; failed: number; hasMore: boolean }> => {
  const from = ctx.from;
  if (!from) {
    return { shown: 0, failed: 0, hasMore: false };
  }

  const d1User = await resolveOrCreateUser(ctx, env);
  const user = await toBotUser(d1User, env);
  const page = await listInboxPage(env, user.id, offset);
  const expiredCount = await expireTicketsBestEffort(env, page.expiredTicketHashes);
  if (expiredCount > 0) {
    await recordMessageExpired(env, expiredCount);
  }

  if (page.pointers.length === 0 && offset === 0) {
    await ctx.reply(EMPTY_INBOX_MESSAGE, withHtml({ reply_markup: mainMenu }));
    return { shown: 0, failed: 0, hasMore: false };
  }

  let shown = 0;
  let failed = 0;
  let decryptedCount = 0;

  for (const pointer of page.pointers) {
    if (decryptedCount >= MAX_INBOX_DECRYPT_PER_REQUEST) {
      break;
    }

    const ticketRef = await openInboxTicketRef(env, pointer);
    if (!ticketRef) {
      await markInboxPointerViewed(env, user.id, pointer.ticketHash).catch((error) =>
        logBotError("renderInbox:drop-pointer", error)
      );
      failed += 1;
      continue;
    }

    try {
      const resolved = await resolveTicketAction(
        ctx,
        env,
        "open",
        ticketRef,
        d1User.telegram_user_hash
      );

      if (!resolved) {
        await markInboxPointerViewed(env, user.id, pointer.ticketHash).catch((error) =>
          logBotError("renderInbox:drop-pointer", error)
        );
        failed += 1;
        continue;
      }

      if (isExpiredTicketAction(resolved)) {
        await Promise.all([
          expireTicketRecord(env, pointer.ticketHash),
          markInboxPointerViewed(env, user.id, pointer.ticketHash),
        ]).catch((error) => logBotError("renderInbox:expire-pointer", error));
        continue;
      }

      const senderD1 = await getUserByTelegramHash(
        resolved.route.senderRouteTag,
        env
      );
      const isBlocked = senderD1
        ? user.blockedUserIds.includes(
            await createBlockHash(
              env.APP_HMAC_PEPPER,
              d1User.telegram_user_hash,
              senderD1.telegram_user_hash
            )
          )
        : false;
      const keyboard = createMessageKeyboard(ticketRef, isBlocked);

      if (resolved.ticket.status === "active" && resolved.ticket.payloadEnc) {
        decryptedCount += 1;
        const delivery = await deliveryContextFromResolvedTicket(
          resolved,
          user.contactLabels
        );
        if (!hasDeliverablePayload(delivery.payload)) {
          await markResolvedTicketViewed(env, user.id, resolved.ticketHash);
          failed += 1;
          continue;
        }

        await sendDecryptedMessage(
          ctx,
          toTicketDeliveryConversation(
            resolved.route,
            delivery.payload,
            0,
            0
          ),
          { reply_markup: keyboard },
          delivery.senderLabel
        );
        await markResolvedTicketViewed(env, user.id, resolved.ticketHash);
        await recordMessageDelivered(env);

        if (senderD1) {
          await notifyMessageSeen(
            env,
            senderD1,
            resolved.route.parentMessageId
          ).catch((error) => logBotError("renderInbox:seen", error));
        }

        shown += 1;
        continue;
      }

      await markResolvedTicketViewed(env, user.id, resolved.ticketHash);
    } catch (error) {
      failed += 1;
      logBotError("renderInbox:item", error);
    }
  }

  const hasMore = typeof page.nextOffset === "number";
  if (hasMore && page.nextOffset !== undefined) {
    await ctx.reply(INBOX_HAS_MORE_MESSAGE, {
      reply_markup: buildInboxPaginationKeyboard(page.nextOffset),
    });
  }

  return { shown, failed, hasMore };
};

export const renderInbox = async (
  ctx: Context,
  env: Environment,
  offset = 0
): Promise<void> => {
  if (!ctx.from) {
    return;
  }

  try {
    if (offset === 0) {
      await recordInboxOpened(env);
    }

    const { shown, failed } = await deliverInboxPage(ctx, env, offset);

    if (shown === 0 && offset === 0 && failed > 0) {
      await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    } else if (shown === 0 && offset > 0) {
      await replyHtml(ctx, EMPTY_INBOX_MESSAGE, { reply_markup: mainMenu });
    }
  } catch (error) {
    logBotError("renderInbox", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
