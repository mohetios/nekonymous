import { webhookCallback } from "grammy";
import type { Environment } from "../contracts/runtime";
import {
  claimProcessedEvent,
  completeProcessedEvent,
  failProcessedEvent,
} from "../storage/user-state-client";
import { logBotError } from "../utils/logs";
import { timingSafeEqual } from "../utils/timing-safe-equal";
import { createBot } from "./create-bot";

const WEBHOOK_PATH = "/bot";
const UPDATE_CLAIM_LEASE_MS = 30 * 1000;
const MAX_WEBHOOK_BYTES = 256 * 1024;
const TELEGRAM_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

type ParsedWebhookBody =
  | { ok: true; updateId: number; body: Uint8Array }
  | { ok: false; response: Response };

const isJsonContentType = (contentType: string | null): boolean =>
  contentType?.toLowerCase().includes("application/json") === true;

const readRequestBody = async (
  request: Request
): Promise<Uint8Array | Response> => {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      return new Response("Invalid content length", { status: 400 });
    }
    if (parsedLength > MAX_WEBHOOK_BYTES) {
      return new Response("Payload too large", { status: 413 });
    }
  }

  if (!request.body) {
    return new Uint8Array();
  }

  const reader =
    request.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    const value = chunk.value;
    total += value.byteLength;
    if (total > MAX_WEBHOOK_BYTES) {
      await reader.cancel();
      return new Response("Payload too large", { status: 413 });
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
};

const parseWebhookBody = async (
  request: Request
): Promise<ParsedWebhookBody> => {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      response: new Response("Unsupported media type", { status: 415 }),
    };
  }

  const body = await readRequestBody(request);
  if (body instanceof Response) {
    return { ok: false, response: body };
  }

  try {
    const update = JSON.parse(new TextDecoder().decode(body)) as {
      update_id?: unknown;
    };
    if (typeof update.update_id !== "number") {
      return {
        ok: false,
        response: new Response("Invalid update_id", { status: 400 }),
      };
    }
    return { ok: true, updateId: update.update_id, body };
  } catch {
    return {
      ok: false,
      response: new Response("Invalid JSON", { status: 400 }),
    };
  }
};

const cloneWebhookRequest = (request: Request, body: Uint8Array): Request =>
  new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });

const failEventWithLog = async (
  env: Environment,
  eventKey: string,
  context: string
): Promise<void> => {
  try {
    await failProcessedEvent(env, eventKey);
  } catch (error) {
    logBotError(context, error, { retryable: true });
  }
};

export const handleWebhook = async (
  request: Request,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> => {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== WEBHOOK_PATH) {
    return new Response("Not Found", { status: 404 });
  }

  const expectedSecret = env.BOT_SECRET_KEY?.trim();
  if (!expectedSecret) {
    logBotError("webhook_config_missing", new Error("BOT_SECRET_KEY is missing"));
    return new Response("Service unavailable", { status: 503 });
  }

  const telegramSecret = request.headers.get(TELEGRAM_SECRET_HEADER) ?? "";
  if (!timingSafeEqual(telegramSecret, expectedSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsed = await parseWebhookBody(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const eventKey = `tg:update:${parsed.updateId}`;
  let claimState: "acquired" | "processing" | "done";
  try {
    claimState = await claimProcessedEvent(
      env,
      eventKey,
      UPDATE_CLAIM_LEASE_MS
    );
  } catch (error) {
    logBotError("webhook_claim_failed", error, { retryable: true });
    return new Response("Service unavailable", {
      status: 503,
      headers: { "Retry-After": "1" },
    });
  }

  if (claimState === "done") {
    return new Response("OK", { status: 200 });
  }
  if (claimState === "processing") {
    logBotError("webhook_duplicate_processing", new Error("Update is leased"), {
      retryable: true,
      delaySeconds: 1,
    });
    return new Response("Processing", {
      status: 503,
      headers: { "Retry-After": "1" },
    });
  }

  try {
    const bot = createBot(env, (promise) => ctx.waitUntil(promise));
    const response = await webhookCallback(bot, "cloudflare-mod", {
      secretToken: expectedSecret,
    })(cloneWebhookRequest(request, parsed.body));

    if (response.status >= 500) {
      await failEventWithLog(env, eventKey, "webhook_handler_failed");
    } else {
      try {
        await completeProcessedEvent(env, eventKey);
      } catch (error) {
        logBotError("webhook_completion_failed", error, { retryable: true });
        return new Response("Service unavailable", {
          status: 503,
          headers: { "Retry-After": "1" },
        });
      }
    }

    return response;
  } catch (error) {
    logBotError("webhook_handler_failed", error, { retryable: true });
    await failEventWithLog(env, eventKey, "webhook_failure_mark_failed");
    return new Response("Error handling bot request", { status: 500 });
  }
};
