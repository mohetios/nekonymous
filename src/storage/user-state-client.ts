import type { Environment, InboxPointer, UserDraft } from "../types";
import type { InboxPointerTransitionStatus } from "../status";
import { DurableObjectCallError } from "./durable-object-call-error";

export type UserStateSnapshot = {
  paused: boolean;
  displayNameCiphertext: string | null;
  discoverable: boolean;
  profileCapabilityEnc: string | null;
  draft: UserDraft | null;
  blockedUserIds: string[];
  labels: Array<{
    alias: string;
    target_user_id: string;
    nickname_ciphertext: string;
  }>;
  lastMessageAt?: number;
};

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

export const getOptionalUserState = async (
  env: Environment,
  userId: string
): Promise<UserStateSnapshot | null> => {
  try {
    return await getUserState(env, userId);
  } catch (error) {
    if (error instanceof DurableObjectCallError && error.status === 404) {
      return null;
    }
    throw error;
  }
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
  senderUserId: string
): Promise<{ ok: boolean; reason?: string }> =>
  stub(env, recipientUserId).checkCanReceive(senderUserId);

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

export type AddInboxPointerInput = {
  ticketHash: string;
  sealedTicketRef: string;
  displayNumber: string;
  createdBucket: number;
  createdAt: number;
  expiresAt: number;
  dedupeKey: string;
};

export type AddInboxPointerResult = {
  ok: boolean;
  pendingCount?: number;
  duplicate?: boolean;
  evictedTicketHashes?: string[];
  status: number;
};

export const addInboxPointer = async (
  env: Environment,
  recipientUserId: string,
  pointer: AddInboxPointerInput
): Promise<AddInboxPointerResult> => {
  const result = await stub(env, recipientUserId).addInboxPointer(pointer);

  if (!result.ok) {
    return { ok: false, status: result.reason === "full" ? 429 : 400 };
  }

  return {
    ok: true,
    status: 200,
    pendingCount: result.pendingCount,
    ...(result.duplicate !== undefined ? { duplicate: result.duplicate } : {}),
    ...(result.evictedTicketHashes !== undefined
      ? { evictedTicketHashes: result.evictedTicketHashes }
      : {}),
  };
};

export type InboxPage = {
  pointers: InboxPointer[];
  nextOffset?: number;
  expiredTicketHashes: string[];
};

export const listInboxPage = async (
  env: Environment,
  userId: string,
  offset = 0
): Promise<InboxPage> => stub(env, userId).inboxPage(offset);

const markInboxPointerStatus = async (
  env: Environment,
  userId: string,
  ticketHash: string,
  status: InboxPointerTransitionStatus
): Promise<void> => {
  await stub(env, userId).markInboxStatus(ticketHash, status);
};

export const markInboxPointerViewed = (
  env: Environment,
  userId: string,
  ticketHash: string
): Promise<void> => markInboxPointerStatus(env, userId, ticketHash, "viewed");

export const markInboxPointerReplied = (
  env: Environment,
  userId: string,
  ticketHash: string
): Promise<void> => markInboxPointerStatus(env, userId, ticketHash, "replied");

export const markInboxPointerBlocked = (
  env: Environment,
  userId: string,
  ticketHash: string
): Promise<void> => markInboxPointerStatus(env, userId, ticketHash, "blocked");

export const addBlock = async (
  env: Environment,
  userId: string,
  blockedUserId: string
): Promise<void> => {
  await stub(env, userId).addBlock(blockedUserId);
};

export const removeBlock = async (
  env: Environment,
  userId: string,
  blockedUserId: string
): Promise<void> => {
  await stub(env, userId).removeBlock(blockedUserId);
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
  alias: string,
  targetUserId: string,
  nicknameCiphertext: string | null
): Promise<void> => {
  const result = await stub(env, userId).setLabel(
    alias,
    targetUserId,
    nicknameCiphertext
  );

  if (!result.ok) {
    if (result.limited) {
      throw new Error("Contact label limit reached");
    }
    throw new DurableObjectCallError(400, userStateOperation("/set-label"));
  }
};

export const markInboxPointerReported = async (
  env: Environment,
  userId: string,
  ticketHash: string
): Promise<void> => {
  await markInboxPointerStatus(env, userId, ticketHash, "reported");
};

export const purgeUserState = async (
  env: Environment,
  userId: string
): Promise<string[]> => {
  const result = await stub(env, userId).purge();
  return result.ticketHashes ?? [];
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
