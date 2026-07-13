import type { Context } from "grammy";
import type { D1User } from "../../contracts/identity/model";
import type { Environment } from "../../contracts/runtime";
import type { MessagePayload } from "../../contracts/telegram/delivery";
import { createMessageKeyboard, mainMenu } from "../../bot/keyboards";
import {
  HuhMessage,
  INBOX_DELIVERY_REQUESTED_MESSAGE,
  INBOX_EMPTY_MESSAGE,
} from "../../i18n/messages";
import { logBotError } from "../../utils/logs";
import {
  getUserById,
  resolveOrCreateUser,
  toBotUser,
} from "../identity/identity-service";
import {
  deliveryContextFromResolvedTicket,
  hasDeliverablePayload,
  markResolvedTicketViewed,
  notifyMessageSeenRoute,
} from "./service";
import {
  isExpiredTicketAction,
  resolveTicketAction,
} from "./resolve-ticket-action";
import {
  claimNextUnreadItem,
  cleanupExpiredUnreadItems,
  completeUnreadDelivery,
  getUnreadSummary,
  releaseUnreadDelivery,
} from "../../storage/user-state-client";
import type { UnreadDeliveryClaim } from "../../contracts/inbox/model";
import { sendViaOutboxDo } from "../../storage/telegram-outbox-client";
import type { TelegramOutboxJob } from "../../contracts/telegram/outbox";
import { recordInboxOpened, recordMessageDelivered } from "../../stats/product-events";
import { openUnreadCapability } from "./unread-capability";
import { createTicketHash } from "./keys";
import { parseTicketCapability } from "./ticket-capability";
import { buildDeliveryHeader } from "./contact";
import {
  TELEGRAM_CAPTION_MAX,
  TELEGRAM_MESSAGE_TEXT_MAX,
  truncateUtf8,
} from "../../bot/telegram-limits";
import { INBOX_DELIVERY_LIMIT } from "./inbox-constants";

const textWithLabel = (
  payload: MessagePayload,
  senderLabel: string | undefined
): string | undefined => {
  if (payload.message_type !== "text" || !payload.message_text) {
    return undefined;
  }
  const text = senderLabel
    ? `${buildDeliveryHeader(senderLabel)}${payload.message_text}`
    : payload.message_text;
  return truncateUtf8(text, TELEGRAM_MESSAGE_TEXT_MAX);
};

const captionWithLabel = (
  payload: MessagePayload,
  senderLabel: string | undefined
): string | undefined => {
  const caption = payload.caption ?? "";
  if (!senderLabel && !caption) {
    return undefined;
  }
  const text = senderLabel ? `${buildDeliveryHeader(senderLabel)}${caption}` : caption;
  return truncateUtf8(text, TELEGRAM_CAPTION_MAX);
};

const deliveryJobForPayload = (
  chatCiphertext: string,
  chatHash: string,
  ticketHash: string,
  capability: string,
  payload: MessagePayload,
  isBlocked: boolean,
  senderLabel?: string
): TelegramOutboxJob | null => {
  const replyMarkup = createMessageKeyboard(capability, isBlocked);
  const base = {
    idempotencyKey: `ticket-delivery:${ticketHash}`,
    kind: "telegram" as const,
    chatCiphertext,
    chatHash,
    priority: "normal" as const,
    createdAt: Date.now(),
  };

  switch (payload.message_type) {
    case "text":
      return {
        ...base,
        method: "sendMessage",
        payload: {
          text: textWithLabel(payload, senderLabel),
          reply_markup: replyMarkup,
        },
      };
    case "photo":
      return {
        ...base,
        method: "sendPhoto",
        payload: {
          photo: payload.photo_id,
          caption: captionWithLabel(payload, senderLabel),
          reply_markup: replyMarkup,
        },
      };
    case "video":
      return {
        ...base,
        method: "sendVideo",
        payload: {
          video: payload.video_id,
          caption: captionWithLabel(payload, senderLabel),
          reply_markup: replyMarkup,
        },
      };
    case "animation":
      return {
        ...base,
        method: "sendAnimation",
        payload: {
          animation: payload.animation_id,
          caption: captionWithLabel(payload, senderLabel),
          reply_markup: replyMarkup,
        },
      };
    case "document":
      return {
        ...base,
        method: "sendDocument",
        payload: {
          document: payload.document_id,
          caption: captionWithLabel(payload, senderLabel),
          reply_markup: replyMarkup,
        },
      };
    case "voice":
      return {
        ...base,
        method: "sendVoice",
        payload: {
          voice: payload.voice_id,
          caption: captionWithLabel(payload, senderLabel),
          reply_markup: replyMarkup,
        },
      };
    case "audio":
      return {
        ...base,
        method: "sendAudio",
        payload: {
          audio: payload.audio_id,
          caption: captionWithLabel(payload, senderLabel),
          reply_markup: replyMarkup,
        },
      };
    case "sticker":
      return {
        ...base,
        method: "sendSticker",
        payload: {
          sticker: payload.sticker_id,
          reply_markup: replyMarkup,
        },
      };
    case "video_note":
      return {
        ...base,
        method: "sendVideoNote",
        payload: {
          video_note: payload.video_note_id,
          reply_markup: replyMarkup,
        },
      };
    default:
      return null;
  }
};

