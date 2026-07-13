import { base64UrlToBytes } from "./base64url.ts";
import { getHkdfKeyMaterial } from "./hkdf.ts";
import { hmacBytesBase64Url } from "./hmac.ts";
import type { TicketCapability } from "../../contracts/ticketing/capability";

const TICKET_LOOKUP_DOMAIN = "nekonymous:ticket:lookup";
const TICKET_OWNER_DOMAIN = "nekonymous:ticket:owner";
const UNREAD_INBOX_DEDUPE_DOMAIN = "nekonymous:inbox:dedupe";
const TICKET_ROOT_INFO = new TextEncoder().encode("nekonymous:ticket:root");
const TICKET_ROUTE_INFO = new TextEncoder().encode("nekonymous:ticket:route");
const TICKET_PAYLOAD_INFO = new TextEncoder().encode(
  "nekonymous:ticket:payload"
);
const TICKET_META_INFO = new TextEncoder().encode("nekonymous:ticket:meta");
const EMPTY_SALT = new Uint8Array(0);
const textEncoder = new TextEncoder();

export type TicketKeys = {
  routeKey: CryptoKey;
  payloadKey: CryptoKey;
  metaKey: CryptoKey;
};

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const uint32be = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
};

const canonicalInput = (
  domain: string,
  fields: Array<string | Uint8Array>
): Uint8Array =>
  concatBytes([
    textEncoder.encode(domain),
    new Uint8Array([0]),
    ...fields.flatMap((field) => {
      const bytes =
        typeof field === "string" ? textEncoder.encode(field) : field;
      return [uint32be(bytes.length), bytes];
    }),
  ]);

export const createTicketHash = (
  hmacKey: string,
  capability: TicketCapability
): Promise<string> =>
  hmacBytesBase64Url(
    hmacKey,
    concatBytes([textEncoder.encode(TICKET_LOOKUP_DOMAIN), capability.lookupNonce])
  );

export const createOwnerProofTag = (
  hmacKey: string,
  actorHash: string,
  currentInternalAccountId: string,
  ticketHash: string
): Promise<string> =>
  hmacBytesBase64Url(
    hmacKey,
    canonicalInput(TICKET_OWNER_DOMAIN, [
      actorHash,
      currentInternalAccountId,
      ticketHash,
    ])
  );

export const createUnreadInboxDedupeTag = (
  hmacKey: string,
  ticketHash: string
): Promise<string> =>
  hmacBytesBase64Url(
    hmacKey,
    concatBytes([textEncoder.encode(UNREAD_INBOX_DEDUPE_DOMAIN), textEncoder.encode(ticketHash)])
  );

const deriveTicketRootBytes = async (
  masterKey: string,
  ticketHash: string,
  keySeed: Uint8Array
): Promise<Uint8Array> => {
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: concatBytes([base64UrlToBytes(ticketHash), keySeed]),
      info: TICKET_ROOT_INFO,
    },
    await getHkdfKeyMaterial(masterKey),
    256
  );
  return new Uint8Array(bits);
};

const deriveAesGcmKeyFromRoot = async (
  rootBytes: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> => {
  const rootMaterial = await crypto.subtle.importKey(
    "raw",
    rootBytes,
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: EMPTY_SALT,
      info,
    },
    rootMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const deriveTicketKeys = async (
  masterKey: string,
  ticketHash: string,
  capability: TicketCapability
): Promise<TicketKeys> => {
  const rootBytes = await deriveTicketRootBytes(
    masterKey,
    ticketHash,
    capability.keySeed
  );
  const [routeKey, payloadKey, metaKey] = await Promise.all([
    deriveAesGcmKeyFromRoot(rootBytes, TICKET_ROUTE_INFO),
    deriveAesGcmKeyFromRoot(rootBytes, TICKET_PAYLOAD_INFO),
    deriveAesGcmKeyFromRoot(rootBytes, TICKET_META_INFO),
  ]);
  return { routeKey, payloadKey, metaKey };
};

export const routeAad = (ticketHash: string): string =>
  `nekonymous:ticket:${ticketHash}:route`;

export const payloadAad = (ticketHash: string): string =>
  `nekonymous:ticket:${ticketHash}:payload`;

export const metaAad = (ticketHash: string): string =>
  `nekonymous:ticket:${ticketHash}:meta`;
