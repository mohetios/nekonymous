const textEncoder = new TextEncoder();

let cachedHkdfKey: CryptoKey | null = null;
let cachedHkdfKeySource: string | null = null;

const importHkdfKey = (keyMaterial: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    textEncoder.encode(keyMaterial),
    "HKDF",
    false,
    ["deriveKey", "deriveBits"]
  );

export const getHkdfKeyMaterial = async (
  keyMaterial: string
): Promise<CryptoKey> => {
  if (cachedHkdfKey && cachedHkdfKeySource === keyMaterial) {
    return cachedHkdfKey;
  }

  cachedHkdfKey = await importHkdfKey(keyMaterial);
  cachedHkdfKeySource = keyMaterial;
  return cachedHkdfKey;
};

export const deriveAesGcmKey = async (
  keyMaterial: string,
  salt: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> =>
  crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info,
    },
    await getHkdfKeyMaterial(keyMaterial),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
