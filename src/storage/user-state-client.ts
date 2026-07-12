import type { Environment, InboxPointer, UserDraft } from "../types";
import type { InboxPointerTransitionStatus } from "../status";

type UserStateSnapshot = {
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

const doFetch = async <T>(
  env: Environment,
  userId: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await stub(env, userId).fetch(`https://user-state${path}`, init);
  if (!response.ok) {
    throw new Error(`UserStateDO ${path} failed: ${response.status}`);
  }
  return response.json<T>();
};

export const initUserState = async (
  env: Environment,
  userId: string,
  displayNameCiphertext?: string
): Promise<void> => {
  const response = await stub(env, userId).fetch("https://user-state/init", {
    method: "POST",
    body: JSON.stringify({ userId, displayNameCiphertext }),
  });
  if (!response.ok) {
    throw new Error(`UserStateDO init failed: ${response.status}`);
  }
};

export const getUserState = async (
  env: Environment,
  userId: string
): Promise<UserStateSnapshot> =>
  doFetch<UserStateSnapshot>(env, userId, "/state");

const emptyUserState = (): UserStateSnapshot => ({
  paused: false,
  displayNameCiphertext: null,
  discoverable: false,
  profileCapabilityEnc: null,
  draft: null,
  blockedUserIds: [],
  labels: [],
});

/** Read-only fallback when a user DO has not been initialized yet. */
export const getUserStateSafe = async (
  env: Environment,
  userId: string
): Promise<UserStateSnapshot> => {
  try {
    return await getUserState(env, userId);
  } catch {
    return emptyUserState();
  }
};

export const setPaused = async (
  env: Environment,
  userId: string,
  paused: boolean
): Promise<void> => {
  await doFetch(env, userId, "/set-paused", {
    method: "POST",
    body: JSON.stringify({ paused }),
  });
};

export const setDisplayName = async (
  env: Environment,
  userId: string,
  ciphertext: string
): Promise<void> => {
  await doFetch(env, userId, "/set-display-name", {
    method: "POST",
    body: JSON.stringify({ ciphertext }),
  });
};

export const setDraft = async (
  env: Environment,
  userId: string,
  draft: UserDraft
): Promise<void> => {
  await doFetch(env, userId, "/set-draft", {
    method: "POST",
    body: JSON.stringify(draft),
  });
};

export const getDraft = async (
  env: Environment,
  userId: string
): Promise<UserDraft | null> => {
  const body = await doFetch<{ draft: UserDraft | null }>(env, userId, "/draft");
  return body.draft;
};

export const clearDraft = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await doFetch(env, userId, "/clear-draft", { method: "POST" });
};

export const checkCanReceive = async (
  env: Environment,
  recipientUserId: string,
  senderUserId: string
): Promise<{ ok: boolean; reason?: string }> =>
  doFetch(env, recipientUserId, "/check-can-receive", {
    method: "POST",
    body: JSON.stringify({ senderUserId }),
  });

/** Atomically checks and records a user action; returns true when throttled. */
export const consumeUserRateLimit = async (
  env: Environment,
  userId: string
): Promise<boolean> => {
  const body = await doFetch<{ limited: boolean }>(
    env,
    userId,
    "/consume-rate-limit",
    { method: "POST" }
  );
  return body.limited;
};

export const claimProcessedEvent = async (
  env: Environment,
  eventKey: string,
  leaseMs?: number
): Promise<"acquired" | "processing" | "done"> => {
  const body = await doFetch<{ state: "acquired" | "processing" | "done" }>(
    env,
    webhookEventShardName(eventKey),
    "/processed-events/claim",
    {
      method: "POST",
      body: JSON.stringify({ eventKey, leaseMs }),
    }
  );
  return body.state;
};

export const completeProcessedEvent = async (
  env: Environment,
  eventKey: string
): Promise<void> => {
  await doFetch(env, webhookEventShardName(eventKey), "/processed-events/complete", {
    method: "POST",
    body: JSON.stringify({ eventKey }),
  });
};

