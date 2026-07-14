import type { Environment } from "../contracts/runtime";
import type { UserDraft, UserStateSnapshot } from "../contracts/user-state/model";
import type {
  AddUnreadItemInput,
  AddUnreadItemResult,
  CompleteUnreadDeliveryInput,
  ReleaseUnreadDeliveryInput,
} from "../contracts/inbox/rpc";
import type {
  UnreadDeliveryClaim,
  UnreadSummary as UnreadInboxSummary,
} from "../contracts/inbox/model";
import { DurableObjectCallError } from "./durable-object-call-error";

const stub = (env: Environment, userId: string) =>
  env.USER_STATE_DO.get(env.USER_STATE_DO.idFromName(userId));

const webhookEventShardName = (eventKey: string): string => {
  let hash = 0;
  for (let index = 0; index < eventKey.length; index += 1) {
    hash = (hash * 31 + eventKey.charCodeAt(index)) >>> 0;
  }
  return `__webhook_events__:${hash % 16}`;
};

const userStateOperation = (path: string): string => `UserStateDO ${path}`;

export const initUserState = async (
  env: Environment,
  userId: string,
  displayNameCiphertext?: string
): Promise<void> => {
  const result = await stub(env, userId).initState(userId, displayNameCiphertext);
  if (!result.ok) {
    throw new DurableObjectCallError(400, userStateOperation("/init"));
  }
};

export const getUserState = async (
  env: Environment,
  userId: string
): Promise<UserStateSnapshot> => {
  const state = await stub(env, userId).getState();
  if (state === null) {
    throw new DurableObjectCallError(404, userStateOperation("/state"));
  }
  return state;
};

export const setPaused = async (
  env: Environment,
  userId: string,
  paused: boolean
): Promise<void> => {
  await stub(env, userId).setPaused(paused);
};

export const setDisplayName = async (
  env: Environment,
  userId: string,
  ciphertext: string
): Promise<void> => {
  await stub(env, userId).setDisplayName(ciphertext);
};

export const setDraft = async (
  env: Environment,
  userId: string,
  draft: UserDraft
): Promise<void> => {
  await stub(env, userId).setDraft(draft);
};

export const getDraft = async (
  env: Environment,
  userId: string
): Promise<UserDraft | null> => stub(env, userId).getDraft();

export const clearDraft = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await stub(env, userId).clearDraft();
};

export const checkCanReceive = async (
  env: Environment,
  recipientUserId: string,
  blockTag: string
): Promise<{ ok: boolean; reason?: string }> =>
  stub(env, recipientUserId).checkCanReceive(blockTag);

/** Atomically checks and records a user action; returns true when throttled. */
export const consumeUserRateLimit = async (
  env: Environment,
  userId: string
): Promise<boolean> => {
  const { limited } = await stub(env, userId).consumeRateLimit();
  return limited;
};

export const claimProcessedEvent = async (
  env: Environment,
  eventKey: string,
  leaseMs?: number
): Promise<"acquired" | "processing" | "done"> => {
  const result = await stub(
    env,
    webhookEventShardName(eventKey)
  ).claimProcessedEvent(eventKey, leaseMs);
  if ("error" in result) {
    throw new DurableObjectCallError(
      400,
      userStateOperation("/processed-events/claim")
    );
  }
  return result.state;
};

export const completeProcessedEvent = async (
  env: Environment,
  eventKey: string
): Promise<void> => {
  await stub(env, webhookEventShardName(eventKey)).completeProcessedEvent(
    eventKey
  );
};

export const failProcessedEvent = async (
  env: Environment,
  eventKey: string
): Promise<void> => {
  await stub(env, webhookEventShardName(eventKey)).failProcessedEvent(eventKey);
};

export const addUnreadItem = async (
  env: Environment,
  recipientUserId: string,
  item: AddUnreadItemInput
): Promise<AddUnreadItemResult> => {
  const result = await stub(env, recipientUserId).addUnreadItem(item);
  if (!result.ok) {
    return {
      ok: false,
      status: result.reason === "full" ? 429 : 400,
      notification: { required: false },
    };
  }
  return {
    ok: true,
    status: 200,
    notification: result.notification,
    ...(typeof result.unreadCount === "number"
      ? { unreadCount: result.unreadCount }
      : {}),
    ...(result.duplicate !== undefined ? { duplicate: result.duplicate } : {}),
  };
};

export const getUnreadSummary = (
  env: Environment,
  userId: string
): Promise<UnreadInboxSummary> => stub(env, userId).getUnreadSummary();

export const claimNextUnreadItem = (
  env: Environment,
  userId: string
): Promise<UnreadDeliveryClaim | null> =>
  stub(env, userId).claimNextUnreadItem();

export const completeUnreadDelivery = async (
  env: Environment,
  userId: string,
  claim: CompleteUnreadDeliveryInput
): Promise<UnreadInboxSummary> => {
  const result = await stub(env, userId).completeUnreadDelivery(claim);
  return result.summary;
};

