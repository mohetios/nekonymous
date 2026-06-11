const CONVERSATION_ID_INFO = new TextEncoder().encode("nekonymous:conversation");

/**
 * Converts a Uint8Array to a Base64 string.
 */
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Converts a Base64 string to a Uint8Array.
 */
const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
};

const sha256 = async (data: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", data));

/**
 * Derives fixed-length key material from a ticket and APP_SECURE_KEY.
 */
const deriveKeyMaterial = async (
  ticketId: string,
  appSecureKey: string
): Promise<Uint8Array> => {
  const ticketBytes = base64ToBytes(ticketId);
  const appKeyBytes = new TextEncoder().encode(appSecureKey);
  return sha256(concatBytes(ticketBytes, appKeyBytes));
};

/**
 * Derives the KV conversation ID from the ticket ID.
 */
export const getConversationId = async (
  ticketId: string,
  appSecureKey: string
): Promise<string> => {
  const keyMaterial = await deriveKeyMaterial(ticketId, appSecureKey);
  const conversationBytes = await sha256(
    concatBytes(keyMaterial, CONVERSATION_ID_INFO)
  );
  return bytesToBase64(conversationBytes);
};

/**
 * Generates a unique ticket ID for use in encryption.
 */
export const generateTicketId = async (
  appSecureKey: string
): Promise<string> => {
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  const appKeyBytes = new TextEncoder().encode(appSecureKey);
  const keyMaterial = await sha256(concatBytes(entropy, appKeyBytes));
  return bytesToBase64(keyMaterial);
};

/**
 * Imports key material as an AES-GCM-256 CryptoKey.
 */
const deriveAESKey = async (keyMaterial: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

/**
 * Encrypts the conversation payload using AES-GCM.
 */
export const encryptedPayload = async (
  ticketId: string,
  payload: string,
  appSecureKey: string
): Promise<string> => {
  const keyMaterial = await deriveKeyMaterial(ticketId, appSecureKey);
  const aesKey = await deriveAESKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(payload);

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data
  );

  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encryptedData))}`;
};

/**
 * Decrypts the conversation payload using AES-GCM.
 */
export const decryptPayload = async (
  ticketId: string,
  encryptedPayload: string,
  appSecureKey: string
): Promise<string> => {
  const keyMaterial = await deriveKeyMaterial(ticketId, appSecureKey);
  const [ivBase64, dataBase64] = encryptedPayload.split(":");
  const iv = base64ToBytes(ivBase64);
  const encryptedBytes = base64ToBytes(dataBase64);
  const aesKey = await deriveAESKey(keyMaterial);

  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedBytes
  );

  return new TextDecoder().decode(decryptedData);
};
