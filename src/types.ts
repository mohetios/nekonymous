import type { TelegramOutboxJob } from "./queues/telegram-outbox.types";
import type { ProfileIndexJob } from "./queues/profile-index.types";
import type { StatsEvent } from "./stats/events";
import type {
  D1UserStatus,
  InboxPointerStatus,
  UserDraftMode,
} from "./status";

export type MessagePayload = {
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
  telegramMessageId: number;
  createdAt: number;
};

/** Delivery view for Telegram media helpers (chat ids, not internal ids). */
export interface Conversation {
  connection: {
    from: number;
    to: number;
    senderLinkUuid?: string;
    recipientLinkUuid?: string;
    parent_message_id?: number;
    reply_to_message_id?: number;
  };
  payload: {
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
  };
}

export type CipherEnvelope = {
  v: 1;
  kid: string;
  iv: string;
  ct: string;
};

export type InboxPointer = {
  ticketHash: string;
  sealedTicketRef: string;
  displayNumber: string;
  status: InboxPointerStatus;
  createdBucket: number;
  createdAt: number;
  expiresAt: number;
};

export type UserDraft = {
  id: string;
  mode: UserDraftMode;
  toUserId?: string;
  linkSlug?: string;
  replyRef?: string;
  parent_message_id?: number;
  reply_to_message_id?: number;
  pendingNicknameAlias?: string;
  pendingSettings?: "confirmClearData" | "confirmClearBlockList" | "confirmResetMatchHistory";
};

export type D1User = {
  id: string;
  telegram_user_hash: string;
  telegram_chat_ciphertext: string;
  locale: string;
  locale_source: string;
  onboarding_completed: number;
  status: D1UserStatus;
  bucket_id: number;
  created_at: number;
  updated_at: number;
};

export type BotUser = {
  id: string;
  slug: string;
  displayName: string;
  paused: boolean;
  blockedUserIds: string[];
  contactLabels: Record<string, string>;
  draft?: UserDraft;
  pendingSettings?: UserDraft["pendingSettings"];
  lastMessageAt?: number;
};

export interface Environment extends CloudflareEnv {
  NEKO_OUTBOX_QUEUE: Queue<TelegramOutboxJob>;
  NEKO_STATS_QUEUE: Queue<StatsEvent>;
  NEKO_PROFILE_INDEX_QUEUE: Queue<ProfileIndexJob>;
}
