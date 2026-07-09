import {
  CALLBACK_REF_RE,
  INBOX_CALLBACK,
  inboxCallbackQueryRegex,
  isCallbackRef,
} from "../src/utils/telegram-callbacks.ts";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const readSource = async (relativePath: string): Promise<string> =>
  import("node:fs/promises").then((fs) =>
    fs.readFile(new URL(relativePath, import.meta.url), "utf8")
  );

const callbackRef = "A".repeat(32);

// 1) callback ref contract stays strict and language-neutral.
assert(CALLBACK_REF_RE.test(callbackRef), "callback ref must accept 32-char base64url");
assert(isCallbackRef(callbackRef), "isCallbackRef must accept valid callback ref");
assert(!isCallbackRef("abc"), "isCallbackRef must reject short callback ref");
assert(!isCallbackRef("a".repeat(33)), "isCallbackRef must reject overlong callback ref");
assert(!isCallbackRef("!".repeat(32)), "isCallbackRef must reject non-base64url chars");

// 2) inbox callback_data values stay inside Telegram's 64-byte hard limit.
for (const callbackData of [
  INBOX_CALLBACK.open(callbackRef),
  INBOX_CALLBACK.reply(callbackRef),
  INBOX_CALLBACK.block(callbackRef),
  INBOX_CALLBACK.unblock(callbackRef),
  INBOX_CALLBACK.report(callbackRef),
  INBOX_CALLBACK.nickname(callbackRef),
]) {
  assert(
    Buffer.byteLength(callbackData, "utf8") <= 64,
    `callback_data must be <= 64 bytes: ${callbackData}`
  );
}

// 3) callback regexes match only the expected action prefix and ref shape.
assert(
  inboxCallbackQueryRegex("open").test(`o:${callbackRef}`),
  "open callback regex must match o:<ref>"
);
assert(
  !inboxCallbackQueryRegex("open").test(`r:${callbackRef}`),
  "open callback regex must reject other action prefixes"
);
assert(
  !inboxCallbackQueryRegex("report").test(`rp:short`),
  "report callback regex must reject invalid refs"
);

const [handlersSource, resolveSource, inboxSource] = await Promise.all([
  readSource("../src/bot/register-handlers.ts"),
  readSource("../src/features/messaging/resolve-ticket-action.ts"),
  readSource("../src/features/messaging/render-inbox.ts"),
]);

// 4) register-handlers keeps inbox callback routes explicitly wired.
for (const action of ["open", "reply", "block", "unblock", "nickname", "report"]) {
  assert(
    handlersSource.includes(`inboxCallbackQueryRegex("${action}")`),
    `register-handlers must wire inbox callback action: ${action}`
  );
}

// 5) resolve-ticket-action enforces callback ref validation + owner proof check.
assert(
  resolveSource.includes("isCallbackRef(ticketRef)"),
  "resolve-ticket-action must validate callback ref format"
);
assert(
  resolveSource.includes("constantTimeEqual(ownerProofCandidate, ticket.ownerProofTag)"),
  "resolve-ticket-action must verify owner proof using constant-time comparison"
);
assert(
  resolveSource.includes("if (!ticket.routeEnc)") &&
    resolveSource.includes("return { expired: true }"),
  "resolve-ticket-action must treat missing route capsule as expired"
);

// 6) inbox render flow keeps bounded decrypts and post-delivery bookkeeping.
assert(
  inboxSource.includes("MAX_INBOX_DECRYPT_PER_REQUEST = 10"),
  "render-inbox must keep decrypt cap at 10 per request"
);
assert(
  inboxSource.includes("markResolvedTicketViewed") &&
    inboxSource.includes("recordMessageDelivered") &&
    inboxSource.includes("notifyMessageSeen"),
  "render-inbox must mark viewed, emit delivered stat, and notify seen"
);
assert(
  inboxSource.includes("markInboxPointerViewed"),
  "render-inbox must drop invalid pointers by marking them viewed"
);

console.log("verify-bot-flow: ok");
