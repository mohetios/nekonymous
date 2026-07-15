const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const base64UrlToBytes = (input: string): Uint8Array => {
  if (!input || !BASE64URL_RE.test(input)) {
    throw new Error("Invalid base64url input");
  }
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
};

export const randomBase64Url = (bytes: number): string =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
