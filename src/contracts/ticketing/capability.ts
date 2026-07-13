import type { EncodedTicketCapability } from "../primitives";

export type TicketCapability = Readonly<{
  lookupNonce: Uint8Array;
  keySeed: Uint8Array;
}>;

export type { EncodedTicketCapability };
