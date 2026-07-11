import type { CipherEnvelope } from "../../types";
import { bytesToBase64Url, base64UrlToBytes } from "./base64url.ts";
import { deriveAesGcmKey, getHkdfKeyMaterial } from "./hkdf.ts";
import { hmacBase64Url } from "./hmac.ts";

/**
 * Product ticketing helpers: Telegram chat sealing, scoped payloads,
 * display names, dedupe/block HMACs, and opaque ids.
 */
const GCM_IV_BYTES = 12;
const SENDER_ALIAS_BITS = 128;
const MASTER_KID = "master:v1";

const AES_INFO = new TextEncoder().encode("nekonymous:aes:v1");
const CHAT_INFO = new TextEncoder().encode("nekonymous:chat:v1");
const HMAC_INFO = new TextEncoder().encode("nekonymous:tg-user:v1");
const DEDUPE_INFO = "dedupe:v1:";
const BLOCK_INFO = "block:v1:";

const textEncoder = new TextEncoder();

const sealWithKey = async (
  aesKey: CryptoKey,
  plaintext: string,
  kid: string
): Promise<CipherEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(plaintext)
  );

  return {
    v: 1,
    kid,
    iv: bytesToBase64Url(iv),
    ct: bytesToBase64Url(new Uint8Array(encrypted)),
  };
};

const openEnvelope = async (
  envelope: CipherEnvelope,
  aesKey: CryptoKey
): Promise<string> => {
  const iv = base64UrlToBytes(envelope.iv);
  const ciphertext = base64UrlToBytes(envelope.ct);
  if (iv.length !== GCM_IV_BYTES || ciphertext.length === 0) {
    throw new Error("Invalid ciphertext envelope");
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
};

const envelopeToWire = (envelope: CipherEnvelope): string =>
  JSON.stringify(envelope);

const wireToEnvelope = (wire: string): CipherEnvelope => {
  const parsed = JSON.parse(wire) as CipherEnvelope;
  if (parsed?.v !== 1 || !parsed.kid || !parsed.iv || !parsed.ct) {
    throw new Error("Invalid ciphertext wire format");
  }
  return parsed;
};

const masterKey = (appMasterKey: string): Promise<CryptoKey> =>
  deriveAesGcmKey(appMasterKey, new Uint8Array(0), CHAT_INFO);

export const hmacTelegramUserId = async (
  pepper: string,
  telegramUserId: number
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(`${HMAC_INFO.length}:${telegramUserId}`)
  );

  return bytesToBase64Url(new Uint8Array(signature));
};

export const encryptTelegramChatId = async (
  chatId: number,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await masterKey(appMasterKey);
  return envelopeToWire(
    await sealWithKey(aesKey, chatId.toString(), MASTER_KID)
  );
};

export const decryptTelegramChatId = async (
  ciphertext: string,
  appMasterKey: string
): Promise<number> => {
  const aesKey = await masterKey(appMasterKey);
  const plaintext = await openEnvelope(wireToEnvelope(ciphertext), aesKey);
  const chatId = Number(plaintext);
  if (!Number.isSafeInteger(chatId)) {
    throw new Error("Invalid chat id");
  }
  return chatId;
};

export const generateOpaqueId = (bytes = 16): string =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));

export const createMessageDedupeKey = (
  lookupSecret: string,
  senderHash: string,
  recipientHash: string,
  telegramMessageId: number
): Promise<string> =>
  hmacBase64Url(
    lookupSecret,
    `${DEDUPE_INFO}${senderHash}:${recipientHash}:${telegramMessageId}`
  );

export const createBlockHash = (
  lookupSecret: string,
  ownerHash: string,
  peerHash: string
): Promise<string> =>
  hmacBase64Url(lookupSecret, `${BLOCK_INFO}${ownerHash}:${peerHash}`);

const scopedPayloadSalt = (scopeId: string): Uint8Array =>
  base64UrlToBytes(scopeId);

const deriveScopedPayloadKey = (
  scopeId: string,
  appMasterKey: string
): Promise<CryptoKey> =>
  deriveAesGcmKey(appMasterKey, scopedPayloadSalt(scopeId), AES_INFO);

const encryptScopedPayload = async (
  scopeId: string,
  payload: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await deriveScopedPayloadKey(scopeId, appMasterKey);
  return envelopeToWire(
    await sealWithKey(aesKey, payload, `payload:${scopeId.slice(0, 8)}`)
  );
};

const decryptScopedPayload = async (
  scopeId: string,
  ciphertext: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await deriveScopedPayloadKey(scopeId, appMasterKey);
  return openEnvelope(wireToEnvelope(ciphertext), aesKey);
};

/** Opaque per-recipient sender handle for contact labels. */
export const getSenderAlias = async (
  recipientUserId: string,
  senderUserId: string,
  appMasterKey: string
): Promise<string> => {
  const material = await getHkdfKeyMaterial(appMasterKey);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textEncoder.encode(recipientUserId),
      info: textEncoder.encode(`nekonymous:label:v1:${senderUserId}`),
    },
    material,
    SENDER_ALIAS_BITS
  );
  return bytesToBase64Url(new Uint8Array(bits));
};

export const encryptMatchIntro = async (
  requestId: string,
  intro: string,
  appMasterKey: string
): Promise<string> => encryptScopedPayload(requestId, intro, appMasterKey);

export const decryptMatchIntro = async (
  requestId: string,
  ciphertext: string,
  appMasterKey: string
): Promise<string> => decryptScopedPayload(requestId, ciphertext, appMasterKey);

export const encryptDisplayName = async (
  name: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await masterKey(appMasterKey);
  return envelopeToWire(await sealWithKey(aesKey, name, MASTER_KID));
};

export const decryptDisplayName = async (
  ciphertext: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await masterKey(appMasterKey);
  return openEnvelope(wireToEnvelope(ciphertext), aesKey);
};
