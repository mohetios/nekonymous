import type { TelegramMessageId, UnixMillis } from "../primitives";

export type MessagePayload = Readonly<{
  message_type?: string;
  message_text?: string;
  photo_id?: string;
  video_id?: string;
  animation_id?: string;
  document_id?: string;
  sticker_id?: string;
  voice_id?: string;
  video_note_id?: string;
  audio_id?: string;
  caption?: string;
  telegramMessageId: TelegramMessageId;
  createdAt: UnixMillis;
}>;
