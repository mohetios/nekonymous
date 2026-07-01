import type { Context } from "grammy";
import type { Environment } from "../../types";
import { createMessageKeyboard, mainMenu } from "../../bot/keyboards";
import { EMPTY_INBOX_MESSAGE, HuhMessage } from "../../i18n/messages";
import { createBlockHash } from "../../ticketing/ticketing-service";
import { replyHtml, withHtml } from "../../utils/tools";
import { logBotError } from "../../utils/logs";
import { sendDecryptedMessage } from "../../utils/sender";
import { getUserByTelegramHash, resolveOrCreateUser, toBotUser } from "../identity/identity-service";
import { openInboxTicketRef } from "./inbox-pointer";
import {
  deliveryContextFromResolvedTicket,
  hasDeliverablePayload,
  markResolvedTicketViewed,
  notifyMessageSeen,
  toTicketDeliveryConversation,
} from "./messaging-service";
import {
  isExpiredTicketAction,
  resolveTicketAction,
} from "./resolve-ticket-action";
import { expireTicketRecord } from "../../storage/ticket-vault/ticket-vault.client";
import { listInboxPage, markInboxPointerViewed } from "../../storage/user-state-client";

const MAX_INBOX_DECRYPT_PER_REQUEST = 10;

const expireTicketsBestEffort = async (
  env: Environment,
  ticketHashes: string[]
): Promise<void> => {
  await Promise.all(
    ticketHashes.map((ticketHash) =>
      expireTicketRecord(env, ticketHash).catch((error) =>
        logBotError("renderInbox:expire", error)
      )
    )
  );
};

export const renderInbox = async (
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
    const page = await listInboxPage(env, user.id, 0);
    await expireTicketsBestEffort(env, page.expiredTicketHashes);

    if (page.pointers.length === 0) {
      await ctx.reply(EMPTY_INBOX_MESSAGE, withHtml({ reply_markup: mainMenu }));
      return;
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

    if (shown === 0) {
      if (failed > 0) {
        await ctx.reply(HuhMessage, { reply_markup: mainMenu });
      } else {
        await replyHtml(ctx, EMPTY_INBOX_MESSAGE, {
          reply_markup: mainMenu,
        });
      }
    }
  } catch (error) {
    logBotError("renderInbox", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
