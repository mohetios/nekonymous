import { base64UrlToBytes, bytesToBase64Url } from "./base64url.ts";
import type {
  EncodedTicketCapability,
  TicketCapability,
} from "../../contracts/ticketing/capability";
import { asEncodedTicketCapability } from "../../contracts/primitives.ts";
import { deriveHkdfBits } from "./hkdf.ts";

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const TICKET_CAPABILITY_NONCE_BYTES = 16;
const TICKET_CAPABILITY_KEY_SEED_BYTES = 16;
export const TICKET_CAPABILITY_BYTES =
  TICKET_CAPABILITY_NONCE_BYTES + TICKET_CAPABILITY_KEY_SEED_BYTES;
export const TICKET_CAPABILITY_CHARS = 43;
export const TICKET_CAPABILITY_PATTERN = `[A-Za-z0-9_-]{${TICKET_CAPABILITY_CHARS}}`;
const DEDUPE_CAPABILITY_INFO = new TextEncoder().encode(
  "nekonymous:ticket-capability-dedupe"
);

const hasNonZeroByte = (bytes: Uint8Array): boolean =>
  bytes.some((byte) => byte !== 0);

const randomNonZeroBytes = (size: number): Uint8Array => {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    if (hasNonZeroByte(bytes)) {
      return bytes;
    }
  }
};

const capabilityFromMaterial = (material: Uint8Array): TicketCapability => {
  if (material.length !== TICKET_CAPABILITY_BYTES) {
    throw new Error("Invalid ticket capability material length");
  }
  // Guarantee non-zero nonce/keySeed for deterministic material (HKDF collision
  // with all-zero is astronomically unlikely; still defense-in-depth).
  const bytes = new Uint8Array(material);
  if (!hasNonZeroByte(bytes.subarray(0, TICKET_CAPABILITY_NONCE_BYTES))) {
    bytes[0] = 1;
  }
  if (
    !hasNonZeroByte(
      bytes.subarray(
        TICKET_CAPABILITY_NONCE_BYTES,
        TICKET_CAPABILITY_BYTES
      )
    )
  ) {
    bytes[TICKET_CAPABILITY_NONCE_BYTES] = 1;
  }
  return {
    lookupNonce: bytes.slice(0, TICKET_CAPABILITY_NONCE_BYTES),
    keySeed: bytes.slice(TICKET_CAPABILITY_NONCE_BYTES),
  };
};

const capabilityBytes = (capability: TicketCapability): Uint8Array => {
  const bytes = new Uint8Array(TICKET_CAPABILITY_BYTES);
  bytes.set(capability.lookupNonce, 0);
  bytes.set(capability.keySeed, TICKET_CAPABILITY_NONCE_BYTES);
  return bytes;
};

const validateMaterial = (capability: TicketCapability): void => {
  if (
    capability.lookupNonce.length !== TICKET_CAPABILITY_NONCE_BYTES ||
    capability.keySeed.length !== TICKET_CAPABILITY_KEY_SEED_BYTES
  ) {
    throw new Error("Invalid ticket capability material length");
  }
  if (
    !hasNonZeroByte(capability.lookupNonce) ||
    !hasNonZeroByte(capability.keySeed)
  ) {
    throw new Error("Invalid empty ticket capability material");
  }
};

export const createTicketCapability = (): TicketCapability => ({
  lookupNonce: randomNonZeroBytes(TICKET_CAPABILITY_NONCE_BYTES),
  keySeed: randomNonZeroBytes(TICKET_CAPABILITY_KEY_SEED_BYTES),
});

/**
 * Stable capability for retry-safe ticket creation (e.g. conversation-request accept).
 * Same masterKey + dedupeKey → same ticketHash / unread dedupe.
 */
export const createDeterministicTicketCapability = async (
  masterKey: string,
  dedupeKey: string
): Promise<TicketCapability> => {
  const normalized = dedupeKey.trim();
  if (!normalized || normalized.length > 128) {
    throw new Error("Invalid ticket capability dedupe key");
  }
  const salt = new TextEncoder().encode(normalized);
  const bits = await deriveHkdfBits(
    masterKey,
    salt,
    DEDUPE_CAPABILITY_INFO,
    TICKET_CAPABILITY_BYTES * 8
  );
  return capabilityFromMaterial(new Uint8Array(bits));
};

export const encodeTicketCapability = (
  capability: TicketCapability
): EncodedTicketCapability => {
  validateMaterial(capability);
  const encoded = bytesToBase64Url(capabilityBytes(capability));
  if (encoded.length !== TICKET_CAPABILITY_CHARS) {
    throw new Error("Invalid encoded ticket capability length");
  }
  return asEncodedTicketCapability(encoded);
};

export const parseTicketCapability = (value: string): TicketCapability => {
  if (value.length !== TICKET_CAPABILITY_CHARS) {
    throw new Error("Invalid ticket capability length");
  }
  if (!BASE64URL_RE.test(value) || value.includes("=")) {
    throw new Error("Invalid ticket capability encoding");
  }

  const bytes = base64UrlToBytes(value);
  if (bytes.length !== TICKET_CAPABILITY_BYTES) {
    throw new Error("Invalid ticket capability byte length");
  }
  if (bytesToBase64Url(bytes) !== value) {
    throw new Error("Non-canonical ticket capability encoding");
  }

  const capability = {
    lookupNonce: bytes.slice(0, TICKET_CAPABILITY_NONCE_BYTES),
    keySeed: bytes.slice(TICKET_CAPABILITY_NONCE_BYTES),
  };
  validateMaterial(capability);
  return capability;
};

export const validateTicketCapability = (value: string): boolean => {
  try {
    parseTicketCapability(value);
    return true;
  } catch {
    return false;
  }
};
