/**
 * Quick local roundtrip test for ticket encryption (Web Crypto).
 * Run: node tools/verify-crypto.mjs
 */

const CONVERSATION_ID_INFO = new TextEncoder().encode("nekonymous:conversation");

const bytesToBase64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const concatBytes = (...parts) => {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const sha256 = async (data) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", data));

const deriveKeyMaterial = async (ticketId, appSecureKey) => {
  const ticketBytes = base64ToBytes(ticketId);
  const appKeyBytes = new TextEncoder().encode(appSecureKey);
  return sha256(concatBytes(ticketBytes, appKeyBytes));
};

const generateTicketId = async (appSecureKey) => {
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  const appKeyBytes = new TextEncoder().encode(appSecureKey);
  const keyMaterial = await sha256(concatBytes(entropy, appKeyBytes));
  return bytesToBase64(keyMaterial);
};

const getConversationId = async (ticketId, appSecureKey) => {
  const keyMaterial = await deriveKeyMaterial(ticketId, appSecureKey);
  const conversationBytes = await sha256(
    concatBytes(keyMaterial, CONVERSATION_ID_INFO)
  );
  return bytesToBase64(conversationBytes);
};

const encryptedPayload = async (ticketId, payload, appSecureKey) => {
  const keyMaterial = await deriveKeyMaterial(ticketId, appSecureKey);
  const aesKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(payload);
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data
  );
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encryptedData))}`;
};

const decryptPayload = async (ticketId, encrypted, appSecureKey) => {
  const keyMaterial = await deriveKeyMaterial(ticketId, appSecureKey);
  const [ivBase64, dataBase64] = encrypted.split(":");
  const iv = base64ToBytes(ivBase64);
  const encryptedBytes = base64ToBytes(dataBase64);
  const aesKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedBytes
  );
  return new TextDecoder().decode(decryptedData);
};

const appSecureKey = "test-app-secure-key-local";
const sample = JSON.stringify({
  connection: { from: 1, to: 2 },
  payload: { message_type: "text", message_text: "سلام" },
});

const ticketId = await generateTicketId(appSecureKey);
const conversationId = await getConversationId(ticketId, appSecureKey);
const encrypted = await encryptedPayload(ticketId, sample, appSecureKey);
const decrypted = await decryptPayload(ticketId, encrypted, appSecureKey);

if (decrypted !== sample) {
  console.error("Crypto roundtrip failed");
  process.exit(1);
}

console.log("Crypto roundtrip OK");
console.log(`ticketId length: ${ticketId.length}`);
console.log(`conversationId length: ${conversationId.length}`);
