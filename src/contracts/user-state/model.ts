import type {
  BlockTag,
  ContactTag,
  InternalAccountId,
  TelegramMessageId,
  UnixMillis,
} from "../primitives";
import type { EncryptedNickname } from "../crypto";

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
  labels: Array<{
    contact_tag: ContactTag;
    nickname_ciphertext: EncryptedNickname;
  }>;
  lastMessageAt?: UnixMillis;
}>;
