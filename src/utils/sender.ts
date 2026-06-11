import type { Context } from "grammy";
import type { Conversation } from "../types";
import { UnsupportedMessageTypeMessage } from "./messages";
import { escapeMarkdownV2 } from "./tools";

type ReplyOptions = NonNullable<Parameters<Context["reply"]>[1]>;

export const sendDecryptedMessage = async (
  ctx: Context,
  decryptedMessage: Conversation,
  replyOptions: ReplyOptions
): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  switch (decryptedMessage.payload.message_type) {
    case "text":
      await ctx.reply(decryptedMessage.payload.message_text ?? "", replyOptions);
      break;
    case "photo":
      await ctx.api.sendPhoto(chatId, decryptedMessage.payload.photo_id!, {
        ...replyOptions,
        caption: decryptedMessage.payload.caption
          ? escapeMarkdownV2(decryptedMessage.payload.caption)
          : undefined,
        parse_mode: "MarkdownV2",
      });
      break;
    case "video":
      await ctx.api.sendVideo(chatId, decryptedMessage.payload.video_id!, {
        ...replyOptions,
        caption: decryptedMessage.payload.caption
          ? escapeMarkdownV2(decryptedMessage.payload.caption)
          : undefined,
        parse_mode: "MarkdownV2",
      });
      break;
    case "animation":
      await ctx.api.sendAnimation(
        chatId,
        decryptedMessage.payload.animation_id!,
        {
          ...replyOptions,
          caption: decryptedMessage.payload.caption
            ? escapeMarkdownV2(decryptedMessage.payload.caption)
            : undefined,
          parse_mode: "MarkdownV2",
        }
      );
      break;
    case "document":
      await ctx.api.sendDocument(chatId, decryptedMessage.payload.document_id!, {
        ...replyOptions,
        caption: decryptedMessage.payload.caption
          ? escapeMarkdownV2(decryptedMessage.payload.caption)
          : undefined,
        parse_mode: "MarkdownV2",
      });
      break;
    case "sticker":
      await ctx.api.sendSticker(
        chatId,
        decryptedMessage.payload.sticker_id!,
        replyOptions
      );
      break;
    case "voice":
      await ctx.api.sendVoice(chatId, decryptedMessage.payload.voice_id!, {
        ...replyOptions,
        caption: decryptedMessage.payload.caption
          ? escapeMarkdownV2(decryptedMessage.payload.caption)
          : undefined,
        parse_mode: "MarkdownV2",
      });
      break;
    case "video_note":
      await ctx.api.sendVideoNote(
        chatId,
        decryptedMessage.payload.video_note_id!,
        replyOptions
      );
      break;
    case "audio":
      await ctx.api.sendAudio(chatId, decryptedMessage.payload.audio_id!, {
        ...replyOptions,
        caption: decryptedMessage.payload.caption
          ? escapeMarkdownV2(decryptedMessage.payload.caption)
          : undefined,
        parse_mode: "MarkdownV2",
      });
      break;
    default:
      await ctx.reply(UnsupportedMessageTypeMessage, replyOptions);
      break;
  }
};
