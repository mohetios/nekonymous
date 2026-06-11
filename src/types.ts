/**
 * Interface representing a User in the system.
 */
export interface User {
  userName: string;
  userUUID: string;
  blockList: string[];
  /** When true, the anonymous link rejects new senders until resumed. */
  paused?: boolean;
  lastMessage?: number;
  /** Recipient-only labels keyed by opaque sender alias (HKDF). */
  contactLabels?: Record<string, string>;
  /** Awaiting settings input (display name or data-delete confirmation). */
  pendingSettings?: "editName" | "confirmClearData" | "confirmClearBlockList";
  currentConversation?: {
    to?: number;
    reply_to_message_id?: number;
    parent_message_id?: number;
    /** Awaiting nickname text for this sender alias. */
    pendingNickname?: string;
  };
}

export interface InboxMessage {
  ref: string;
  ticketId: string;
  conversationId: string;
  ciphertext?: string;
  delivered?: boolean;
}

/**
 * Interface representing a Conversation between two users.
 */
export interface Conversation {
  connection: {
    from: number;
    to: number;
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

/**
 * Interface representing the Environment variables used in the bot.
 */
export interface Environment {
  SECRET_TELEGRAM_API_TOKEN: string;
  BOT_SECRET_KEY: string;
  NekonymousKV: KVNamespace;
  BOT_INFO: string;
  BOT_NAME: string;
  APP_SECURE_KEY: string;
  INBOX_DO: DurableObjectNamespace;
}

export type Handler = (
  request: Request,
  env: Environment,
  ctx: ExecutionContext
) => Response | Promise<Response>;
