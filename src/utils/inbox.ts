import type { Conversation, Environment, InboxMessage } from "../types";
import type { KVModel } from "./kv-storage";
import { parseConversation } from "./payload";
import { decryptPayload } from "./ticket";

export const generateInboxRef = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const inboxStub = (
  inbox: Environment["INBOX_DO"],
  userId: number | string
) => inbox.get(inbox.idFromName(userId.toString()));

export const listPendingInbox = async (
  inbox: Environment["INBOX_DO"],
  userId: number
): Promise<InboxMessage[]> => {
  const response = await inboxStub(inbox, userId).fetch("https://inbox/list");
  return response.json<InboxMessage[]>();
};

export const listAllInboxEntries = async (
  inbox: Environment["INBOX_DO"],
  userId: number
): Promise<InboxMessage[]> => {
  const response = await inboxStub(inbox, userId).fetch("https://inbox/all");
  if (!response.ok) {
    return [];
  }

  return response.json<InboxMessage[]>();
};

export type AddInboxResult = {
  ok: boolean;
  status: number;
  pendingCount?: number;
};

export const addInboxEntry = async (
  inbox: Environment["INBOX_DO"],
  recipientId: number,
  entry: Pick<InboxMessage, "ticketId" | "conversationId" | "ciphertext">
): Promise<AddInboxResult> => {
  const response = await inboxStub(inbox, recipientId).fetch("https://inbox/add", {
    method: "POST",
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const body = await response.json<{ pendingCount: number }>();
  return {
    ok: true,
    status: response.status,
    pendingCount: body.pendingCount,
  };
};

export const purgeInbox = async (
  inbox: Environment["INBOX_DO"],
  userId: number
): Promise<boolean> => {
  const response = await inboxStub(inbox, userId).fetch("https://inbox/purge", {
    method: "DELETE",
  });
  return response.ok;
};

export const markInboxDelivered = async (
  inbox: Environment["INBOX_DO"],
  userId: number,
  ref: string
): Promise<void> => {
  await inboxStub(inbox, userId).fetch("https://inbox/mark-delivered", {
    method: "POST",
    body: JSON.stringify({ ref }),
  });
};

export const decryptEntry = async (
  entry: InboxMessage,
  ciphertext: string,
  appSecureKey: string
): Promise<Conversation | null> => {
  try {
    const raw = await decryptPayload(entry.ticketId, ciphertext, appSecureKey);
    return parseConversation(raw);
  } catch {
    return null;
  }
};

export const loadConversationForAction = async (
  inbox: Environment["INBOX_DO"],
  recipientId: number,
  ref: string,
  appSecureKey: string,
  conversations: KVModel<string>
): Promise<{ entry: InboxMessage; conversation: Conversation } | null> => {
  const response = await inboxStub(inbox, recipientId).fetch(
    `https://inbox/entry?ref=${encodeURIComponent(ref)}`
  );
  if (!response.ok) {
    return null;
  }

  const entry = await response.json<InboxMessage>();
  const ciphertext = await conversations.getText(entry.conversationId);
  if (!ciphertext) {
    return null;
  }

  const conversation = await decryptEntry(entry, ciphertext, appSecureKey);
  return conversation ? { entry, conversation } : null;
};
