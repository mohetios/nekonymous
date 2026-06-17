import type { Environment } from "../types";
import { encryptDisplayName } from "../crypto/crypto-service";
import {
  buildDeliveryHeader,
  buildDeliveryHeaderLine,
  buildDeliveryHeaderMarkdown,
} from "./contact-display";
import { setContactLabel as setLabelInDo } from "../storage/user-state-client";

const CONTACT_LABELS_MAX = 200;
const NICKNAME_MAX_CHARS = 32;

export {
  buildDeliveryHeaderLine,
  buildDeliveryHeader,
  buildDeliveryHeaderMarkdown,
};

export const sanitizeNickname = (input: string): string => {
  const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "−" || cleaned === "حذف") {
    return "";
  }

  return [...cleaned].slice(0, NICKNAME_MAX_CHARS).join("");
};

export const lookupContactLabel = (
  labels: Record<string, string> | undefined,
  alias: string
): string | undefined => labels?.[alias];

export const getContactLabelForSender = (
  _recipientUserId: string,
  _senderUserId: string,
  labels: Record<string, string> | undefined,
  senderAlias: string
): string | undefined => lookupContactLabel(labels, senderAlias);

export class ContactLabelLimitError extends Error {
  constructor() {
    super("Contact label limit reached");
    this.name = "ContactLabelLimitError";
  }
}

export const setContactLabel = async (
  env: Environment,
  recipientUserId: string,
  senderAlias: string,
  targetUserId: string,
  nickname: string,
  existingLabels: Record<string, string>
): Promise<void> => {
  const isUpdate = senderAlias in existingLabels;
  if (
    nickname &&
    !isUpdate &&
    Object.keys(existingLabels).length >= CONTACT_LABELS_MAX
  ) {
    throw new ContactLabelLimitError();
  }

  const nicknameCiphertext = nickname
    ? await encryptDisplayName(nickname, env.APP_MASTER_KEY)
    : null;

  try {
    await setLabelInDo(
      env,
      recipientUserId,
      senderAlias,
      targetUserId,
      nicknameCiphertext
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("limit")) {
      throw new ContactLabelLimitError();
    }
    throw error;
  }
};
