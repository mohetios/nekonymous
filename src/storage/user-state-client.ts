import type { Environment, InboxTicket, UserDraft } from "../types";
import { createCapabilityLookupHash } from "../ticketing/ticketing-service";

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

const emptyUserState = (): UserStateSnapshot => ({
  paused: false,
  displayNameCiphertext: null,
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
  ref: string,
  nextRef?: string
): Promise<void> => {
  await doFetch(env, userId, "/mark-delivered", {
    method: "POST",
    body: JSON.stringify({ ref, nextRef }),
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

export const getInboxTicketByCapability = async (
  env: Environment,
  userId: string,
  capability: string
): Promise<InboxTicket | null> => {
  const lookupHash = await createCapabilityLookupHash(
    capability,
    env.APP_HMAC_PEPPER
  );
  return getInboxTicket(env, userId, lookupHash);
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

export type AssessmentSession = {
  id: string;
  version: string;
  status: string;
  currentIndex: number;
  totalQuestions: number;
  answers: Record<string, number>;
  attemptId: string | null;
  startedAt: number;
  updatedAt: number;
  expiresAt: number | null;
};

export const startAssessmentSession = async (
  userId: string,
  version: string,
  totalQuestions: number,
  attemptId: string,
  env: Environment
): Promise<void> => {
  await doFetch(env, userId, "/assessment/start", {
    method: "POST",
    body: JSON.stringify({ version, totalQuestions, attemptId }),
  });
};

export const getAssessmentSession = async (
  userId: string,
  env: Environment
): Promise<AssessmentSession | null> => {
  const body = await doFetch<{ session: AssessmentSession | null }>(
    env,
    userId,
    "/assessment/session"
  );
  return body.session;
};

export const saveAssessmentAnswer = async (
  userId: string,
  questionId: string,
  answerValue: number,
  env: Environment,
  currentIndex?: number
): Promise<void> => {
  await doFetch(env, userId, "/assessment/answer", {
    method: "POST",
    body: JSON.stringify({ questionId, answerValue, currentIndex }),
  });
};

export const setAssessmentCurrentIndex = async (
  userId: string,
  currentIndex: number,
  env: Environment
): Promise<void> => {
  await doFetch(env, userId, "/assessment/set-current-index", {
    method: "POST",
    body: JSON.stringify({ currentIndex }),
  });
};

export const completeAssessmentSession = async (
  userId: string,
  env: Environment
): Promise<void> => {
  await doFetch(env, userId, "/assessment/complete", { method: "POST" });
};

export const cancelAssessmentSession = async (
  userId: string,
  env: Environment
): Promise<void> => {
  await doFetch(env, userId, "/assessment/cancel", { method: "POST" });
};

export const resetAssessmentSession = async (
  userId: string,
  env: Environment
): Promise<void> => {
  await stub(env, userId).fetch("https://user-state/assessment/reset", {
    method: "DELETE",
  });
};
