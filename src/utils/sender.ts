import type { Context } from "grammy";
import type { Conversation } from "../types";
import {
  buildDeliveryHeader,
  buildDeliveryHeaderLine,
  buildDeliveryHeaderMarkdown,
} from "./contact";
import { UnsupportedMessageTypeMessage } from "../i18n/messages";
import {
  TELEGRAM_CAPTION_MAX,
  TELEGRAM_MESSAGE_TEXT_MAX,
  truncateUtf8,
} from "./telegram-limits";
import { escapeMarkdownV2 } from "./tools";

type ReplyOptions = NonNullable<Parameters<Context["reply"]>[1]>;

export const hasDeliverablePayload = (message: Conversation): boolean => {
  const { message_type, message_text } = message.payload;

  if (!message_type) {
    return false;
  }

  if (message_type === "text") {
    return !!message_text?.trim();
  }

  return true;
};

const sendWithOptionalReply = async (
  send: (options: ReplyOptions) => Promise<unknown>,
  replyOptions: ReplyOptions
): Promise<void> => {
  const { reply_to_message_id, ...rest } = replyOptions;

  try {
    await send(replyOptions);
  } catch (error) {
    if (reply_to_message_id === undefined) {
      throw error;
    }
    await send(rest);
  }
};

const sendWithKeyboardFallback = async (
  send: (options: ReplyOptions) => Promise<unknown>,
  replyOptions: ReplyOptions
): Promise<void> => {
  try {
    await sendWithOptionalReply(send, replyOptions);
  } catch (error) {
    const { reply_markup: _keyboard, ...withoutKeyboard } = replyOptions;
    if (Object.keys(withoutKeyboard).length === 0) {
      throw error;
    }
    await sendWithOptionalReply(send, withoutKeyboard);
  }
};

const captionForMarkdown = (caption: string | undefined) => {
  if (!caption) {
    return undefined;
  }
  return escapeMarkdownV2(truncateUtf8(caption, TELEGRAM_CAPTION_MAX));
};

const captionWithLabel = (
  senderLabel: string | undefined,
  caption: string | undefined
): { caption?: string; parse_mode?: "MarkdownV2" } => {
  if (!senderLabel) {
    const formatted = captionForMarkdown(caption);
    return formatted
      ? { caption: formatted, parse_mode: "MarkdownV2" }
      : {};
  }

  const header = buildDeliveryHeaderMarkdown(senderLabel);
  const body = caption ? escapeMarkdownV2(truncateUtf8(caption, TELEGRAM_CAPTION_MAX)) : "";
  return {
    caption: truncateUtf8(`${header}${body}`, TELEGRAM_CAPTION_MAX),
    parse_mode: "MarkdownV2",
  };
};

const sendLabelLine = async (
  ctx: Context,
  senderLabel: string
): Promise<void> => {
  await ctx.reply(buildDeliveryHeaderLine(senderLabel));
};

export const sendDecryptedMessage = async (
  ctx: Context,
  decryptedMessage: Conversation,
  replyOptions: ReplyOptions,
  senderLabel?: string
): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  if (!hasDeliverablePayload(decryptedMessage)) {
    return;
  }

  switch (decryptedMessage.payload.message_type) {
    case "text": {
      const body = decryptedMessage.payload.message_text!;
      const text = senderLabel
        ? truncateUtf8(
            `${buildDeliveryHeader(senderLabel)}${body}`,
            TELEGRAM_MESSAGE_TEXT_MAX
          )
        : truncateUtf8(body, TELEGRAM_MESSAGE_TEXT_MAX);
      await sendWithKeyboardFallback((options) => ctx.reply(text, options), replyOptions);
      break;
    }
    case "photo":
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendPhoto(chatId, decryptedMessage.payload.photo_id!, {
            ...options,
            ...captionWithLabel(senderLabel, decryptedMessage.payload.caption),
          }),
        replyOptions
      );
      break;
    case "video":
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendVideo(chatId, decryptedMessage.payload.video_id!, {
            ...options,
            ...captionWithLabel(senderLabel, decryptedMessage.payload.caption),
          }),
        replyOptions
      );
      break;
    case "animation":
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendAnimation(
            chatId,
            decryptedMessage.payload.animation_id!,
            {
              ...options,
              ...captionWithLabel(senderLabel, decryptedMessage.payload.caption),
            }
          ),
        replyOptions
      );
      break;
    case "document":
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendDocument(chatId, decryptedMessage.payload.document_id!, {
            ...options,
            ...captionWithLabel(senderLabel, decryptedMessage.payload.caption),
          }),
        replyOptions
      );
      break;
    case "sticker":
      if (senderLabel) {
        await sendLabelLine(ctx, senderLabel);
      }
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendSticker(
            chatId,
            decryptedMessage.payload.sticker_id!,
            options
          ),
        replyOptions
      );
      break;
    case "voice":
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendVoice(chatId, decryptedMessage.payload.voice_id!, {
            ...options,
            ...captionWithLabel(senderLabel, decryptedMessage.payload.caption),
          }),
        replyOptions
      );
      break;
    case "video_note":
      if (senderLabel) {
        await sendLabelLine(ctx, senderLabel);
      }
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendVideoNote(
            chatId,
            decryptedMessage.payload.video_note_id!,
            options
          ),
        replyOptions
      );
      break;
    case "audio":
      await sendWithKeyboardFallback(
        (options) =>
          ctx.api.sendAudio(chatId, decryptedMessage.payload.audio_id!, {
            ...options,
            ...captionWithLabel(senderLabel, decryptedMessage.payload.caption),
          }),
        replyOptions
      );
      break;
    default:
      await sendWithKeyboardFallback(
        (options) => ctx.reply(UnsupportedMessageTypeMessage, options),
        replyOptions
      );
      break;
  }
};
