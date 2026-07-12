/**
 * Conversation request capability and pair-lock tests.
 * Run: pnpm test:conversation-requests
 */

import {
  canTransitionRequestStatus,
  effectiveRequestStatus,
  isTerminalRequestStatus,
  shouldClearRequestIntro,
} from "../src/storage/conversation-vault/request-transitions.ts";
import {
  evaluateAcquirePairPending,
  isActiveBlockingPairState,
} from "../src/storage/pair-ledger/pair-pending.ts";
import type { PairStateRecord } from "../src/storage/pair-ledger/pair-ledger.types.ts";
import { parseRequestCallback } from "../src/features/conversation/suggestions/request-callbacks.ts";
import { REQUEST_CALLBACK } from "../src/features/conversation/suggestions/constants.ts";
import { randomRequestRef } from "../src/features/ticketing/conversation-keys.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const now = Date.now();

if (!canTransitionRequestStatus("pending", "accepted")) {
  fail("pending must transition to accepted");
}
if (canTransitionRequestStatus("accepted", "pending")) {
  fail("accepted must stay terminal");
}
if (!isTerminalRequestStatus("canceled")) {
  fail("canceled must be terminal");
}
if (!shouldClearRequestIntro("declined")) {
  fail("declined must clear intro");
}
if (shouldClearRequestIntro("pending")) {
  fail("pending must retain intro");
}

if (effectiveRequestStatus("pending", now - 1, now) !== "expired") {
  fail("past expiry must resolve to expired");
}

const pairState = (
  state: PairStateRecord["state"],
  expiresAt: number | null = now + 60_000
): PairStateRecord => ({
  pairTag: "pair-1",
  state,
  expiresAt,
  updatedAt: now,
});

if (!isActiveBlockingPairState(pairState("pending"))) {
  fail("pending pair must block acquire");
}
if (evaluateAcquirePairPending(pairState("pending")).ok) {
  fail("acquire must reject active pending lock");
}
if (!evaluateAcquirePairPending(null).ok) {
  fail("acquire must succeed on empty pair state");
}
if (!evaluateAcquirePairPending(pairState("dismiss_cooldown", now - 1)).ok) {
  fail("acquire must succeed after expired cooldown");
}

let simulated: PairStateRecord | null = null;
const acquire = (expiresAt: number): boolean => {
  const decision = evaluateAcquirePairPending(simulated);
  if (!decision.ok) {
    return false;
  }
  simulated = {
    pairTag: "pair-race",
    state: "pending",
    expiresAt,
    updatedAt: Date.now(),
  };
  return true;
};

if (!acquire(now + 60_000)) {
  fail("first acquire must succeed");
}
if (acquire(now + 120_000)) {
  fail("concurrent acquire simulation must fail while pending");
}
simulated = null;
if (!acquire(now + 60_000)) {
  fail("acquire must succeed after pending release");
}

const requestRef = randomRequestRef();
const acceptData = REQUEST_CALLBACK.accept(requestRef);
const declineData = REQUEST_CALLBACK.decline(requestRef);
const cancelData = REQUEST_CALLBACK.cancel(requestRef);
const openData = REQUEST_CALLBACK.open(requestRef);

if (parseRequestCallback(acceptData)?.kind !== "accept") {
  fail("accept callback parse failed");
}
if (parseRequestCallback(declineData)?.kind !== "decline") {
  fail("decline callback parse failed");
}
if (parseRequestCallback(cancelData)?.kind !== "cancel") {
  fail("cancel callback parse failed");
}
if (parseRequestCallback(openData)?.kind !== "open") {
  fail("open callback parse failed");
}
if (parseRequestCallback(`q:a:${requestRef}`)?.requestRef !== requestRef) {
  fail("request ref roundtrip failed");
}

console.log("verify-conversation-requests: OK");
