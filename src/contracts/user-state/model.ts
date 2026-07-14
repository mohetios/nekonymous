import type {
  BlockTag,
  ContactTag,
  InternalAccountId,
  TelegramMessageId,
  UnixMillis,
} from "../primitives";

export type UserDraftMode =
  | "compose"
  | "reply"
  | "nickname"
  | "display_name"
  | "settings"
  | "conversation_intro";

export type PendingSettingsAction =
  | "confirmClearData"
  | "confirmClearBlockList"
  | "confirmResetMatchHistory";

export type UserDraft = Readonly<{
  id: string;
  mode: UserDraftMode;
  toUserId?: InternalAccountId;
  linkSlug?: string;
  parent_message_id?: TelegramMessageId;
  reply_to_message_id?: TelegramMessageId;
  pendingNicknameContactTag?: ContactTag;
  pendingSettings?: PendingSettingsAction;
  expiresAt?: UnixMillis;
}>;

export type UserStateSnapshot = Readonly<{
  paused: boolean;
  displayNameCiphertext: string | null;
  discoverable: boolean;
  profileCapabilityEnc: string | null;
  draft: UserDraft | null;
  blockTags: BlockTag[];
  lastMessageAt?: UnixMillis;
}>;
