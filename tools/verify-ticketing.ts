/**
 * Crypto smoke tests against production modules.
 * Run: pnpm test:ticketing
 */

import {
  decryptScopedPayload,
  encryptScopedPayload,
  encryptTelegramChatId,
  decryptTelegramChatId,
  generateOpaqueId,
  hmacTelegramUserId,
} from "../src/features/ticketing/ticketing-service.ts";
import {
  createOwnerProofTag,
  createTicketHash,
  deriveTicketKeys,
  payloadAad,
  routeAad,
} from "../src/features/ticketing/keys.ts";
import { encryptEnvelope, decryptEnvelope } from "../src/features/ticketing/envelope.ts";
import { constantTimeEqual } from "../src/features/ticketing/hmac.ts";
import {
  createTicketCapability,
  encodeTicketCapability,
  parseTicketCapability,
  TICKET_CAPABILITY_CHARS,
  validateTicketCapability,
  type TicketCapability,
} from "../src/features/ticketing/ticket-capability.ts";
import {
  createAbuseSubjectTag,
  createBlockTag,
  createContactTag,
  createReporterSubjectTag,
  createReportEventTag,
} from "../src/features/ticketing/blind-tags.ts";
import { INBOX_CALLBACK } from "../src/bot/callback-data.ts";

const appMasterKey = "test-app-master-key-local-32bytes!";
const pepper = "test-hmac-pepper-local-32bytes!!";
const sample = JSON.stringify({
  message_type: "text",
  message_text: "سلام",
  telegramMessageId: 1,
  createdAt: Date.now(),
});

const randomNonZeroBytes = (size: number): Uint8Array => {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    if (bytes.some((byte) => byte !== 0)) {
      return bytes;
    }
  }
};

const scopedPayloadId = generateOpaqueId(12);
const ciphertext = await encryptScopedPayload(
  scopedPayloadId,
  sample,
  appMasterKey
);
const decrypted = await decryptScopedPayload(
  scopedPayloadId,
  ciphertext,
  appMasterKey
);

 if (decrypted !== sample) {
  console.error("Scoped payload envelope roundtrip failed");
  process.exit(1);
}

const profileSessionScope =
  "profile-session:v2:01932abc-def0-7890-abcd-ef1234567890";
const profileAnswers = "{}";
const profileCiphertext = await encryptScopedPayload(
  profileSessionScope,
  profileAnswers,
  appMasterKey
);
const profileDecrypted = await decryptScopedPayload(
  profileSessionScope,
  profileCiphertext,
  appMasterKey
);
if (profileDecrypted !== profileAnswers) {
  console.error("Profile session scope roundtrip failed");
  process.exit(1);
}

const chatCiphertext = await encryptTelegramChatId(123456789, appMasterKey);
const chatId = await decryptTelegramChatId(chatCiphertext, appMasterKey);
if (chatId !== 123456789) {
  console.error("Chat id roundtrip failed");
  process.exit(1);
}

const hash = await hmacTelegramUserId(pepper, 42);
if (!hash || hash.length < 16) {
  console.error("HMAC hash failed");
  process.exit(1);
}

const wrongActorHash = await hmacTelegramUserId(pepper, 43);
const capability = createTicketCapability();
const encodedCapability = encodeTicketCapability(capability);
if (encodedCapability.length !== TICKET_CAPABILITY_CHARS) {
  console.error("Ticket capability encoded length mismatch");
  process.exit(1);
}

const parsedCapability = parseTicketCapability(encodedCapability);
if (encodeTicketCapability(parsedCapability) !== encodedCapability) {
  console.error("Ticket capability canonical parse/encode failed");
  process.exit(1);
}

for (const invalidCapability of [
  "",
  "A".repeat(32),
  "A".repeat(44),
  `${encodedCapability}=`,
  `${encodedCapability}A`,
  encodedCapability.replace(/.$/, "="),
]) {
  if (validateTicketCapability(invalidCapability)) {
    console.error("Malformed ticket capability was accepted");
    process.exit(1);
  }
}

for (const callbackData of [
  INBOX_CALLBACK.reply(encodedCapability),
  INBOX_CALLBACK.block(encodedCapability),
  INBOX_CALLBACK.unblock(encodedCapability),
  INBOX_CALLBACK.report(encodedCapability),
  INBOX_CALLBACK.nickname(encodedCapability),
]) {
  if (Buffer.byteLength(callbackData, "utf8") > 64) {
    console.error(`callback_data too long: ${callbackData.length}`);
    process.exit(1);
  }
}

const ticketHash = await createTicketHash(pepper, capability);
const otherLookupHash = await createTicketHash(pepper, createTicketCapability());
if (ticketHash === otherLookupHash) {
  console.error("lookupNonce changes must change ticketHash");
  process.exit(1);
}

const changedKeySeedCapability = {
  lookupNonce: capability.lookupNonce,
  keySeed: randomNonZeroBytes(16),
} satisfies TicketCapability;
const sameLookupHash = await createTicketHash(pepper, changedKeySeedCapability);
if (sameLookupHash !== ticketHash) {
  console.error("keySeed must not change ticketHash");
  process.exit(1);
}