const completeOrphan = async (
  env: Environment,
  userId: string,
  claim: UnreadDeliveryClaim
): Promise<void> => {
  await completeUnreadDelivery(env, userId, {
    itemId: claim.itemId,
    deliveryAttemptId: claim.deliveryAttemptId,
  });
};

const deliverClaim = async (
  env: Environment,
  d1User: D1User,
  claim: UnreadDeliveryClaim
): Promise<"delivered" | "unavailable" | "retryable-failure"> => {
  const user = await toBotUser(d1User, env);

  let capability: string;
  try {
    capability = await openUnreadCapability(
      env.APP_MASTER_KEY,
      d1User.id,
      claim.itemId,
      claim.dedupeTag,
      claim.sealedCapabilityEnc
    );
  } catch {
    await completeOrphan(env, d1User.id, claim);
    return "unavailable";
  }

  let ticketHash: string;
  try {
    ticketHash = await createTicketHash(
      env.APP_HMAC_PEPPER,
      parseTicketCapability(capability)
    );
  } catch {
    await completeOrphan(env, d1User.id, claim);
    return "unavailable";
  }

  const resolved = await resolveTicketAction(null, env, "open", capability, {
    actorHash: d1User.telegram_user_hash,
    actorUserId: d1User.id,
  });

  if (!resolved || isExpiredTicketAction(resolved)) {
    await completeOrphan(env, d1User.id, claim);
    return "unavailable";
  }

  if (resolved.ticket.status !== "active" || !resolved.ticket.payloadEnc) {
    await completeOrphan(env, d1User.id, claim);
    return "unavailable";
  }

  const isBlocked = user.blockTags.includes(resolved.route.blockTag);

  const delivery = await deliveryContextFromResolvedTicket(
    resolved,
    user.contactLabels
  );
  if (!hasDeliverablePayload(delivery.payload)) {
    await completeOrphan(env, d1User.id, claim);
    return "unavailable";
  }

  const job = deliveryJobForPayload(
    d1User.telegram_chat_ciphertext,
    d1User.telegram_user_hash,
    ticketHash,
    capability,
    delivery.payload,
    isBlocked,
    delivery.senderLabel
  );
  if (!job) {
    await completeOrphan(env, d1User.id, claim);
    return "unavailable";
  }

  const sendResult = await sendViaOutboxDo(env, job);
  if (!sendResult.ok || sendResult.retryable || sendResult.permanentFailure) {
    await releaseUnreadDelivery(env, d1User.id, {
      itemId: claim.itemId,
      deliveryAttemptId: claim.deliveryAttemptId,
    });
    return "retryable-failure";
  }

  await markResolvedTicketViewed(env, user.id, resolved);
  await completeUnreadDelivery(env, user.id, {
    itemId: claim.itemId,
    deliveryAttemptId: claim.deliveryAttemptId,
  });
  await recordMessageDelivered(env);

  await notifyMessageSeenRoute(
    env,
    resolved.route.senderChatRoute,
    resolved.route.replyRouteTag,
    `seen:${resolved.ticketHash}:${resolved.route.parentMessageId ?? "none"}`,
    resolved.route.parentMessageId
  ).catch((error) => logBotError("inbox:seen", error));

  return "delivered";
};

export const drainUnreadInbox = async (
  env: Environment,
  userId: string
): Promise<void> => {
  const d1User = await getUserById(userId, env);
  if (!d1User) {
    return;
  }
  for (let delivered = 0; delivered < INBOX_DELIVERY_LIMIT; delivered += 1) {
    const claim = await claimNextUnreadItem(env, d1User.id);
    if (!claim) {
      return;
    }
    const result = await deliverClaim(env, d1User, claim);
    if (result === "retryable-failure") {
      return;
    }
  }
};

export const requestUnreadDelivery = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  if (!ctx.from) {
    return;
  }
  const d1User = await resolveOrCreateUser(ctx, env);
  await cleanupExpiredUnreadItems(env, d1User.id);
  const summary = await getUnreadSummary(env, d1User.id);
  if (summary.unreadCount <= 0) {
    await ctx.reply(INBOX_EMPTY_MESSAGE, { reply_markup: mainMenu });
    return;
  }

  const requestId = crypto.randomUUID();
  await env.NEKO_OUTBOX_QUEUE.send(
    {
      kind: "inbox-drain",
      idempotencyKey: `inbox-drain:${d1User.id}:${requestId}`,
      userId: d1User.id,
      requestId,
      createdAt: Date.now(),
    },
    { contentType: "json" }
  );
  await ctx.reply(INBOX_DELIVERY_REQUESTED_MESSAGE, { reply_markup: mainMenu });
};

export const handleInboxDeliverCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  try {
    await ctx.answerCallbackQuery();
    await requestUnreadDelivery(ctx, env);
  } catch (error) {
    logBotError("inbox:deliver", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const renderInbox = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  try {
    await recordInboxOpened(env);
    await requestUnreadDelivery(ctx, env);
  } catch (error) {
    logBotError("renderInbox", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};
