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

  it("getState ignores expired drafts", async () => {
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-expired-draft")
    );
    await stub.initState("vitest-expired-draft");
    await stub.setDraft({
      id: "primary",
      mode: "reply",
      toUserId: "other-user",
      linkSlug: "slug",
      expiresAt: Date.now() - 1_000,
    });

    const state = await stub.getState();
    expect(state?.draft).toBeNull();
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
    if (!added.notification.required) {
      throw new Error("missing notification event");
    }
    expect(added.notification.eventId.length).toBeGreaterThan(0);

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
    expect(staleRelease.ok).toBe(false);
    expect(await stub.claimNextUnreadItem()).toBeNull();

    const completed = await stub.completeUnreadDelivery({
      itemId: claim.itemId,
      deliveryAttemptId: claim.deliveryAttemptId,
    });
    expect(completed.ok).toBe(true);
    expect(completed.summary.unreadCount).toBe(0);
  });

  it("refuses stale orphan vault deletes when a newer claim owns the unread row", async () => {
    const userStub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-stale-orphan")
    );
    await userStub.initState("vitest-stale-orphan");
    const now = Date.now();
    const ticketHash = `e${"e".repeat(42)}`;
    const vaultStub = env.TICKET_VAULT.get(
      env.TICKET_VAULT.idFromName(`ticket:${ticketHash.slice(0, 2)}`)
    );

    await vaultStub.storeTicket({
      ticketHash,
      ownerProofTag: "owner-proof-tag-12345678",
      routeEnc: "route-ciphertext",
      payloadEnc: "payload-ciphertext",
      createdAt: now,
      expiresAt: now + 60_000,
    });

    await userStub.addUnreadItem({
      itemId: "stale-orphan-item",
      sealedCapabilityEnc: "sealed-capability-ciphertext",
      dedupeTag: "dedupe-tag-stale-orphan-12345",
      createdAt: now,
      expiresAt: now + 60_000,
    });

    const claimA = await userStub.claimNextUnreadItem();
    expect(claimA?.itemId).toBe("stale-orphan-item");
    if (!claimA) {
      throw new Error("missing claim A");
    }

    // Simulate lease recovery: attempt A no longer owns the row; B reclaims.
    const released = await userStub.releaseUnreadDelivery({
      itemId: claimA.itemId,
      deliveryAttemptId: claimA.deliveryAttemptId,
    });
    expect(released.ok).toBe(true);

    const claimB = await userStub.claimNextUnreadItem();
    expect(claimB?.itemId).toBe(claimA.itemId);
    expect(claimB?.deliveryAttemptId).not.toBe(claimA.deliveryAttemptId);
    if (!claimB) {
      throw new Error("missing claim B");
    }

    // completeOrphan ownership rule: attempt A must not delete TicketVault.
    const staleComplete = await userStub.completeUnreadDelivery({
      itemId: claimA.itemId,
      deliveryAttemptId: claimA.deliveryAttemptId,
    });
    expect(staleComplete.ok).toBe(false);
    if (staleComplete.ok) {
      await vaultStub.deleteTicket(ticketHash);
    }

    const stillThere = await vaultStub.getTicket(ticketHash);
    expect(stillThere.status).toBe("found");

    const liveComplete = await userStub.completeUnreadDelivery({
      itemId: claimB.itemId,
      deliveryAttemptId: claimB.deliveryAttemptId,
    });
    expect(liveComplete.ok).toBe(true);
    if (liveComplete.ok) {
      await vaultStub.deleteTicket(ticketHash);
    }
    const gone = await vaultStub.getTicket(ticketHash);
    expect(gone.status).toBe("not_found");
  });

  it("notifies independently on every newly accepted unread item", async () => {
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName("vitest-inbox-notify")
    );
    await stub.initState("vitest-inbox-notify");
    const now = Date.now();

    const first = await stub.addUnreadItem({
      itemId: "notify-item-1",
      sealedCapabilityEnc: "sealed-notify-1",
      dedupeTag: "notify-dedupe-1",
      createdAt: now,
      expiresAt: now + 60_000,
    });
    expect(first.notification.required).toBe(true);
    if (!first.notification.required) {
      throw new Error("missing first notification");
    }
    const firstEventId = first.notification.eventId;
    expect(first.unreadCount).toBe(1);

    const second = await stub.addUnreadItem({
      itemId: "notify-item-2",
      sealedCapabilityEnc: "sealed-notify-2",
      dedupeTag: "notify-dedupe-2",
      createdAt: now + 1,
      expiresAt: now + 60_000,
    });
    expect(second.notification.required).toBe(true);
    if (!second.notification.required) {
      throw new Error("missing second notification");
    }
    expect(second.notification.eventId).not.toBe(firstEventId);
    expect(second.unreadCount).toBe(2);

    const third = await stub.addUnreadItem({
      itemId: "notify-item-3",
      sealedCapabilityEnc: "sealed-notify-3",
      dedupeTag: "notify-dedupe-3",
      createdAt: now + 3,
      expiresAt: now + 60_000,
    });
    expect(third.notification.required).toBe(true);
    if (!third.notification.required) {
      throw new Error("missing third notification");
    }
    expect(third.notification.eventId).not.toBe(second.notification.eventId);
    expect(third.unreadCount).toBe(3);

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
    expect((await stub.getUnreadSummary()).unreadCount).toBe(0);

    const afterDrain = await stub.addUnreadItem({
      itemId: "notify-item-4",
      sealedCapabilityEnc: "sealed-notify-4",
      dedupeTag: "notify-dedupe-4",
      createdAt: now + 5,
      expiresAt: now + 60_000,
    });
    expect(afterDrain.notification.required).toBe(true);
    if (!afterDrain.notification.required) {
      throw new Error("missing post-drain notification");
    }
    expect(afterDrain.notification.eventId).not.toBe(firstEventId);
    expect(afterDrain.unreadCount).toBe(1);
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
    expect(stored).toEqual({ status: "created" });

    const loaded = await stub.getTicket(safeTicketHash);
    expect(loaded.status).toBe("found");
    if (loaded.status === "found") {
      expect(loaded.record.ticketHash).toBe(safeTicketHash);
      expect(loaded.record.status).toBe("active");
    }
  });

  it("reports existing on deterministic ticket_hash conflict and never treats other SQL as duplicate", async () => {
    const ticketHash = `c${"c".repeat(42)}`;
    const stub = env.TICKET_VAULT.get(
      env.TICKET_VAULT.idFromName(`ticket:${ticketHash.slice(0, 2)}`)
    );
    const now = Date.now();
    const input = {
      ticketHash,
      ownerProofTag: "owner-proof-tag-12345678",
      routeEnc: "route-ciphertext",
      payloadEnc: "payload-ciphertext",
      createdAt: now,
      expiresAt: now + 60_000,
    };

    expect(await stub.storeTicket(input)).toEqual({ status: "created" });
    expect(await stub.storeTicket(input)).toEqual({ status: "existing" });

    const loaded = await stub.getTicket(ticketHash);
    expect(loaded.status).toBe("found");
  });

  it("keeps an existing deterministic ticket when a later attempt deletes only created rows", async () => {
    const ticketHash = `d${"d".repeat(42)}`;
    const stub = env.TICKET_VAULT.get(
      env.TICKET_VAULT.idFromName(`ticket:${ticketHash.slice(0, 2)}`)
    );
    const now = Date.now();
    const input = {
      ticketHash,
      ownerProofTag: "owner-proof-tag-12345678",
      routeEnc: "route-ciphertext-current",
      payloadEnc: "payload-ciphertext-current",
      createdAt: now,
      expiresAt: now + 60_000,
    };

    const first = await stub.storeTicket(input);
    expect(first.status).toBe("created");

    const second = await stub.storeTicket({
      ...input,
      routeEnc: "route-ciphertext-current",
      payloadEnc: "payload-ciphertext-current",
    });
    expect(second.status).toBe("existing");

    // Compensation must only run when this invocation created the row.
    if (second.status === "created") {
      await stub.deleteTicket(ticketHash);
    }

    const loaded = await stub.getTicket(ticketHash);
    expect(loaded.status).toBe("found");
    if (loaded.status === "found") {
      expect(loaded.record.routeEnc).toBe("route-ciphertext-current");
      expect(loaded.record.payloadEnc).toBe("payload-ciphertext-current");
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
      env.SAFETY_STATE_DO.idFromName(`safety:${tag}`)
    );
    const event = {
      eventTag: "report-event-tag-123456",
      reporterSubjectTag: "reporter-subject-tag-123456",
      reasonCode: "spam" as const,
    };

    const first = await stub.submitReport(event);
    const second = await stub.submitReport(event);
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);
  });

  it("suspends after five distinct reporters in FIRST_STRIKE", async () => {
    const tag = `abuse-subject-strike-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const stub = env.SAFETY_STATE_DO.get(
      env.SAFETY_STATE_DO.idFromName(`safety:${tag}`)
    );

    let lastDecision = await stub.getSafetyDecision();
    for (let index = 0; index < 5; index += 1) {
      const suffix = `${index}${crypto.randomUUID().replaceAll("-", "")}`.slice(
        0,
        24
      );
      const result = await stub.submitReport({
        eventTag: `report-event-${suffix}`,
        reporterSubjectTag: `reporter-subject-${suffix}`,
        reasonCode: "spam",
      });
      expect(result.ok).toBe(true);
      expect(result.duplicate).toBe(false);
      lastDecision = result.decision;
      // Yield so report created_at values are not all identical.
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    expect(lastDecision.status).toBe("suspended");
    expect(lastDecision.allowed).toBe(false);
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
