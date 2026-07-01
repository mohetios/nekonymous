import type { Environment, InboxPointer, UserDraft } from "../types";
import type {
  AssessmentSessionStatus,
  InboxPointerTransitionStatus,
} from "../status";

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

export const claimProcessedEvent = async (
  env: Environment,
  eventKey: string,
  leaseMs?: number
): Promise<"acquired" | "processing" | "done"> => {
  const body = await doFetch<{ state: "acquired" | "processing" | "done" }>(
    env,
    "__webhook_events__",
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
  await doFetch(env, "__webhook_events__", "/processed-events/complete", {
    method: "POST",
    body: JSON.stringify({ eventKey }),
  });
};

export const failProcessedEvent = async (
  env: Environment,
  eventKey: string
): Promise<void> => {
  await doFetch(env, "__webhook_events__", "/processed-events/fail", {
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
): Promise<void> => {
  await stub(env, userId).fetch("https://user-state/purge", {
    method: "DELETE",
  });
};

export type AssessmentSession = {
  id: string;
  version: string;
  status: AssessmentSessionStatus;
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
