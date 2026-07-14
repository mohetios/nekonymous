import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { TelegramOutboxJob } from "../src/contracts/telegram/outbox";
import {
  isInboxDrainJob,
  isInboxNotificationJob,
} from "../src/contracts/inbox/events";

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
