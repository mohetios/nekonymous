import { bytesToBase64Url, base64UrlToBytes } from "./base64url.ts";

const GCM_IV_BYTES = 12;
const textEncoder = new TextEncoder();

export type AesGcmCiphertext = {
  iv: string;
  ct: string;
};

export const encryptAesGcm = async (
  key: CryptoKey,
  plaintext: string,
  aad: string
): Promise<AesGcmCiphertext> => {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textEncoder.encode(aad),
    },
    key,
    textEncoder.encode(plaintext)
  );

  return {
    iv: bytesToBase64Url(iv),
    ct: bytesToBase64Url(new Uint8Array(encrypted)),
  };
};

export const decryptAesGcm = async (
  key: CryptoKey,
  ciphertext: AesGcmCiphertext,
  aad: string
): Promise<string> => {
  const iv = base64UrlToBytes(ciphertext.iv);
  const ct = base64UrlToBytes(ciphertext.ct);
  if (iv.length !== GCM_IV_BYTES || ct.length === 0) {
    throw new Error("Invalid AES-GCM ciphertext");
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textEncoder.encode(aad),
    },
    key,
    ct
  );

  return new TextDecoder().decode(plaintext);
};
