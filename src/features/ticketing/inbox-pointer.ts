import type { Environment, InboxPointer } from "../../types";
import { decryptEnvelope, encryptEnvelope } from "./envelope";
import {
  deriveTicketKey,
  inboxPointerAad,
} from "./keys";
import { isCallbackRef } from "../../bot/callback-data";

export const INBOX_RETENTION_DAYS = 30;
export const INBOX_RETENTION_MS = INBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export const createdBucketForTime = (time: number): number =>
  Math.floor(time / (15 * 60 * 1000));

export const inboxExpiresAt = (createdAt: number): number =>
  createdAt + INBOX_RETENTION_MS;

export const displayNumberForTicketHash = (ticketHash: string): string =>
  `NQ-${ticketHash.slice(0, 4).toUpperCase()}`;

export const sealInboxTicketRef = async (
  env: Environment,
  ticketHash: string,
  ticketRef: string
): Promise<string> => {
  const key = await deriveTicketKey(env.APP_MASTER_KEY, ticketHash);
  return encryptEnvelope(
    key,
    JSON.stringify({ ticketRef }),
    inboxPointerAad(ticketHash),
    "inbox-pointer:v1"
  );
};

export const openInboxTicketRef = async (
  env: Environment,
  pointer: InboxPointer
): Promise<string | null> => {
  try {
    const key = await deriveTicketKey(env.APP_MASTER_KEY, pointer.ticketHash);
    const opened = await decryptEnvelope<{ ticketRef: string }>(
      key,
      pointer.sealedTicketRef,
      inboxPointerAad(pointer.ticketHash)
    );
    return isCallbackRef(opened.ticketRef) ? opened.ticketRef : null;
  } catch {
    return null;
  }
};
