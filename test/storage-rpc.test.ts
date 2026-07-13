import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  isDurableObjectCallError,
  DurableObjectCallError,
} from "../src/storage/durable-object-call-error";
import {
  claimRequestAccept,
  completeRequestAccept,
  getRequestRecord,
  storeRequestRecord,
} from "../src/storage/conversation-vault/conversation-vault.client";

const safeTicketHash = "a".repeat(43);

const uniqueSafeHash = (prefix: string): string =>
  `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;

describe("UserState typed RPC", () => {
  it("returns null state before init", async () => {
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-uninitialized")
    );
    const state = await stub.getState();
    expect(state).toBeNull();
  });

  it("initializes and reads state", async () => {
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-user-1")
    );
    const init = await stub.initState("vitest-user-1");
    expect(init.ok).toBe(true);

    const state = await stub.getState();
    expect(state).not.toBeNull();
    expect(state?.paused).toBe(false);
    expect(state?.blockedUserIds).toEqual([]);
  });

  it("enforces the global action rate limit", async () => {
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-rate-limit")
    );
    await stub.initState("vitest-rate-limit");

    const first = await stub.consumeRateLimit();
    const second = await stub.consumeRateLimit();
    expect(first.limited).toBe(false);
    expect(second.limited).toBe(true);
  });
});

describe("TicketVault typed RPC", () => {
  it("stores and reads an active ticket", async () => {
    const stub = env.TICKET_VAULT.get(
      env.TICKET_VAULT.idFromName(`ticket:${safeTicketHash.slice(0, 2)}`)
    );
    const now = Date.now();

    const stored = await stub.storeTicket({
      ticketHash: safeTicketHash,
      ownerProofTag: "owner-proof-tag-12345678",
      routeEnc: "route-ciphertext",
      payloadEnc: "payload-ciphertext",
      createdAt: now,
      expiresAt: now + 60_000,
    });
    expect(stored.ok).toBe(true);

    const loaded = await stub.getTicket(safeTicketHash);
    expect(loaded.status).toBe("found");
    if (loaded.status === "found") {
      expect(loaded.record.ticketHash).toBe(safeTicketHash);
      expect(loaded.record.status).toBe("active");
    }
  });

  it("returns not_found for unknown tickets", async () => {
    const missingHash = `b${"b".repeat(42)}`;
    const stub = env.TICKET_VAULT.get(
      env.TICKET_VAULT.idFromName(`ticket:${missingHash.slice(0, 2)}`)
    );
    const loaded = await stub.getTicket(missingHash);
    expect(loaded.status).toBe("not_found");
  });
});

describe("ReportLedger typed RPC", () => {
  it("records a report once and treats duplicates as ok", async () => {
    const tag = "sender-abuse-tag-12345678";
    const stub = env.REPORT_LEDGER.get(
      env.REPORT_LEDGER.idFromName(tag.slice(0, 8))
    );
    const event = {
      reportId: "report-vitest-1",
      senderAbuseTag: tag,
      reporterProofTag: "reporter-proof-tag-123456",
      reasonCode: "spam",
      createdAt: Date.now(),
    };

    const first = await stub.createReport(event);
    const second = await stub.createReport(event);
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
  });
});

describe("PairLedger typed RPC", () => {
  it("acquires and releases a pending lock", async () => {
    const pairTag = "pair-tag-vitest-12345678901234567890123456789012";
    const stub = env.PAIR_LEDGER_DO.get(
      env.PAIR_LEDGER_DO.idFromName(pairTag.slice(0, 8))
    );
    const expiresAt = Date.now() + 60_000;

    const acquired = await stub.acquirePairPending(pairTag, expiresAt);
    expect(acquired.ok).toBe(true);

    const blocked = await stub.acquirePairPending(pairTag, expiresAt);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("blocked");

    const released = await stub.releasePairPending(pairTag);
    expect(released.ok).toBe(true);
    expect(released.released).toBe(true);
  });
});

describe("ConversationVault typed RPC", () => {
  it("claims request accept before finalizing with a ticket hash", async () => {
    const requestHash = uniqueSafeHash("req");
    const operationId = `conversation-request:${requestHash}`;
    const ticketHash = uniqueSafeHash("tic");
    const expiresAt = Date.now() + 60_000;

    await storeRequestRecord(env, {
      requestHash,
      requesterProofTag: "requester-proof-tag-123456",
      candidateProofTag: "candidate-proof-tag-123456",
      requesterRouteEnc: "requester-route-ciphertext",
      candidateRouteEnc: "{}",
      introEnc: "intro-ciphertext",
      status: "pending",
      expiresAt,
    });

    const firstClaim = await claimRequestAccept(
      env,
      requestHash,
      operationId,
      30_000
    );
    expect(firstClaim.ok).toBe(true);
    if (firstClaim.ok) {
      expect(firstClaim.state).toBe("acquired");
    }

    const duplicateClaim = await claimRequestAccept(
      env,
      requestHash,
      operationId,
      30_000
    );
    expect(duplicateClaim.ok).toBe(true);
    if (duplicateClaim.ok) {
      expect(duplicateClaim.state).toBe("processing");
    }

    const accepting = await getRequestRecord(env, requestHash);
    expect(accepting?.status).toBe("accepting");
    expect(accepting?.introEnc).toBe("intro-ciphertext");

    await completeRequestAccept(env, requestHash, operationId, ticketHash);

    const accepted = await getRequestRecord(env, requestHash);
    expect(accepted?.status).toBe("accepted");
    expect(accepted?.introEnc).toBeNull();
    expect(accepted?.acceptedTicketHash).toBe(ticketHash);
  });
});

describe("DurableObjectCallError", () => {
  it("narrows typed storage failures", () => {
    const error = new DurableObjectCallError(404, "UserStateDO /state");
    expect(isDurableObjectCallError(error)).toBe(true);
    expect(isDurableObjectCallError(new Error("nope"))).toBe(false);
  });
});
