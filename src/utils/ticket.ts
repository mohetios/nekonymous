const TICKET_ENTROPY_BYTES = 32;
const GCM_IV_BYTES = 12;

const AES_INFO = new TextEncoder().encode("nekonymous:aes:v1");
const CONVERSATION_INFO = new TextEncoder().encode(
  "nekonymous:conversation:v1"
);

const textEncoder = new TextEncoder();

/**
 * URL-safe Base64 without padding (Workers-compatible).
 */
const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64UrlToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const importHkdfKey = (appSecureKey: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    textEncoder.encode(appSecureKey),
    "HKDF",
    false,
    ["deriveKey", "deriveBits"]
  );

const hkdfParams = (ticketId: string, info: Uint8Array) => ({
  name: "HKDF" as const,
  hash: "SHA-256" as const,
  salt: base64UrlToBytes(ticketId),
  info,
});

/**
 * Opaque per-message ticket (256-bit random, base64url).
 * Stored in the inbox Durable Object; never encrypts data by itself.
 */
export const generateTicketId = (): string => {
  const entropy = crypto.getRandomValues(new Uint8Array(TICKET_ENTROPY_BYTES));
  return bytesToBase64Url(entropy);
};

/**
 * KV lookup key derived separately from the AES key (domain-separated HKDF).
 */
export const getConversationId = async (
  ticketId: string,
  appSecureKey: string
): Promise<string> => {
  const keyMaterial = await importHkdfKey(appSecureKey);
  const bits = await crypto.subtle.deriveBits(
    hkdfParams(ticketId, CONVERSATION_INFO),
    keyMaterial,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
};

const deriveAesKey = async (
  ticketId: string,
  appSecureKey: string
): Promise<CryptoKey> => {
  const keyMaterial = await importHkdfKey(appSecureKey);
  return crypto.subtle.deriveKey(
    hkdfParams(ticketId, AES_INFO),
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const parseCiphertext = (
  encryptedPayload: string
): { iv: Uint8Array; ciphertext: Uint8Array } | null => {
  const dot = encryptedPayload.indexOf(".");
  if (dot <= 0 || dot === encryptedPayload.length - 1) {
    return null;
  }

  const iv = base64UrlToBytes(encryptedPayload.slice(0, dot));
  const ciphertext = base64UrlToBytes(encryptedPayload.slice(dot + 1));

  if (iv.length !== GCM_IV_BYTES || ciphertext.length === 0) {
    return null;
  }

  return { iv, ciphertext };
};

/**
 * Encrypts a conversation payload with AES-256-GCM (random 12-byte IV per call).
 * Wire format: `{iv_base64url}.{ciphertext_base64url}`
 */
export const encryptedPayload = async (
  ticketId: string,
  payload: string,
  appSecureKey: string
): Promise<string> => {
  const aesKey = await deriveAesKey(ticketId, appSecureKey);
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(payload)
  );

  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
};

/** Used by inbox delivery — decrypts a payload from `encryptedPayload`. */
export const decryptPayload = async (
  ticketId: string,
  encryptedPayload: string,
  appSecureKey: string
): Promise<string> => {
  const parsed = parseCiphertext(encryptedPayload);
  if (!parsed) {
    throw new Error("Invalid ciphertext format");
  }

  const aesKey = await deriveAesKey(ticketId, appSecureKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: parsed.iv },
    aesKey,
    parsed.ciphertext
  );

  return new TextDecoder().decode(decrypted);
};
