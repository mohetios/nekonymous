import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { TelegramOutboxJob } from "../src/contracts/telegram/outbox";
import {
  isInboxDrainJob,
  isInboxNotificationJob,
} from "../src/contracts/inbox/events";
import { handleOutboxBatch } from "../src/queues/outbox-consumer";
import {
  createDeterministicTicketCapability,
  encodeTicketCapability,
  parseTicketCapability,
} from "../src/features/ticketing/ticket-capability";

describe("inbox queue validators", () => {
  it("accepts canonical drain jobs", () => {
    expect(
      isInboxDrainJob({
        kind: "inbox-drain",
        idempotencyKey: "drain:key",
        userId: "user-1",
        requestId: "request-1",
        createdAt: Date.now(),
      })
    ).toBe(true);
  });

  it("rejects malformed drain jobs", () => {
    expect(isInboxDrainJob({ kind: "inbox-drain" })).toBe(false);
    expect(isInboxDrainJob(null)).toBe(false);
  });

  it("accepts canonical notification jobs", () => {
    expect(
      isInboxNotificationJob({
        kind: "inbox-notification",
        accountId: "user-1",
        eventId: "event-1",
      })
    ).toBe(true);
  });

  it("rejects notification jobs with extra fields", () => {
    expect(
      isInboxNotificationJob({
        kind: "inbox-notification",
        accountId: "user-1",
        eventId: "event-1",
        unreadCount: 3,
      })
    ).toBe(false);
  });
});

describe("TelegramOutboxDO", () => {
  it("rejects invalid outbox jobs", async () => {
    const stub = env.TELEGRAM_OUTBOX_DO.get(
      env.TELEGRAM_OUTBOX_DO.idFromName("invalid-job-chat")
    );
    const result = await stub.sendJob({} as TelegramOutboxJob);
    expect(result).toEqual({ status: "rejected", reason: "invalid" });
  });
});

describe("outbox batch body validation", () => {
  it("acks malformed bodies without crashing the batch", async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    await handleOutboxBatch(
      {
        queue: "neko-outbox",
        messages: [
          {
            id: "malformed-1",
            timestamp: new Date(),
            body: null as unknown as TelegramOutboxJob,
            ack,
            retry,
          },
          {
            id: "malformed-2",
            timestamp: new Date(),
            body: { notKind: true } as unknown as TelegramOutboxJob,
            ack,
            retry,
          },
        ],
      } as MessageBatch<TelegramOutboxJob>,
      env
    );
    expect(ack).toHaveBeenCalledTimes(2);
    expect(retry).not.toHaveBeenCalled();
  });
});

describe("deterministic ticket capability", () => {
  it("mints a stable capability for the same dedupe key", async () => {
    const first = await createDeterministicTicketCapability(
      env.APP_MASTER_KEY,
      "conversation-request:reqhash"
    );
    const second = await createDeterministicTicketCapability(
      env.APP_MASTER_KEY,
      "conversation-request:reqhash"
    );
    expect(encodeTicketCapability(first)).toBe(encodeTicketCapability(second));
    expect(parseTicketCapability(encodeTicketCapability(first))).toEqual(first);
  });
});