const route = {
  senderChatRoute: "sealed-chat-route",
  replyRouteTag: "reply-route",
  contactTag: "contact-tag",
  blockTag: "block-tag",
  abuseSubjectTag: "abuse-subject-tag",
  replyPolicy: {
    canReply: true,
    maxChars: 4096,
  },
};
if (new TextEncoder().encode(JSON.stringify(route)).length > 1024) {
  console.error("RouteCapsule must stay small");
  process.exit(1);
}
const keys = await deriveTicketKeys(appMasterKey, ticketHash, capability);
const sealedRoute = await encryptEnvelope(
  keys.routeKey,
  JSON.stringify(route),
  routeAad(ticketHash),
  "ticket-route"
);
const openedRoute = await decryptEnvelope<typeof route>(
  keys.routeKey,
  sealedRoute,
  routeAad(ticketHash)
);
if (openedRoute.blockTag !== route.blockTag) {
  console.error("Ticket route roundtrip failed");
  process.exit(1);
}

const contactTag = await createContactTag(pepper, "recipient-current", "sender-current");
if (contactTag !== await createContactTag(pepper, "recipient-current", "sender-current")) {
  console.error("contactTag must be stable for the same current pair");
  process.exit(1);
}
if (contactTag === await createContactTag(pepper, "other-recipient", "sender-current")) {
  console.error("contactTag must differ by recipient");
  process.exit(1);
}
if (contactTag === await createContactTag(pepper, "recipient-current", "sender-reset")) {
  console.error("contactTag must change after sender account rotation");
  process.exit(1);
}
const blockTag = await createBlockTag(pepper, "recipient-current", "sender-stable");
if (blockTag !== await createBlockTag(pepper, "recipient-current", "sender-stable")) {
  console.error("blockTag must survive sender account rotation");
  process.exit(1);
}
if (blockTag === await createBlockTag(pepper, "other-recipient", "sender-stable")) {
  console.error("blockTag must differ by recipient");
  process.exit(1);
}
const abuseSubjectTag = await createAbuseSubjectTag(pepper, "sender-stable");
if (abuseSubjectTag !== await createAbuseSubjectTag(pepper, "sender-stable")) {
  console.error("abuseSubjectTag must survive sender account rotation");
  process.exit(1);
}
const reportEventTag = await createReportEventTag(pepper, ticketHash, "reporter-stable");
const reporterSubjectTag = await createReporterSubjectTag(
  pepper,
  abuseSubjectTag,
  "reporter-stable"
);
if (
  new Set([
    contactTag,
    blockTag,
    abuseSubjectTag,
    reportEventTag,
    reporterSubjectTag,
  ]).size !== 5
) {
  console.error("blind tag domains must not be interchangeable");
  process.exit(1);
}
if (
  reporterSubjectTag ===
  await createReporterSubjectTag(pepper, "other-abuse-subject", "reporter-stable")
) {
  console.error("reporterSubjectTag must not join across abuse subjects");
  process.exit(1);
}

const wrongSeedKeys = await deriveTicketKeys(
  appMasterKey,
  ticketHash,
  changedKeySeedCapability
);
try {
  await decryptEnvelope<typeof route>(
    wrongSeedKeys.routeKey,
    sealedRoute,
    routeAad(ticketHash)
  );
  console.error("wrong keySeed must fail AES-GCM authentication");
  process.exit(1);
} catch {
  // expected
}

try {
  await decryptEnvelope<typeof route>(
    keys.payloadKey,
    sealedRoute,
    routeAad(ticketHash)
  );
  console.error("route/payload keys must be domain-separated");
  process.exit(1);
} catch {
  // expected
}

try {
  await decryptEnvelope<typeof route>(
    keys.routeKey,
    sealedRoute,
    payloadAad(ticketHash)
  );
  console.error("route/payload AAD must be domain-separated");
  process.exit(1);
} catch {
  // expected
}

const ownerProof = await createOwnerProofTag(
  pepper,
  hash,
  "account-current",
  ticketHash
);
const ownerProofCandidate = await createOwnerProofTag(
  pepper,
  hash,
  "account-current",
  ticketHash
);
const wrongActorProof = await createOwnerProofTag(
  pepper,
  wrongActorHash,
  "account-current",
  ticketHash
);
const oldAccountProof = await createOwnerProofTag(
  pepper,
  hash,
  "account-old",
  ticketHash
);
if (!constantTimeEqual(ownerProof, ownerProofCandidate)) {
  console.error("Owner proof check failed");
  process.exit(1);
}
if (
  constantTimeEqual(ownerProof, wrongActorProof) ||
  constantTimeEqual(ownerProof, oldAccountProof)
) {
  console.error("Owner proof must reject wrong actor/account");
  process.exit(1);
}

console.log("Scoped payload envelope roundtrip OK");
console.log("Chat id roundtrip OK");
console.log("HMAC hash OK");
console.log("Ticket capability format OK");
console.log("Ticket lookup/key separation OK");
console.log("Owner proof account binding OK");
console.log(`scopedPayloadId length: ${scopedPayloadId.length}`);
console.log(`ticketCapability length: ${encodedCapability.length}`);
