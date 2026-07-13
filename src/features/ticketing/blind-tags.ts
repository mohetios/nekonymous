import { hmacBytesBase64Url } from "./hmac.ts";

const textEncoder = new TextEncoder();

const CONTACT_DOMAIN = "nekonymous:contact";
const BLOCK_DOMAIN = "nekonymous:block";
const ABUSE_SUBJECT_DOMAIN = "nekonymous:abuse-subject";
const REPORT_EVENT_DOMAIN = "nekonymous:report-event";
const REPORTER_SUBJECT_DOMAIN = "nekonymous:reporter-subject";

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

const canonicalInput = (domain: string, fields: string[]): Uint8Array =>
  concatBytes([
    textEncoder.encode(domain),
    new Uint8Array([0]),
    ...fields.flatMap((field) => {
      const bytes = textEncoder.encode(field);
      return [uint32be(bytes.length), bytes];
    }),
  ]);

const deriveBlindTag = (
  pepper: string,
  domain: string,
  fields: string[]
): Promise<string> =>
  hmacBytesBase64Url(pepper, canonicalInput(domain, fields));

export const createContactTag = (
  pepper: string,
  recipientCurrentAccountId: string,
  senderCurrentAccountId: string
): Promise<string> =>
  deriveBlindTag(pepper, CONTACT_DOMAIN, [
    recipientCurrentAccountId,
    senderCurrentAccountId,
  ]);

export const createBlockTag = (
  pepper: string,
  recipientCurrentAccountId: string,
  senderStableActorTag: string
): Promise<string> =>
  deriveBlindTag(pepper, BLOCK_DOMAIN, [
    recipientCurrentAccountId,
    senderStableActorTag,
  ]);

export const createAbuseSubjectTag = (
  pepper: string,
  senderStableActorTag: string
): Promise<string> =>
  deriveBlindTag(pepper, ABUSE_SUBJECT_DOMAIN, [senderStableActorTag]);

export const createReportEventTag = (
  pepper: string,
  ticketHash: string,
  reporterStableActorTag: string
): Promise<string> =>
  deriveBlindTag(pepper, REPORT_EVENT_DOMAIN, [
    ticketHash,
    reporterStableActorTag,
  ]);

export const createReporterSubjectTag = (
  pepper: string,
  abuseSubjectTag: string,
  reporterStableActorTag: string
): Promise<string> =>
  deriveBlindTag(pepper, REPORTER_SUBJECT_DOMAIN, [
    abuseSubjectTag,
    reporterStableActorTag,
  ]);
