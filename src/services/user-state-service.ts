import type { Environment, InboxTicket, UserDraft } from "../types";

type UserStateSnapshot = {
  paused: boolean;
  displayNameCiphertext: string | null;
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

export const isRateLimited = async (
  env: Environment,
  userId: string
): Promise<boolean> => {
  const body = await doFetch<{ limited: boolean }>(
    env,
    userId,
    "/check-rate-limit",
    { method: "POST" }
  );
  return body.limited;
};

export const touchRateLimit = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await doFetch(env, userId, "/touch-rate-limit", { method: "POST" });
};

export type AddTicketInput = {
  ref: string;
  ticketId: string;
  senderUserId: string;
  recipientUserId: string;
  conversationId: string;
  payloadCiphertext: string;
  connectionCiphertext: string;
  dedupeKey: string;
};

export type AddTicketResult = {
  ok: boolean;
  pendingCount?: number;
  duplicate?: boolean;
  status: number;
};

export const addInboxTicket = async (
  env: Environment,
  recipientUserId: string,
  ticket: AddTicketInput
): Promise<AddTicketResult> => {
  const response = await stub(env, recipientUserId).fetch(
    "https://user-state/add-ticket",
    {
      method: "POST",
      body: JSON.stringify(ticket),
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
  }>();

  return { ...body, status: response.status };
};

export const listPendingInbox = async (
  env: Environment,
  userId: string
): Promise<InboxTicket[]> => {
  const body = await doFetch<{ tickets: InboxTicket[] }>(
    env,
    userId,
    "/pending-inbox"
  );
  return body.tickets;
};

export const markTicketDelivered = async (
  env: Environment,
  userId: string,
  ref: string
): Promise<void> => {
  await doFetch(env, userId, "/mark-delivered", {
    method: "POST",
    body: JSON.stringify({ ref }),
  });
};

export const getInboxTicket = async (
  env: Environment,
  userId: string,
  ref: string
): Promise<InboxTicket | null> => {
  const response = await stub(env, userId).fetch(
    `https://user-state/ticket/${encodeURIComponent(ref)}`
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`getInboxTicket failed: ${response.status}`);
  }
  return response.json<InboxTicket>();
};

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

export const markTicketReported = async (
  env: Environment,
  userId: string,
  ref: string
): Promise<void> => {
  await doFetch(env, userId, "/mark-reported", {
    method: "POST",
    body: JSON.stringify({ ref }),
  });
};

export const purgeUserState = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await stub(env, userId).fetch("https://user-state/purge", {
    method: "DELETE",
  });
};
