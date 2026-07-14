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
import {
  operatorClearSanction,
  refreshExpiredSanction,
} from "../src/storage/safety-state/safety-state.client";

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
    expect(state?.blockTags).toEqual([]);
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

  it("stores unread inbox items and dedupes retries", async () => {
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-unread-item")
    );
    await stub.initState("vitest-unread-item");
    const now = Date.now();

    const added = await stub.addUnreadItem({
      itemId: "item-vitest-1",
      sealedCapabilityEnc: "sealed-capability-ciphertext",
      dedupeTag: "dedupe-tag-vitest-1234567890",
      createdAt: now,
      expiresAt: now + 60_000,
    });
    expect(added.ok).toBe(true);
    expect(added.unreadCount).toBe(1);
    expect(added.notification.required).toBe(true);

    const cycle = await stub.getInboxNotificationCycle();
    expect(cycle?.status).toBe("pending");
    if (!cycle) {
      throw new Error("missing notification cycle");
    }

    const duplicate = await stub.addUnreadItem({
      itemId: "item-vitest-duplicate",
      sealedCapabilityEnc: "other-sealed-capability-ciphertext",
      dedupeTag: "dedupe-tag-vitest-1234567890",
      createdAt: now,
      expiresAt: now + 60_000,
    });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.unreadCount).toBe(1);
    expect(duplicate.notification.required).toBe(false);

    const claim = await stub.claimNextUnreadItem();
    expect(claim?.itemId).toBe("item-vitest-1");
    expect(claim?.sealedCapabilityEnc).toBe("sealed-capability-ciphertext");
    expect(claim?.dedupeTag).toBe("dedupe-tag-vitest-1234567890");

    const parallelClaim = await stub.claimNextUnreadItem();
    expect(parallelClaim).toBeNull();

    if (!claim) {
      throw new Error("missing claim");
    }
    const staleRelease = await stub.releaseUnreadDelivery({
      itemId: claim.itemId,
      deliveryAttemptId: "stale",
    });
    expect(staleRelease.ok).toBe(true);
    expect(await stub.claimNextUnreadItem()).toBeNull();

    const completed = await stub.completeUnreadDelivery({
      itemId: claim.itemId,
      deliveryAttemptId: claim.deliveryAttemptId,
    });
    expect(completed.ok).toBe(true);
    expect(completed.summary.unreadCount).toBe(0);
    expect(await stub.getInboxNotificationCycle()).toBeNull();
  });

  it("keeps one notification cycle for a non-empty inbox", async () => {
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-inbox-cycle")
    );
    await stub.initState("vitest-inbox-cycle");
    const now = Date.now();

    const first = await stub.addUnreadItem({
      itemId: "cycle-item-1",
      sealedCapabilityEnc: "sealed-cycle-1",
      dedupeTag: "cycle-dedupe-1",
      createdAt: now,
      expiresAt: now + 60_000,
    });
    expect(first.notification.required).toBe(true);
    if (!first.notification.required) {
      throw new Error("missing first notification");
    }
    const firstCycleId = first.notification.cycleId;

    const second = await stub.addUnreadItem({
      itemId: "cycle-item-2",
      sealedCapabilityEnc: "sealed-cycle-2",
      dedupeTag: "cycle-dedupe-2",
      createdAt: now + 1,
      expiresAt: now + 60_000,
    });
    expect(second.notification).toEqual({
      required: true,
      cycleId: firstCycleId,
    });

    const sent = await stub.markInboxNotificationSent({
      cycleId: firstCycleId,
      sentAt: now + 2,
    });
    expect(sent.ok).toBe(true);
    expect(sent.cycle?.status).toBe("sent");

    const third = await stub.addUnreadItem({
      itemId: "cycle-item-3",
      sealedCapabilityEnc: "sealed-cycle-3",
      dedupeTag: "cycle-dedupe-3",
      createdAt: now + 3,
      expiresAt: now + 60_000,
    });
    expect(third.notification).toEqual({ required: false });
    expect((await stub.getInboxNotificationCycle())?.cycleId).toBe(firstCycleId);

    const closedWhileUnread = await stub.closeInboxNotificationCycle({
      cycleId: firstCycleId,
    });
    expect(closedWhileUnread.ok).toBe(true);
    expect(await stub.getInboxNotificationCycle()).toBeNull();

    const recovered = await stub.addUnreadItem({
      itemId: "cycle-item-4",
      sealedCapabilityEnc: "sealed-cycle-4",
      dedupeTag: "cycle-dedupe-4",
      createdAt: now + 4,
      expiresAt: now + 60_000,
    });
    expect(recovered.notification.required).toBe(true);
    if (!recovered.notification.required) {
      throw new Error("missing recovered notification");
    }
    const recoveredCycleId = recovered.notification.cycleId;
    expect(recoveredCycleId).not.toBe(firstCycleId);

    const firstClaim = await stub.claimNextUnreadItem();
    if (!firstClaim) {
      throw new Error("missing first claim");
    }
    const partial = await stub.completeUnreadDelivery({
      itemId: firstClaim.itemId,
      deliveryAttemptId: firstClaim.deliveryAttemptId,
    });
    expect(partial.summary.unreadCount).toBe(3);
    expect((await stub.getInboxNotificationCycle())?.cycleId).toBe(
      recoveredCycleId
    );

    for (;;) {
      const claim = await stub.claimNextUnreadItem();
      if (!claim) {
        break;
      }
      await stub.completeUnreadDelivery({
        itemId: claim.itemId,
        deliveryAttemptId: claim.deliveryAttemptId,
      });
    }
    expect(await stub.getInboxNotificationCycle()).toBeNull();

    const afterDrain = await stub.addUnreadItem({
      itemId: "cycle-item-5",
      sealedCapabilityEnc: "sealed-cycle-5",
      dedupeTag: "cycle-dedupe-5",
      createdAt: now + 5,
      expiresAt: now + 60_000,
    });
    expect(afterDrain.notification.required).toBe(true);
    if (!afterDrain.notification.required) {
      throw new Error("missing post-drain notification");
    }
    expect(afterDrain.notification.cycleId).not.toBe(recoveredCycleId);
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

describe("SafetyState typed RPC", () => {
  it("records a report once and treats duplicates as ok", async () => {
    const tag = "abuse-subject-tag-12345678";
    const stub = env.SAFETY_STATE_DO.get(
      env.SAFETY_STATE_DO.idFromName(`safety:${tag.slice(0, 4)}`)
    );
    const event = {
      eventTag: "report-event-tag-123456",
      reporterSubjectTag: "reporter-subject-tag-123456",
      reasonCode: "spam",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };

    const first = await stub.submitReport(event);
    const second = await stub.submitReport(event);
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
  });

  it("exposes refresh and operator clear APIs", async () => {
    const tag = "abuse-subject-client-12345678";
    const refreshed = await refreshExpiredSanction(env, tag);
    expect(refreshed.status).toBe("clear");

    const cleared = await operatorClearSanction(env, tag);
    expect(cleared.status).toBe("clear");
    expect(cleared.allowed).toBe(true);
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
