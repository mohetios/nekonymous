/**
 * Generates a compact URL-safe ID for Telegram deep links (`?start=...`).
 * Uses 16 random bytes encoded as base64url (22 chars, no padding).
 */
export const generateUserLinkId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};
