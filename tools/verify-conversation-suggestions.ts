/**
 * Conversation suggestion capability tests.
 * Run: pnpm test:conversation-suggestions
 */

import {
  canTransitionSuggestionStatus,
  effectiveSuggestionStatus,
  isTerminalSuggestionStatus,
} from "../src/storage/conversation-vault/suggestion-transitions.ts";
import { parseSuggestionCallback } from "../src/features/conversation-suggestions/suggestion-callbacks.ts";
import { SUGGESTION_CALLBACK } from "../src/features/conversation-suggestions/constants.ts";
import { randomSuggestionRef } from "../src/features/ticketing/conversation-keys.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

if (!canTransitionSuggestionStatus("created", "viewed")) {
  fail("created must transition to viewed");
}
if (canTransitionSuggestionStatus("dismissed", "viewed")) {
  fail("dismissed must not reopen");
}
if (canTransitionSuggestionStatus("converted_to_request", "dismissed")) {
  fail("converted suggestion must stay terminal");
}
if (!isTerminalSuggestionStatus("expired")) {
  fail("expired must be terminal");
}

const now = Date.now();
if (
  effectiveSuggestionStatus("created", now - 1, now) !== "expired"
) {
  fail("past expiry must resolve to expired");
}
if (
  effectiveSuggestionStatus("dismissed", now - 1, now) !== "dismissed"
) {
  fail("terminal status must not be overridden by expiry helper");
}

const suggestionRef = randomSuggestionRef();
const openData = SUGGESTION_CALLBACK.open(suggestionRef);
const dismissData = SUGGESTION_CALLBACK.dismiss(suggestionRef);

const openParsed = parseSuggestionCallback(openData);
const dismissParsed = parseSuggestionCallback(dismissData);
if (openParsed?.kind !== "open" || openParsed.suggestionRef !== suggestionRef) {
  fail("open callback parse failed");
}
if (
  dismissParsed?.kind !== "dismiss" ||
  dismissParsed.suggestionRef !== suggestionRef
) {
  fail("dismiss callback parse failed");
}
if (parseSuggestionCallback("s:bad ref with spaces")) {
  fail("invalid callback must not parse");
}
if (parseSuggestionCallback(`s:r:${suggestionRef}`)?.kind !== "request") {
  fail("request callback parse failed");
}

console.log("verify-conversation-suggestions: OK");
