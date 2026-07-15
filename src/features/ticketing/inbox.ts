import type { Context } from "grammy";
import type { D1User } from "../../contracts/identity/model";
import type { Environment } from "../../contracts/runtime";
import type { MessagePayload } from "../../contracts/telegram/delivery";
import { getResolvedUser } from "../../bot/context";
import { createMessageKeyboard, mainMenu } from "../../bot/keyboards";
import {
  HuhMessage,
  INBOX_DELIVERY_REQUESTED_MESSAGE,
  INBOX_EMPTY_MESSAGE,
} from "../../i18n/messages";
import { logBotError } from "../../utils/logs";
import { getUserById } from "../identity/identity-service";
import { getContactLabel } from "./contact";
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
  getUserState,
  releaseUnreadDelivery,
} from "../../storage/user-state-client";
import { deleteTicketRecord } from "../../storage/ticket-vault/ticket-vault.client";
import { createTicketHash } from "./keys";
import { parseTicketCapability } from "./ticket-capability";
import type {
  InboxDeliverClaimResult,
  InboxDeliveryPrefs,
  InboxDrainResult,
  UnreadDeliveryClaim,
} from "../../contracts/inbox/model";
import { sendViaOutboxDo } from "../../storage/telegram-outbox-client";
import type { TelegramOutboxJob } from "../../contracts/telegram/outbox";
import { recordInboxOpened, recordMessageDelivered } from "../../stats/product-events";
import { openUnreadCapability } from "./unread-capability";
import { buildDeliveryHeader } from "./contact";
import {
  TELEGRAM_CAPTION_MAX,
  TELEGRAM_MESSAGE_TEXT_MAX,
  truncateUtf8,
} from "../../bot/telegram-limits";

/** Product decision: skip per-delivery seen receipts to limit TelegramOutbox load. */
const SEEN_RECEIPTS_ENABLED = false;
import { INBOX_DELIVERY_LIMIT } from "../../contracts/inbox/constants";

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
      if (!payload.message_text) {
        return null;
      }
      {
        const text = textWithLabel(payload, senderLabel);
        if (!text) {
          return null;
        }
      return {
        ...base,
        method: "sendMessage",
        payload: {
          text,
          reply_markup: replyMarkup,
        },
      };
      }
    case "photo":
      if (!payload.photo_id) {
        return null;
      }
      {
        const caption = captionWithLabel(payload, senderLabel);
      return {
        ...base,
        method: "sendPhoto",
        payload: {
          photo: payload.photo_id,
          reply_markup: replyMarkup,
          ...(caption ? { caption } : {}),
        },
      };
      }
    case "video":
      if (!payload.video_id) {
        return null;
      }
      {
        const caption = captionWithLabel(payload, senderLabel);
      return {
        ...base,
        method: "sendVideo",
        payload: {
          video: payload.video_id,
          reply_markup: replyMarkup,
          ...(caption ? { caption } : {}),
        },
      };
      }
    case "animation":
      if (!payload.animation_id) {
        return null;
      }
      {
        const caption = captionWithLabel(payload, senderLabel);
      return {
        ...base,
        method: "sendAnimation",
        payload: {
          animation: payload.animation_id,
          reply_markup: replyMarkup,
          ...(caption ? { caption } : {}),
        },
      };
      }
    case "document":
      if (!payload.document_id) {
        return null;
      }
      {
        const caption = captionWithLabel(payload, senderLabel);
      return {
        ...base,
        method: "sendDocument",
        payload: {
          document: payload.document_id,
          reply_markup: replyMarkup,
          ...(caption ? { caption } : {}),
        },
      };
      }
    case "voice":
      if (!payload.voice_id) {
        return null;
      }
      {
        const caption = captionWithLabel(payload, senderLabel);
      return {
        ...base,
        method: "sendVoice",
        payload: {
          voice: payload.voice_id,
          reply_markup: replyMarkup,
          ...(caption ? { caption } : {}),
        },
      };
      }
    case "audio":
      if (!payload.audio_id) {
        return null;
      }
      {
        const caption = captionWithLabel(payload, senderLabel);
      return {
        ...base,
        method: "sendAudio",
        payload: {
          audio: payload.audio_id,
          reply_markup: replyMarkup,
          ...(caption ? { caption } : {}),
        },
      };
      }
    case "sticker":
      if (!payload.sticker_id) {
        return null;
      }
      return {
        ...base,
        method: "sendSticker",
        payload: {
          sticker: payload.sticker_id,
          reply_markup: replyMarkup,
        },
      };
    case "video_note":
      if (!payload.video_note_id) {
        return null;
      }
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
  claim: UnreadDeliveryClaim,
  ticketHash?: string
): Promise<{ orphaned: boolean }> => {
  // Claim ownership first: a stale attempt must never delete TicketVault while
  // a newer claim still owns the unread row.
  const completed = await completeUnreadDelivery(env, userId, {
    itemId: claim.itemId,
    deliveryAttemptId: claim.deliveryAttemptId,
  });
  if (!completed.ok) {
    logBotError("inbox:orphan-complete", new Error("stale delivery attempt"));
    return { orphaned: false };
  }

  if (ticketHash) {
    await deleteTicketRecord(env, ticketHash).catch((error) =>
      logBotError("inbox:orphan-vault", error)
    );
  }
  return { orphaned: true };
};