export const failProcessedEvent = async (
  env: Environment,
  eventKey: string
): Promise<void> => {
  await doFetch(env, webhookEventShardName(eventKey), "/processed-events/fail", {
    method: "POST",
    body: JSON.stringify({ eventKey }),
  });
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
  const response = await stub(env, recipientUserId).fetch(
    "https://user-state/add-inbox-pointer",
    {
      method: "POST",
      body: JSON.stringify(pointer),
    }
  );

  if (response.status === 429) {
    return { ok: false, status: 429 };
  }

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const body = await response.json<{
    ok: boolean;
    pendingCount?: number;
    duplicate?: boolean;
    evictedTicketHashes?: string[];
  }>();

  return { ...body, status: response.status };
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
): Promise<InboxPage> =>
  doFetch<InboxPage>(
    env,
    userId,
    `/inbox-page?offset=${encodeURIComponent(String(offset))}`
  );

const markInboxPointerStatus = async (
  env: Environment,
  userId: string,
  ticketHash: string,
  status: InboxPointerTransitionStatus
): Promise<void> => {
  await doFetch(env, userId, "/mark-inbox-status", {
    method: "POST",
    body: JSON.stringify({ ticketHash, status }),
  });
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
  await doFetch(env, userId, "/add-block", {
    method: "POST",
    body: JSON.stringify({ blockedUserId }),
  });
};

export const removeBlock = async (
  env: Environment,
  userId: string,
  blockedUserId: string
): Promise<void> => {
  await doFetch(env, userId, "/remove-block", {
    method: "POST",
    body: JSON.stringify({ blockedUserId }),
  });
};

export const clearBlocks = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await doFetch(env, userId, "/clear-blocks", { method: "POST" });
};

export const setContactLabel = async (
  env: Environment,
  userId: string,
  alias: string,
  targetUserId: string,
  nicknameCiphertext: string | null
): Promise<void> => {
  const response = await stub(env, userId).fetch(
    "https://user-state/set-label",
    {
      method: "POST",
      body: JSON.stringify({
        alias,
        targetUserId,
        nicknameCiphertext,
      }),
    }
  );

  if (response.status === 429) {
    throw new Error("Contact label limit reached");
  }
  if (!response.ok) {
    throw new Error(`setContactLabel failed: ${response.status}`);
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
  const response = await stub(env, userId).fetch("https://user-state/purge", {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`UserStateDO purge failed: ${response.status}`);
  }
  const body = await response.json<{ ok: boolean; ticketHashes?: string[] }>();
  return body.ticketHashes ?? [];
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
  await doFetch(env, userId, "/profile-session/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getActiveProfileSessionWire = async (
  env: Environment,
  userId: string
): Promise<ProfileSessionWire | null> => {
  const body = await doFetch<{ session: ProfileSessionWire | null }>(
    env,
    userId,
    "/profile-session/active"
  );
  return body.session;
};

export const updateProfileSessionWire = async (
  env: Environment,
  userId: string,
  input: { answersEnc: string; currentIndex: number; status?: string }
): Promise<void> => {
  await doFetch(env, userId, "/profile-session/update", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const deleteProfileSessionWire = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await stub(env, userId).fetch("https://user-state/profile-session/active", {
    method: "DELETE",
  });
};

export const getProfileMeta = async (
  env: Environment,
  userId: string
): Promise<ProfileMeta> => doFetch<ProfileMeta>(env, userId, "/profile/meta");

export const setDiscoverable = async (
  env: Environment,
  userId: string,
  discoverable: boolean
): Promise<void> => {
  await doFetch(env, userId, "/profile/set-discoverable", {
    method: "POST",
    body: JSON.stringify({ discoverable }),
  });
};

export const setProfileCapabilityEnc = async (
  env: Environment,
  userId: string,
  ciphertext: string | null
): Promise<void> => {
  await doFetch(env, userId, "/profile/set-capability-enc", {
    method: "POST",
    body: JSON.stringify({ ciphertext }),
  });
};

export const getActiveExposureTokenHashes = async (
  env: Environment,
  userId: string
): Promise<string[]> => {
  const body = await doFetch<{ tokenHashes: string[] }>(
    env,
    userId,
    "/exposure-tokens/active"
  );
  return body.tokenHashes;
};

export const recordExposureTokenHash = async (
  env: Environment,
  userId: string,
  tokenHash: string
): Promise<void> => {
  await doFetch(env, userId, "/exposure-tokens/record", {
    method: "POST",
    body: JSON.stringify({ tokenHash }),
  });
};

export const consumeSuggestionSearchBudget = async (
  env: Environment,
  userId: string
): Promise<{ limited: boolean; remaining?: number }> => {
  return doFetch(env, userId, "/consume-suggestion-search", {
    method: "POST",
  });
};
