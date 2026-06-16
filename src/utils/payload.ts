import type { Message } from "grammy/types";
import type { MessagePayload } from "../types";

export const messageToPayload = (message: Message): MessagePayload => {
  const base: MessagePayload = {
    telegramMessageId: message.message_id,
    createdAt: Date.now(),
  };

  if (message.text) {
    return { ...base, message_type: "text", message_text: message.text };
  }
  if (message.photo) {
    return {
      ...base,
      message_type: "photo",
      photo_id: message.photo[message.photo.length - 1].file_id,
      caption: message.caption,
    };
  }
  if (message.video) {
    return {
      ...base,
      message_type: "video",
      video_id: message.video.file_id,
      caption: message.caption,
    };
  }
  if (message.animation) {
    return {
      ...base,
      message_type: "animation",
      animation_id: message.animation.file_id,
      caption: message.caption,
    };
  }
  if (message.document) {
    return {
      ...base,
      message_type: "document",
      document_id: message.document.file_id,
      caption: message.caption,
    };
  }
  if (message.sticker) {
    return {
      ...base,
      message_type: "sticker",
      sticker_id: message.sticker.file_id,
    };
  }
  if (message.voice) {
    return {
      ...base,
      message_type: "voice",
      voice_id: message.voice.file_id,
    };
  }
  if (message.video_note) {
    return {
      ...base,
      message_type: "video_note",
      video_note_id: message.video_note.file_id,
    };
  }
  if (message.audio) {
    return {
      ...base,
      message_type: "audio",
      audio_id: message.audio.file_id,
      caption: message.caption,
    };
  }

  return base;
};
