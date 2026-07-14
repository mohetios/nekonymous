import type { Base64Url, Brand, Ciphertext } from "./primitives";

export type CipherEnvelope = Readonly<{
  v: 1;
  kid: string;
  iv: Base64Url;
  ct: Base64Url;
}>;

export type SealedUnreadCapability = Brand<string, "SealedUnreadCapability">;

export type EncryptedTicketRoute = Ciphertext;
export type EncryptedTicketPayload = Ciphertext;
export type EncryptedTicketMetadata = Ciphertext;
