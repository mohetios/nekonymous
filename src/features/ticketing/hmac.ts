import { bytesToBase64Url } from "./base64url.ts";

const textEncoder = new TextEncoder();

const importHmacKey = (key: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    textEncoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

export const hmacBytesBase64Url = async (
  key: string,
  input: Uint8Array
): Promise<string> => {
  const cryptoKey = await importHmacKey(key);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, input);
  return bytesToBase64Url(new Uint8Array(signature));
};

export const hmacBase64Url = async (
  key: string,
  input: string
): Promise<string> => hmacBytesBase64Url(key, textEncoder.encode(input));

export const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let i = 0; i < length; i++) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }

  return diff === 0;
};