export const releaseUnreadDelivery = async (
  env: Environment,
  userId: string,
  claim: ReleaseUnreadDeliveryInput
): Promise<void> => {
  await stub(env, userId).releaseUnreadDelivery(claim);
};

export const cleanupExpiredUnreadItems = async (
  env: Environment,
  userId: string
): Promise<UnreadInboxSummary> => {
  const result = await stub(env, userId).cleanupExpiredUnreadItems();
  return result.summary;
};

export const listUnreadItemsForReset = (
  env: Environment,
  userId: string
): Promise<Array<{
  itemId: string;
  sealedCapabilityEnc: string;
  dedupeTag: string;
}>> => stub(env, userId).listUnreadItemsForReset();

export const addBlock = async (
  env: Environment,
  userId: string,
  blockTag: string
): Promise<{ inserted: boolean }> => {
  const result = await stub(env, userId).addBlock(blockTag);
  return { inserted: result.inserted === true };
};

export const removeBlock = async (
  env: Environment,
  userId: string,
  blockTag: string
): Promise<{ removed: boolean }> => {
  const result = await stub(env, userId).removeBlock(blockTag);
  return { removed: result.removed === true };
};

export const clearBlocks = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await stub(env, userId).clearBlocks();
};

export const setContactLabel = async (
  env: Environment,
  userId: string,
  contactTag: string,
  nicknameCiphertext: string | null
): Promise<void> => {
  const result = await stub(env, userId).setLabel(
    contactTag,
    nicknameCiphertext
  );

  if (!result.ok) {
    if (result.limited) {
      throw new Error("Contact label limit reached");
    }
    throw new DurableObjectCallError(400, userStateOperation("/set-label"));
  }
};

export const getContactLabelCiphertext = async (
  env: Environment,
  userId: string,
  contactTag: string
): Promise<string | null> => {
  const result = await stub(env, userId).getLabel(contactTag);
  return result?.nicknameCiphertext ?? null;
};

export const purgeUserState = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await stub(env, userId).purge();
};

export type ProfileSessionWire = {
  id: string;
  version: string;
  status: string;
  currentIndex: number;
  totalQuestions: number;
  answersEnc: string;
  startedAt: number;
  updatedAt: number;
  expiresAt: number | null;
};

export type ProfileMeta = {
  discoverable: boolean;
  profileCapabilityEnc: string | null;
  hasActiveSession: boolean;
  sessionStatus: string | null;
};

export const startProfileSessionWire = async (
  env: Environment,
  userId: string,
  input: { version: string; totalQuestions: number; answersEnc: string }
): Promise<void> => {
  const result = await stub(env, userId).startProfileSession(input);
  if (!result.ok) {
    throw new DurableObjectCallError(400, userStateOperation("/profile-session/start"));
  }
};

export const getActiveProfileSessionWire = async (
  env: Environment,
  userId: string
): Promise<ProfileSessionWire | null> =>
  stub(env, userId).getActiveProfileSession();

export const updateProfileSessionWire = async (
  env: Environment,
  userId: string,
  input: { answersEnc: string; currentIndex: number; status?: string }
): Promise<void> => {
  const result = await stub(env, userId).updateProfileSession(input);
  if (!result.ok) {
    throw new DurableObjectCallError(
      result.reason === "not_found" ? 404 : 400,
      userStateOperation("/profile-session/update")
    );
  }
};

export const deleteProfileSessionWire = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await stub(env, userId).deleteProfileSession();
};

export const getProfileMeta = async (
  env: Environment,
  userId: string
): Promise<ProfileMeta> => {
  const meta = await stub(env, userId).getProfileMeta();
  if (meta === null) {
    throw new DurableObjectCallError(404, userStateOperation("/profile/meta"));
  }
  return meta;
};

export const setDiscoverable = async (
  env: Environment,
  userId: string,
  discoverable: boolean
): Promise<void> => {
  await stub(env, userId).setDiscoverable(discoverable);
};

export const setProfileCapabilityEnc = async (
  env: Environment,
  userId: string,
  ciphertext: string | null
): Promise<void> => {
  await stub(env, userId).setProfileCapabilityEnc(ciphertext);
};

export const getActiveExposureTokenHashes = async (
  env: Environment,
  userId: string
): Promise<string[]> => {
  const { tokenHashes } = await stub(env, userId).getActiveExposureTokens();
  return tokenHashes;
};

export const recordExposureTokenHash = async (
  env: Environment,
  userId: string,
  tokenHash: string
): Promise<void> => {
  await stub(env, userId).recordExposureToken(tokenHash);
};

export const consumeSuggestionSearchBudget = async (
  env: Environment,
  userId: string
): Promise<{ limited: boolean; remaining?: number }> =>
  stub(env, userId).consumeSuggestionSearch();
