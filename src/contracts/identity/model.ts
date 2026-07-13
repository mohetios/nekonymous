import type {
  ActorHash,
  BlockTag,
  ContactTag,
  InternalAccountId,
  UnixMillis,
} from "../primitives";
import type { UserDraft, PendingSettingsAction } from "../user-state/model";

export type D1UserStatus = "active";

export type D1User = Readonly<{
  id: InternalAccountId;
  telegram_user_hash: ActorHash;
  telegram_chat_ciphertext: string;
  locale: string;
  locale_source: string;
  onboarding_completed: number;
  status: D1UserStatus;
  bucket_id: number;
  created_at: UnixMillis;
  updated_at: UnixMillis;
}>;

export type BotUser = Readonly<{
  id: InternalAccountId;
  slug: string;
  displayName: string;
  paused: boolean;
  blockTags: BlockTag[];
  contactLabels: Record<ContactTag, string>;
  draft?: UserDraft;
  pendingSettings?: PendingSettingsAction;
  lastMessageAt?: UnixMillis;
}>;
