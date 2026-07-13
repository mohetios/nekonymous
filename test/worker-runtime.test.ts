import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { DurableObjectCallError } from "../src/storage/durable-object-call-error";

const webhookEventShardName = (eventKey: string): string => {
  let hash = 0;
  for (let index = 0; index < eventKey.length; index += 1) {
    hash = (hash * 31 + eventKey.charCodeAt(index)) >>> 0;
  }
  return `__webhook_events__:${hash % 16}`;
};

describe("webhook routing", () => {
  it("returns 404 for non-POST requests", async () => {
    const response = await SELF.fetch("https://example.com/bot");
    expect(response.status).toBe(404);
  });

  it("returns 404 for unknown paths", async () => {
    const response = await SELF.fetch("https://example.com/health", {
      method: "POST",
    });
    expect(response.status).toBe(404);
  });

  it("rejects POST /bot without the Telegram secret", async () => {
    const response = await SELF.fetch("https://example.com/bot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(response.status).toBe(401);
  });

  it("rejects POST /bot without update_id", async () => {
    const response = await SELF.fetch("https://example.com/bot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": env.BOT_SECRET_KEY,
      },
      body: JSON.stringify({ message: { text: "hi" } }),
    });
    expect(response.status).toBe(400);
  });

  it("asks Telegram to retry duplicate updates that are still processing", async () => {
    const updateId = 8_000_001;
    const eventKey = `tg:update:${updateId}`;
    const stub = env.USER_STATE_DO.get(
      env.USER_STATE_DO.idFromName(webhookEventShardName(eventKey))
    );
    const claim = await stub.claimProcessedEvent(eventKey, 30_000);
    expect(claim).toEqual({ state: "acquired" });

    const response = await SELF.fetch("https://example.com/bot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": env.BOT_SECRET_KEY,
      },
      body: JSON.stringify({ update_id: updateId }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    await stub.failProcessedEvent(eventKey);
  });
});

describe("queue dispatch", () => {
  it("throws for unknown queue names", async () => {
    const message = {
      id: "msg-1",
      timestamp: new Date(),
      body: {},
      attempts: 1,
      ack: () => undefined,
      retry: () => undefined,
    };

    await expect(
      worker.queue(
        {
          queue: "neko-unknown",
          messages: [message],
        } as MessageBatch<unknown>,
        env
      )
    ).rejects.toThrow("Unknown queue: neko-unknown");
  });
});

describe("storage error typing", () => {
  it("exposes durable object status on typed errors", () => {
    const error = new DurableObjectCallError(404, "UserStateDO /state");
    expect(error.status).toBe(404);
    expect(error.operation).toBe("UserStateDO /state");
    expect(error.name).toBe("DurableObjectCallError");
  });
});
