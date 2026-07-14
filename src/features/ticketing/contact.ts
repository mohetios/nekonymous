import type { Environment } from "../../contracts/runtime";
import {
  decryptDisplayName,
  encryptDisplayName,
} from "./ticketing-service";
import {
  buildDeliveryHeader,
  buildDeliveryHeaderLine,
  buildDeliveryHeaderMarkdown,
} from "./contact-display";
import {
  getContactLabelCiphertext,
  setContactLabel as setLabelInDo,
} from "../../storage/user-state-client";

export const NICKNAME_MAX_LENGTH = 32;
export const NICKNAME_DRAFT_TTL = 10 * 60 * 1000;

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

  return [...cleaned].slice(0, NICKNAME_MAX_LENGTH).join("");
};

/** Decrypt a single contact nickname; never bulk-loads all labels. */
export const getContactLabel = async (
  env: Environment,
  recipientUserId: string,
  contactTag: string
): Promise<string | undefined> => {
  const ciphertext = await getContactLabelCiphertext(
    env,
    recipientUserId,
    contactTag
  );
  if (!ciphertext) {
    return undefined;
  }
  try {
    return await decryptDisplayName(ciphertext, env.APP_MASTER_KEY);
  } catch {
    return undefined;
  }
};

export class ContactLabelLimitError extends Error {
  constructor() {
    super("Contact label limit reached");
    this.name = "ContactLabelLimitError";
  }
}

export const setContactLabel = async (
  env: Environment,
  recipientUserId: string,
  contactTag: string,
  nickname: string
): Promise<void> => {
  const nicknameCiphertext = nickname
    ? await encryptDisplayName(nickname, env.APP_MASTER_KEY)
    : null;

  try {
    await setLabelInDo(
      env,
      recipientUserId,
      contactTag,
      nicknameCiphertext
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("limit")) {
      throw new ContactLabelLimitError();
    }
    throw error;
  }
};
