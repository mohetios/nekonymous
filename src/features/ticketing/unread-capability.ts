import { decryptEnvelopeText, encryptEnvelope } from "./envelope";
import { deriveAesGcmKey } from "./hkdf";

const UNREAD_CAPABILITY_INFO = new TextEncoder().encode(
  "nekonymous:inbox:capability"
);
const textEncoder = new TextEncoder();

const unreadCapabilityAad = (
  internalAccountId: string,
  itemId: string,
  dedupeTag: string
): string => `nekonymous:inbox:${internalAccountId}:${itemId}:${dedupeTag}`;

const unreadCapabilityKey = (
  appMasterKey: string,
  internalAccountId: string
): Promise<CryptoKey> =>
  deriveAesGcmKey(
    appMasterKey,
    textEncoder.encode(internalAccountId),
    UNREAD_CAPABILITY_INFO
  );

export const sealUnreadCapability = async (
  appMasterKey: string,
  internalAccountId: string,
  itemId: string,
  dedupeTag: string,
  encodedCapability: string
): Promise<string> => {
  const key = await unreadCapabilityKey(appMasterKey, internalAccountId);
  return encryptEnvelope(
    key,
    encodedCapability,
    unreadCapabilityAad(internalAccountId, itemId, dedupeTag),
    "unread-capability"
  );
};

export const openUnreadCapability = async (
  appMasterKey: string,
  internalAccountId: string,
  itemId: string,
  dedupeTag: string,
  sealedCapabilityEnc: string
): Promise<string> => {
  const key = await unreadCapabilityKey(appMasterKey, internalAccountId);
  return decryptEnvelopeText(
    key,
    sealedCapabilityEnc,
    unreadCapabilityAad(internalAccountId, itemId, dedupeTag)
  );
};
