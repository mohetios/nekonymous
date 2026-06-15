import type { Context } from "grammy";
import type { Environment, User } from "../types";
import { isReservedDisplayName } from "./constant";
import type { KVModel } from "./kv-storage";
import { listAllInboxEntries, purgeInbox } from "./inbox";
import { incrementStat } from "./logs";
import { scheduleWork } from "./worker";

const DISPLAY_NAME_MAX_CHARS = 64;
const LINK_ID_RE = /^[A-Za-z0-9_-]{20,24}$/;
const BOT_USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

const cleanBotUsername = (botUsername: string): string => {
  const cleaned = botUsername.trim().replace(/^@/, "");
  if (!BOT_USERNAME_RE.test(cleaned)) {
    throw new Error("Invalid BOT_USERNAME");
  }
  return cleaned;
};

export const buildUserDeepLink = (
  botUsername: string,
  userUUID?: string
): string => {
  const base = `https://t.me/${cleanBotUsername(botUsername)}?start`;
  return userUUID ? `${base}=${userUUID}` : base;
};

export const isUserLinkId = (value: string): boolean => LINK_ID_RE.test(value);

export const sanitizeDisplayName = (input: string): string | null => {
  const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned || isReservedDisplayName(cleaned)) {
    return null;
  }

  return [...cleaned].slice(0, DISPLAY_NAME_MAX_CHARS).join("");
};

export const publicDisplayName = (
  user: User | null | undefined,
  fallback = "کاربر"
): string => {
  const name = user?.userName?.trim();
  if (!name || name === "بدون نام!" || isReservedDisplayName(name)) {
    return fallback;
  }

  return name;
};

const initialDisplayName = (firstName: string | undefined): string => {
  if (!firstName) {
    return "بدون نام!";
  }

  return sanitizeDisplayName(firstName) ?? "کاربر";
};

const clearDraftsTargetingUser = async (
  userModel: KVModel<User>,
  targetUserId: number,
  staleLinkUuid: string
): Promise<void> => {
  const prefix = `${userModel.namespace}:`;
  const targetId = targetUserId.toString();
  const { keys } = await userModel.list();

  for (const key of keys) {
    if (!key.name.startsWith(prefix)) {
      continue;
    }

    const userId = key.name.slice(prefix.length);
    if (!userId || userId === targetId) {
      continue;
    }

    const record = await userModel.get(userId);
    const draft = record?.currentConversation;
    if (!draft) {
      continue;
    }

    if (draft.to === targetUserId || draft.linkUuid === staleLinkUuid) {
      await userModel.updateField(userId, "currentConversation", undefined);
    }
  }
};

export const deleteUserAccount = async (
  userId: number,
  user: User,
  userModel: KVModel<User>,
  userUUIDtoId: KVModel<string>,
  conversationModel: KVModel<string>,
  inbox: Environment["INBOX_DO"]
): Promise<void> => {
  const inboxEntries = await listAllInboxEntries(inbox, userId);
  const conversationIds = [
    ...new Set(inboxEntries.map((entry) => entry.conversationId)),
  ];

  await Promise.all([
    ...conversationIds.map((conversationId) =>
      conversationModel.remove(conversationId)
    ),
    clearDraftsTargetingUser(userModel, userId, user.userUUID),
  ]);

  await userUUIDtoId.remove(user.userUUID);
  await purgeInbox(inbox, userId);
  await userModel.remove(userId.toString());
};

const generateUserLinkId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const ensureUser = async (
  userId: number,
  firstName: string | undefined,
  userModel: KVModel<User>,
  userUUIDtoId: KVModel<string>,
  statsModel: KVModel<number>,
  ctx?: Context
): Promise<User> => {
  const existing = await userModel.get(userId.toString());
  if (existing) {
    return existing;
  }

  const userUUID = generateUserLinkId();
  const created: User = {
    userUUID,
    userName: initialDisplayName(firstName),
    blockList: [],
    currentConversation: {},
  };

  await userUUIDtoId.save(userUUID, userId.toString());
  await userModel.save(userId.toString(), created);
  await scheduleWork(ctx, incrementStat(statsModel, "newUser"));

  return created;
};
