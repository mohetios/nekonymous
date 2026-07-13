import type { CipherEnvelope } from "../../contracts/crypto";
import { decryptAesGcm, encryptAesGcm } from "./aes-gcm.ts";

const DEFAULT_KID = "sealed:v1";

const parseEnvelope = (wire: string): CipherEnvelope => {
  const parsed = JSON.parse(wire) as CipherEnvelope;
  if (parsed?.v !== 1 || !parsed.kid || !parsed.iv || !parsed.ct) {
    throw new Error("Invalid ciphertext envelope");
  }
  return parsed;
};

export const encryptEnvelope = async (
  key: CryptoKey,
  plaintextJson: string,
  aad: string,
  kid = DEFAULT_KID
): Promise<string> => {
  const encrypted = await encryptAesGcm(key, plaintextJson, aad);
  return JSON.stringify({
    v: 1,
    kid,
    iv: encrypted.iv,
    ct: encrypted.ct,
  } satisfies CipherEnvelope);
};

export const decryptEnvelopeText = async (
  key: CryptoKey,
  envelope: string,
  aad: string
): Promise<string> => {
  const parsed = parseEnvelope(envelope);
  return decryptAesGcm(
    key,
    {
      iv: parsed.iv,
      ct: parsed.ct,
    },
    aad
  );
};

export const decryptEnvelope = async <T>(
  key: CryptoKey,
  envelope: string,
  aad: string
): Promise<T> => JSON.parse(await decryptEnvelopeText(key, envelope, aad)) as T;