const isPermanentUnreadCapabilityError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  // Only clearly malformed ciphertext is permanent. Auth/config mismatches
  // (wrong key, OperationError) must retry so healthy rows are not destroyed.
  return (
    message.includes("invalid ciphertext envelope") ||
    message.includes("invalid aes-gcm ciphertext") ||
    message.includes("unexpected end of json") ||
    message.includes("is not valid json")
  );
};

const resolveLabel = async (
  env: Environment,
  userId: string,
  contactTag: string,
  cache: Map<string, string | undefined>
): Promise<string | undefined> => {
  if (cache.has(contactTag)) {
    return cache.get(contactTag);
  }
  const label = await getContactLabel(env, userId, contactTag);
  cache.set(contactTag, label);
  return label;
};

const loadDeliveryPrefs = async (
  env: Environment,
  d1User: D1User
): Promise<{
  blockTags: string[];
}> => {
  try {
    const state = await getUserState(env, d1User.id);
    return {
      blockTags: state.blockTags,
    };
  } catch (error) {
    logBotError("inbox:delivery-prefs", error);
    return {
      blockTags: [],
    };
  }
};

const deliverClaim = async (
  env: Environment,
  d1User: D1User,
  claim: UnreadDeliveryClaim,
  deliveryPrefs: InboxDeliveryPrefs
): Promise<InboxDeliverClaimResult> => {
  let capability: string;
  try {
    capability = await openUnreadCapability(
      env.APP_MASTER_KEY,
      d1User.id,
      claim.itemId,
      claim.dedupeTag,
      claim.sealedCapabilityEnc
    );
  } catch (error) {
    if (!isPermanentUnreadCapabilityError(error)) {
      // Unknown/runtime/config errors: conserve data and retry.
      logBotError("inbox:open-unread-capability", error, {
        retryable: true,
        delaySeconds: 5,
      });
      const released = await releaseUnreadDelivery(env, d1User.id, {
        itemId: claim.itemId,
        deliveryAttemptId: claim.deliveryAttemptId,
      });
      if (!released.ok) {
        logBotError("inbox:release", new Error("stale delivery attempt"));
      }
      return { outcome: "retryable-failure", delaySeconds: 5 };
    }
    logBotError("inbox:open-unread-capability", error, { permanent: true });
    await completeOrphan(env, d1User.id, claim);
    return { outcome: "unavailable" };
  }

  let resolved;
  try {
    resolved = await resolveTicketAction(null, env, "open", capability, {
      actorHash: d1User.telegram_user_hash,
      actorUserId: d1User.id,
    });
  } catch (error) {
    // Unexpected DO/storage/crypto exceptions must not destroy a healthy ticket.
    // Only explicit missing/expired/invalid results below orphan permanently.
    logBotError("inbox:resolve-ticket", error, {
      retryable: true,
      delaySeconds: 5,
    });
    const released = await releaseUnreadDelivery(env, d1User.id, {
      itemId: claim.itemId,
      deliveryAttemptId: claim.deliveryAttemptId,
    });
    if (!released.ok) {
      logBotError("inbox:release", new Error("stale delivery attempt"));
    }
    return { outcome: "retryable-failure", delaySeconds: 5 };
  }

  if (!resolved || isExpiredTicketAction(resolved)) {
    logBotError("inbox:resolve-ticket", new Error("Ticket unavailable"));
    let ticketHash: string | undefined;
    try {
      ticketHash = await createTicketHash(
        env.APP_HMAC_PEPPER,
        parseTicketCapability(capability)
      );
    } catch {
      // Capability already opened — hash derivation should succeed.
    }
    await completeOrphan(env, d1User.id, claim, ticketHash);
    return { outcome: "unavailable" };
  }

  if (resolved.ticket.status !== "active" || !resolved.ticket.payloadEnc) {
    logBotError("inbox:payload-missing", new Error("Ticket payload unavailable"));
    await completeOrphan(env, d1User.id, claim, resolved.ticketHash);
    return { outcome: "unavailable" };
  }

  const isBlocked = deliveryPrefs.blockTags.has(resolved.route.blockTag);

  const senderLabel = await resolveLabel(
    env,
    d1User.id,
    resolved.route.contactTag,
    deliveryPrefs.labelCache
  );
  const delivery = await deliveryContextFromResolvedTicket(
    resolved,
    senderLabel
  );
  if (!hasDeliverablePayload(delivery.payload)) {
    logBotError("inbox:payload-undeliverable", new Error("Unsupported payload"));
    await completeOrphan(env, d1User.id, claim, resolved.ticketHash);
    return { outcome: "unavailable" };
  }

  const job = deliveryJobForPayload(
    d1User.telegram_chat_ciphertext,
    d1User.telegram_user_hash,
    resolved.ticketHash,
    capability,
    delivery.payload,
    isBlocked,
    delivery.senderLabel
  );
  if (!job) {
    logBotError("inbox:delivery-job", new Error("Unsupported message type"));
    await completeOrphan(env, d1User.id, claim, resolved.ticketHash);
    return { outcome: "unavailable" };
  }

  let sendResult;
  try {
    sendResult = await sendViaOutboxDo(env, job);
  } catch (error) {
    logBotError("inbox:send", error, { retryable: true, delaySeconds: 5 });
    const released = await releaseUnreadDelivery(env, d1User.id, {
      itemId: claim.itemId,
      deliveryAttemptId: claim.deliveryAttemptId,
    });
    if (!released.ok) {
      logBotError("inbox:release", new Error("stale delivery attempt"));
    }
    return { outcome: "retryable-failure", delaySeconds: 5 };
  }
  if (sendResult.status === "retry") {
    logBotError("inbox:send", new Error("Telegram outbox send retry"), {
      retryable: true,
      delaySeconds: sendResult.delaySeconds,
    });
    const released = await releaseUnreadDelivery(env, d1User.id, {
      itemId: claim.itemId,
      deliveryAttemptId: claim.deliveryAttemptId,
    });
    if (!released.ok) {
      logBotError("inbox:release", new Error("stale delivery attempt"));
    }
    return {
      outcome: "retryable-failure",
      delaySeconds: sendResult.delaySeconds,
    };
  }
  if (sendResult.status === "rejected") {
    logBotError("inbox:send", new Error("Telegram outbox send rejected"), {
      permanent: true,
    });
    // Permanent outbox rejection: drop unread + vault payload (no access path left).
    await completeOrphan(env, d1User.id, claim, resolved.ticketHash);
    return { outcome: "unavailable" };
  }

  await markResolvedTicketViewed(env, d1User.id, resolved);
  const completed = await completeUnreadDelivery(env, d1User.id, {
    itemId: claim.itemId,
    deliveryAttemptId: claim.deliveryAttemptId,
  });
  if (!completed.ok) {
    // Payload may already be cleared; unread will scrub on a later orphan path.
    logBotError(
      "inbox:finalization-stale",
      new Error("payload cleared but unread completion missed attempt")
    );
  }
  await recordMessageDelivered(env);

  if (SEEN_RECEIPTS_ENABLED) {
    await notifyMessageSeenRoute(
      env,
      resolved.route.senderChatRoute,
      resolved.route.replyRouteTag,
      `seen:${resolved.ticketHash}:${resolved.route.parentMessageId ?? "none"}`,
      resolved.route.parentMessageId
    ).catch((error) => logBotError("inbox:seen", error));
  }

  return { outcome: "delivered" };
};

export const drainUnreadInbox = async (
  env: Environment,
  userId: string
): Promise<InboxDrainResult> => {
  const d1User = await getUserById(userId, env);
  if (!d1User) {
    return { status: "completed", deliveredCount: 0 };
  }

  const prefs = await loadDeliveryPrefs(env, d1User);
  const deliveryPrefs: InboxDeliveryPrefs = {
    blockTags: new Set(prefs.blockTags),
    labelCache: new Map(),
  };

  let deliveredCount = 0;
  for (let delivered = 0; delivered < INBOX_DELIVERY_LIMIT; delivered += 1) {
    const claim = await claimNextUnreadItem(env, d1User.id);
    if (!claim) {
      return { status: "completed", deliveredCount };
    }
    const result = await deliverClaim(env, d1User, claim, deliveryPrefs);
    if (result.outcome === "retryable-failure") {
      return {
        status: "retry",
        deliveredCount,
        delaySeconds: result.delaySeconds,
      };
    }
    if (result.outcome === "delivered") {
      deliveredCount += 1;
    }
  }
  return { status: "completed", deliveredCount };
};

export const requestUnreadDelivery = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  if (!ctx.from) {
    return;
  }
  const d1User = await getResolvedUser(ctx, env);
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
