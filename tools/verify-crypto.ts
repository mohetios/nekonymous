/**
 * Crypto smoke tests against production modules.
 * Run: pnpm test:crypto
 */

import {
  decryptMessagePayload,
  decryptTelegramChatId,
  encryptMessagePayload,
  encryptTelegramChatId,
  generateTicketId,
  hmacTelegramUserId,
} from "../src/services/crypto-service.ts";

const appMasterKey = "test-app-master-key-local-32bytes!";
const pepper = "test-hmac-pepper-local-32bytes!!";
const sample = JSON.stringify({
  message_type: "text",
  message_text: "سلام",
  telegramMessageId: 1,
  createdAt: Date.now(),
});

const ticketId = generateTicketId();
const ciphertext = await encryptMessagePayload(
  ticketId,
  sample,
  appMasterKey
);
const decrypted = await decryptMessagePayload(
  ticketId,
  ciphertext,
  appMasterKey
);

if (decrypted !== sample) {
  console.error("Crypto roundtrip failed");
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

console.log("Crypto roundtrip OK");
console.log("Chat id roundtrip OK");
console.log("HMAC hash OK");
console.log(`ticketId length: ${ticketId.length}`);
