import type { Environment } from "../../contracts/runtime";
import { encryptDisplayName } from "./ticketing-service";
import {
  buildDeliveryHeader,
  buildDeliveryHeaderLine,
  buildDeliveryHeaderMarkdown,
} from "./contact-display";
import { setContactLabel as setLabelInDo } from "../../storage/user-state-client";

export const NICKNAME_MAX_COUNT = 200;
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

export const lookupContactLabel = (
  labels: Record<string, string> | undefined,
  contactTag: string
): string | undefined => labels?.[contactTag];

export const getContactLabelForSender = (
  labels: Record<string, string> | undefined,
  contactTag: string
): string | undefined => lookupContactLabel(labels, contactTag);

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
  nickname: string,
  existingLabels: Record<string, string>
): Promise<void> => {
  const isUpdate = contactTag in existingLabels;
  if (
    nickname &&
    !isUpdate &&
    Object.keys(existingLabels).length >= NICKNAME_MAX_COUNT
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
