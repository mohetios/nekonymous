/**
 * Crypto smoke tests against production modules.
 * Run: pnpm test:ticketing
 */

import {
  decryptMatchIntro,
  decryptTelegramChatId,
  encryptMatchIntro,
  encryptTelegramChatId,
  generateOpaqueId,
  hmacTelegramUserId,
} from "../src/ticketing/ticketing-service.ts";
import {
  createOwnerProofTag,
  createTicketHash,
  deriveTicketKey,
  randomTicketRef,
  routeAad,
} from "../src/ticketing/keys.ts";
import { encryptEnvelope, decryptEnvelope } from "../src/ticketing/envelope.ts";
import { constantTimeEqual } from "../src/ticketing/hmac.ts";

const appMasterKey = "test-app-master-key-local-32bytes!";
const pepper = "test-hmac-pepper-local-32bytes!!";
const sample = JSON.stringify({
  message_type: "text",
  message_text: "سلام",
  telegramMessageId: 1,
  createdAt: Date.now(),
});

const scopedPayloadId = generateOpaqueId(12);
const ciphertext = await encryptMatchIntro(
  scopedPayloadId,
  sample,
  appMasterKey
);
const decrypted = await decryptMatchIntro(
  scopedPayloadId,
  ciphertext,
  appMasterKey
);

if (decrypted !== sample) {
  console.error("Scoped payload envelope roundtrip failed");
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

const ticketRef = randomTicketRef();
const sealedTicketHash = await createTicketHash(pepper, ticketRef);
if (sealedTicketHash.includes(ticketRef)) {
  console.error("ticketRef should never be stored as raw lookup");
  process.exit(1);
}
const ownerProofTag = await createOwnerProofTag(
  pepper,
  hash,
  sealedTicketHash
);
const ownerProofCandidate = await createOwnerProofTag(
  pepper,
  hash,
  sealedTicketHash
);
const wrongActorHash = await hmacTelegramUserId(pepper, 43);
const wrongOwnerProof = await createOwnerProofTag(
  pepper,
  wrongActorHash,
  sealedTicketHash
);

if (!constantTimeEqual(ownerProofTag, ownerProofCandidate)) {
  console.error("Owner proof check failed");
  process.exit(1);
}
if (constantTimeEqual(ownerProofTag, wrongOwnerProof)) {
  console.error("Owner proof must reject wrong actor");
  process.exit(1);
}
if (ticketRef.length > 40) {
  console.error("ticketRef too long for callback_data safety");
  process.exit(1);
}

const ticketKey = await deriveTicketKey(appMasterKey, sealedTicketHash);
const route = {
  senderRouteTag: "sender",
  recipientRouteTag: "recipient",
  pairTag: "pair",
  reportSeeds: {
    senderAbuseSeed: "sender",
    pairAbuseSeed: "pair",
  },
  replyPolicy: {
    canReply: true,
    maxChars: 4096,
  },
  createdAt: Date.now(),
};
const sealedRoute = await encryptEnvelope(
  ticketKey,
  JSON.stringify(route),
  routeAad(sealedTicketHash)
);
const openedRoute = await decryptEnvelope<typeof route>(
  ticketKey,
  sealedRoute,
  routeAad(sealedTicketHash)
);

if (openedRoute.pairTag !== route.pairTag) {
  console.error("Sealed route roundtrip failed");
  process.exit(1);
}

console.log("Scoped payload envelope roundtrip OK");
console.log("Chat id roundtrip OK");
console.log("HMAC hash OK");
console.log("Sealed ticket route roundtrip OK");
console.log(`scopedPayloadId length: ${scopedPayloadId.length}`);
console.log(`ticketRef length: ${ticketRef.length}`);
