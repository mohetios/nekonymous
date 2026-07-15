import {
  decryptScopedPayload,
  encryptScopedPayload,
} from "../../ticketing/ticketing-service";
import {
  deleteProfileSessionWire,
  getActiveProfileSessionWire,
  startProfileSessionWire,
  updateProfileSessionWire,
} from "../../../storage/user-state-client";
import type { Environment } from "../../../contracts/runtime";
import {
  PROFILE_QUESTION_COUNT,
  PROFILE_SCHEMA_VERSION,
  PROFILE_SESSION_ID,
} from "./constants.ts";
import { PROFILE_QUESTIONS } from "./question-bank.ts";
import { countAnsweredQuestions, hasCompleteAnswers } from "./validation.ts";
import type { ProfileAnswers, ProfileSession, ProfileSessionStatus, ConversationIntent } from "../../../contracts/conversation/profile";

const sessionScope = (userId: string): string => `profile-session:${userId}`;

const encryptAnswers = async (
  userId: string,
  answers: ProfileAnswers,
  appMasterKey: string
): Promise<string> =>
  encryptScopedPayload(
    sessionScope(userId),
    JSON.stringify(answers),
    appMasterKey
  );

const decryptAnswers = async (
  userId: string,
  answersEnc: string,
  appMasterKey: string
): Promise<ProfileAnswers> => {
  const plaintext = await decryptScopedPayload(
    sessionScope(userId),
    answersEnc,
    appMasterKey
  );
  return JSON.parse(plaintext) as ProfileAnswers;
};

const toSession = async (
  userId: string,
  wire: NonNullable<Awaited<ReturnType<typeof getActiveProfileSessionWire>>>,
  appMasterKey: string
): Promise<ProfileSession> => ({
  id: wire.id,
  version: PROFILE_SCHEMA_VERSION,
  status: wire.status as ProfileSessionStatus,
  currentIndex: wire.currentIndex,
  totalQuestions: wire.totalQuestions,
  answers: await decryptAnswers(userId, wire.answersEnc, appMasterKey),
  startedAt: wire.startedAt,
  updatedAt: wire.updatedAt,
  expiresAt: wire.expiresAt,
});

export const getProfileSession = async (
  env: Environment,
  userId: string
): Promise<ProfileSession | null> => {
  const wire = await getActiveProfileSessionWire(env, userId);
  if (!wire) {
    return null;
  }
  return toSession(userId, wire, env.APP_MASTER_KEY);
};

export const startProfileSession = async (
  env: Environment,
  userId: string
): Promise<ProfileSession> => {
  const emptyAnswers: ProfileAnswers = {};
  const answersEnc = await encryptAnswers(userId, emptyAnswers, env.APP_MASTER_KEY);
  await startProfileSessionWire(env, userId, {
    version: PROFILE_SCHEMA_VERSION,
    totalQuestions: PROFILE_QUESTION_COUNT,
    answersEnc,
  });

  const session = await getProfileSession(env, userId);
  if (!session) {
    throw new Error("Failed to start profile session");
  }
  return session;
};

export const saveProfileAnswer = async (
  env: Environment,
  userId: string,
  questionId: string,
  value: number | ConversationIntent,
  currentIndex?: number
): Promise<ProfileSession> => {
  const session = await getProfileSession(env, userId);
  if (!session) {
    throw new Error("No active profile session");
  }

  const answers = { ...session.answers, [questionId]: value };
  const nextIndex =
    currentIndex !== undefined
      ? currentIndex + 1
      : Math.min(session.currentIndex + 1, PROFILE_QUESTION_COUNT);
  const status: ProfileSessionStatus = hasCompleteAnswers(answers)
    ? "ready_to_submit"
    : "active";
  const answersEnc = await encryptAnswers(userId, answers, env.APP_MASTER_KEY);

  await updateProfileSessionWire(env, userId, {
    answersEnc,
    currentIndex: nextIndex,
    status,
  });

  const updated = await getProfileSession(env, userId);
  if (!updated) {
    throw new Error("Profile session missing after save");
  }
  return updated;
};

export const setProfileCurrentIndex = async (
  env: Environment,
  userId: string,
  currentIndex: number
): Promise<void> => {
  const session = await getProfileSession(env, userId);
  if (!session) {
    throw new Error("No active profile session");
  }

  const answersEnc = await encryptAnswers(
    userId,
    session.answers,
    env.APP_MASTER_KEY
  );
  await updateProfileSessionWire(env, userId, {
    answersEnc,
    currentIndex: Math.max(0, Math.min(currentIndex, PROFILE_QUESTION_COUNT - 1)),
    status: session.status,
  });
};

export const clearProfileSession = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await deleteProfileSessionWire(env, userId);
};

export const getProfileSessionProgress = (
  session: ProfileSession
): { answered: number; total: number } => ({
  answered: countAnsweredQuestions(session.answers),
  total: PROFILE_QUESTIONS.length,
});

export const profileSessionIsReady = (session: ProfileSession): boolean =>
  session.status === "ready_to_submit" || hasCompleteAnswers(session.answers);

export const PROFILE_SESSION_WIRE_ID = PROFILE_SESSION_ID;
