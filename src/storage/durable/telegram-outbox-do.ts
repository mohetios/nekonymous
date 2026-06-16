import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import type { TelegramOutboxJob } from "../../queues/types";
import { decryptTelegramChatId } from "../../services/crypto-service";

type SentRow = {
  idempotency_key: string;
  status: string;
  telegram_message_id: string | null;
};

export class TelegramOutboxDurableObject extends DurableObject<Environment> {
  constructor(ctx: DurableObjectState, env: Environment) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(() => {
      this.ensureSchema();
      return Promise.resolve();
    });
  }

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const version = this.ctx.storage.sql
      .exec<{ version: number }>(
        "SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations"
      )
      .one().version;

    if (version < 1) {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS sent_events (
          idempotency_key TEXT PRIMARY KEY,
          chat_hash TEXT NOT NULL,
          method TEXT NOT NULL,
          telegram_message_id TEXT,
          status TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          sent_at INTEGER,
          failed_at INTEGER,
          error_code TEXT,
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS rate_buckets (
          scope TEXT PRIMARY KEY,
          tokens REAL NOT NULL,
          last_refill_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST" && new URL(request.url).pathname === "/send") {
      return this.sendJob(request);
    }
    return new Response("Not Found", { status: 404 });
  }

  private async sendJob(request: Request): Promise<Response> {
    const job = await request.json<TelegramOutboxJob>();

    const existing = this.ctx.storage.sql
      .exec<SentRow>(
        "SELECT idempotency_key, status, telegram_message_id FROM sent_events WHERE idempotency_key = ?",
        job.idempotencyKey
      )
      .toArray()[0];

    if (existing?.status === "sent") {
      return Response.json({
        ok: true,
        duplicate: true,
        telegramMessageId: existing.telegram_message_id,
      });
    }

    const now = Date.now();
    if (!existing) {
      this.ctx.storage.sql.exec(
        `INSERT INTO sent_events (
          idempotency_key, chat_hash, method, status, created_at
        ) VALUES (?, ?, ?, 'pending', ?)`,
        job.idempotencyKey,
        job.chatHash,
        job.method,
        now
      );
    }

    try {
      const chatId = await decryptTelegramChatId(
        job.chatCiphertext,
        this.env.APP_MASTER_KEY
      );
      const token = this.env.SECRET_TELEGRAM_API_TOKEN;
      const result = await this.dispatchTelegram(token, chatId, job);

      this.ctx.storage.sql.exec(
        `UPDATE sent_events
         SET status = 'sent', sent_at = ?, telegram_message_id = ?
         WHERE idempotency_key = ?`,
        now,
        result.messageId ?? null,
        job.idempotencyKey
      );

      return Response.json({ ok: true, telegramMessageId: result.messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "send failed";
      this.ctx.storage.sql.exec(
        `UPDATE sent_events
         SET status = 'failed', failed_at = ?, error_message = ?
         WHERE idempotency_key = ?`,
        now,
        message.slice(0, 200),
        job.idempotencyKey
      );
      return new Response(message, { status: 500 });
    }
  }

  private async dispatchTelegram(
    token: string,
    chatId: number,
    job: TelegramOutboxJob
  ): Promise<{ messageId?: string }> {
    const base = `https://api.telegram.org/bot${token}`;

    if (job.method === "sendMessage") {
      const response = await fetch(`${base}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: job.payload.text,
          parse_mode: job.payload.parse_mode,
          reply_markup: job.payload.reply_markup,
          reply_to_message_id: job.payload.reply_to_message_id,
        }),
      });
      const body = await response.json<{
        ok: boolean;
        result?: { message_id: number };
        description?: string;
      }>();
      if (!body.ok) {
        throw new Error(body.description ?? "sendMessage failed");
      }
      return { messageId: String(body.result?.message_id ?? "") };
    }

    if (job.method === "editMessageText") {
      const response = await fetch(`${base}/editMessageText`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: job.payload.message_id,
          text: job.payload.text,
          parse_mode: job.payload.parse_mode,
          reply_markup: job.payload.reply_markup,
        }),
      });
      const body = await response.json<{ ok: boolean; description?: string }>();
      if (!body.ok) {
        throw new Error(body.description ?? "editMessageText failed");
      }
      return {};
    }

    if (job.method === "answerCallbackQuery") {
      const response = await fetch(`${base}/answerCallbackQuery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          callback_query_id: job.payload.callback_query_id,
          text: job.payload.text,
        }),
      });
      const body = await response.json<{ ok: boolean; description?: string }>();
      if (!body.ok) {
        throw new Error(body.description ?? "answerCallbackQuery failed");
      }
      return {};
    }

    throw new Error("Unsupported outbox method");
  }
}
