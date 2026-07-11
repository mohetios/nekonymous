import { base64UrlToBytes, randomBase64Url } from "./base64url.ts";
import { deriveAesGcmKey } from "./hkdf.ts";
import { hmacBase64Url } from "./hmac.ts";

const CALLBACK_REFERENCE_BYTES = 24;
const TICKET_KEY_INFO = new TextEncoder().encode("nekonymous:sealed-ticket:v1");

export const randomTicketRef = (): string =>
  randomBase64Url(CALLBACK_REFERENCE_BYTES);

export const createTicketHash = (
  hmacKey: string,
  ticketRef: string
): Promise<string> =>
  hmacBase64Url(hmacKey, `ticket-lookup:v1:${ticketRef}`);

export const createOwnerProofTag = (
  hmacKey: string,
  actorHash: string,
  ticketHash: string
): Promise<string> =>
  hmacBase64Url(hmacKey, `owner-proof:v1:${actorHash}:${ticketHash}`);

export const createPairTag = (
  hmacKey: string,
  firstRouteTag: string,
  secondRouteTag: string
): Promise<string> => {
  const [left, right] = [firstRouteTag, secondRouteTag].sort();
  return hmacBase64Url(hmacKey, `pair:v1:${left}:${right}`);
};

export const createReportTag = (
  hmacKey: string,
  seed: string
): Promise<string> => hmacBase64Url(hmacKey, `report:v1:${seed}`);

export const deriveTicketKey = (
  masterKey: string,
  ticketHash: string
): Promise<CryptoKey> =>
  deriveAesGcmKey(masterKey, base64UrlToBytes(ticketHash), TICKET_KEY_INFO);

export const routeAad = (ticketHash: string): string =>
  `sealed-ticket-route:v1:${ticketHash}`;

export const payloadAad = (ticketHash: string): string =>
  `sealed-ticket-payload:v1:${ticketHash}`;

export const inboxPointerAad = (ticketHash: string): string =>
  `sealed-inbox-pointer:v1:${ticketHash}`;
