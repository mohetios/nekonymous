/**
 * Crypto + conversation parsing smoke tests.
 * Run: pnpm test:crypto
 */

const TICKET_ENTROPY_BYTES = 32;
const GCM_IV_BYTES = 12;
const AES_INFO = new TextEncoder().encode("nekonymous:aes:v1");
const CONVERSATION_INFO = new TextEncoder().encode(
  "nekonymous:conversation:v1"
);

const bytesToBase64Url = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64UrlToBytes = (input) => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const importHkdfKey = (appSecureKey) =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecureKey),
    "HKDF",
    false,
    ["deriveKey", "deriveBits"]
  );

const hkdfParams = (ticketId, info) => ({
  name: "HKDF",
  hash: "SHA-256",
  salt: base64UrlToBytes(ticketId),
  info,
});

const generateTicketId = () => {
  const entropy = crypto.getRandomValues(new Uint8Array(TICKET_ENTROPY_BYTES));
  return bytesToBase64Url(entropy);
};

const getConversationId = async (ticketId, appSecureKey) => {
  const keyMaterial = await importHkdfKey(appSecureKey);
  const bits = await crypto.subtle.deriveBits(
    hkdfParams(ticketId, CONVERSATION_INFO),
    keyMaterial,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
};

const deriveAesKey = async (ticketId, appSecureKey) => {
  const keyMaterial = await importHkdfKey(appSecureKey);
  return crypto.subtle.deriveKey(
    hkdfParams(ticketId, AES_INFO),
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptedPayload = async (ticketId, payload, appSecureKey) => {
  const aesKey = await deriveAesKey(ticketId, appSecureKey);
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(payload)
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
};

const decryptPayload = async (ticketId, encrypted, appSecureKey) => {
  const dot = encrypted.indexOf(".");
  const iv = base64UrlToBytes(encrypted.slice(0, dot));
  const ciphertext = base64UrlToBytes(encrypted.slice(dot + 1));
  const aesKey = await deriveAesKey(ticketId, appSecureKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
};

const toTelegramUserId = (value) => {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
};

const parseConversation = (raw) => {
  const data = JSON.parse(raw);
  const from = toTelegramUserId(data.connection?.from);
  const to = toTelegramUserId(data.connection?.to);
  if (from === null || to === null) return null;
  return { ...data, connection: { ...data.connection, from, to } };
};

const appSecureKey = "test-app-secure-key-local";
const sample = JSON.stringify({
  connection: { from: 111, to: "222222222" },
  payload: { message_type: "text", message_text: "سلام" },
});

const ticketId = generateTicketId();
const conversationId = await getConversationId(ticketId, appSecureKey);
const encrypted = await encryptedPayload(ticketId, sample, appSecureKey);
const decrypted = await decryptPayload(ticketId, encrypted, appSecureKey);

if (decrypted !== sample) {
  console.error("Crypto roundtrip failed");
  process.exit(1);
}

const parsed = parseConversation(decrypted);
if (!parsed || parsed.connection.to !== 222222222) {
  console.error("parseConversation string-ID test failed");
  process.exit(1);
}

console.log("Crypto roundtrip OK");
console.log("parseConversation string-ID OK");
console.log(`ticketId length: ${ticketId.length}`);
console.log(`conversationId length: ${conversationId.length}`);
