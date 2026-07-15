import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../contracts/runtime";
import type {
  TelegramApiResponse,
  TelegramOutboxJob,
  TelegramOutboxSendResult,
  TelegramOutboxSentRow,
} from "../contracts/telegram/outbox";
import { decryptTelegramChatId } from "../features/ticketing/ticketing-service";
import { logBotError } from "../utils/logs";

class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

const GENERIC_RETRY_DELAY_SECONDS = 5;

const SEND_LEASE_MS = 60 * 1000;
const OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const OUTBOX_CLEANUP_LIMIT = 100;
const CHAT_LOCK_ID = "chat";
const CHAT_PACE_SCOPE = "chat_send";
const MIN_SEND_INTERVAL_MS = 1000;

const isPermanentTelegramError = (
  httpStatus: number,
  errorCode: number | undefined
): boolean => {
  if (httpStatus === 429 || errorCode === 429) {
    return false;
  }
  if (httpStatus >= 500 || (errorCode !== undefined && errorCode >= 500)) {
    return false;
  }
  return httpStatus >= 400 || (errorCode !== undefined && errorCode >= 400);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOutboxJob = (value: unknown): value is TelegramOutboxJob =>
  isRecord(value) &&
  typeof value.idempotencyKey === "string" &&
    value.idempotencyKey.length <= 160 &&
  (value.kind === undefined || value.kind === "telegram") &&
  typeof value.chatCiphertext === "string" &&
  typeof value.chatHash === "string" &&
  (value.method === "sendMessage" ||
    value.method === "sendPhoto" ||
    value.method === "sendVideo" ||
    value.method === "sendAnimation" ||
    value.method === "sendDocument" ||
    value.method === "sendSticker" ||
    value.method === "sendVoice" ||
    value.method === "sendVideoNote" ||
    value.method === "sendAudio" ||
    value.method === "answerCallbackQuery") &&
  isRecord(value.payload) &&
  Number.isSafeInteger(value.createdAt);

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

    this.ensureLeaseSchema();
  }

  private ensureLeaseSchema(): void {
    const sentColumns = new Set(
      this.ctx.storage.sql
        .exec<{ name: string }>("PRAGMA table_info(sent_events)")
        .toArray()
        .map((column) => column.name)
    );

    if (!sentColumns.has("lease_attempt_id")) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE sent_events ADD COLUMN lease_attempt_id TEXT"
      );
    }
    if (!sentColumns.has("lease_until")) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE sent_events ADD COLUMN lease_until INTEGER"
      );
    }
    if (!sentColumns.has("attempts")) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE sent_events ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!sentColumns.has("permanent_error")) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE sent_events ADD COLUMN permanent_error INTEGER NOT NULL DEFAULT 0"
      );
    }

    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_sent_events_retention
      ON sent_events(status, sent_at, failed_at);

      CREATE TABLE IF NOT EXISTS send_locks (
        id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL,
        lease_until INTEGER NOT NULL
      );
    `);
  }

  async sendJob(job: TelegramOutboxJob): Promise<TelegramOutboxSendResult> {
    if (!isOutboxJob(job)) {
      return { status: "rejected", reason: "invalid" };
    }

    const now = Date.now();
    this.cleanupRetainedRows(now);

    const existing = this.ctx.storage.sql
      .exec<TelegramOutboxSentRow>(
        `SELECT idempotency_key, status, telegram_message_id,
                lease_attempt_id, lease_until, attempts, permanent_error
         FROM sent_events
         WHERE idempotency_key = ?`,
        job.idempotencyKey
      )
      .toArray()[0];

    if (existing?.status === "sent") {
      return {
        status: "sent",
        duplicate: true,
        telegramMessageId: existing.telegram_message_id,
      };
    }

    if (existing?.status === "failed" && existing.permanent_error === 1) {
      return { status: "rejected", reason: "permanent" };
    }

    if (
      existing?.lease_until !== null &&
      existing?.lease_until !== undefined &&
      existing.lease_until > now
    ) {
      return {
        status: "retry",
        delaySeconds: Math.max(1, Math.ceil((existing.lease_until - now) / 1000)),
      };
    }

    // Pace only after a prior successful/attempted send window; first send is immediate.
    const paceDelaySeconds = this.paceDelaySeconds(now);
    if (paceDelaySeconds !== null) {
      return { status: "retry", delaySeconds: paceDelaySeconds };
    }

    const lock = this.ctx.storage.sql
      .exec<{ attempt_id: string; lease_until: number }>(
        "SELECT attempt_id, lease_until FROM send_locks WHERE id = ?",
        CHAT_LOCK_ID
      )
      .toArray()[0];
    if (lock && lock.lease_until > now) {
      return {
        status: "retry",
        delaySeconds: Math.max(1, Math.ceil((lock.lease_until - now) / 1000)),
      };
    }

    const attemptId = crypto.randomUUID();
    const leaseUntil = now + SEND_LEASE_MS;
    this.ctx.storage.sql.exec(
      `INSERT INTO send_locks (id, attempt_id, lease_until)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         attempt_id = excluded.attempt_id,
         lease_until = excluded.lease_until`,
      CHAT_LOCK_ID,
      attemptId,
      leaseUntil
    );

    if (!existing) {
      this.ctx.storage.sql.exec(
        `INSERT INTO sent_events (
          idempotency_key, chat_hash, method, status, created_at,
          lease_attempt_id, lease_until, attempts, permanent_error
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?, 1, 0)`,
        job.idempotencyKey,
        job.chatHash,
        job.method,
        now,
        attemptId,
        leaseUntil
      );
    } else {
      this.ctx.storage.sql.exec(
        `UPDATE sent_events
         SET status = 'pending',
             lease_attempt_id = ?,
             lease_until = ?,
             attempts = attempts + 1,
             permanent_error = 0
         WHERE idempotency_key = ?`,
        attemptId,
        leaseUntil,
        job.idempotencyKey
      );
    }

    try {
      const chatId = await decryptTelegramChatId(
        job.chatCiphertext,
        this.env.APP_MASTER_KEY
      );
      const token = this.env.SECRET_TELEGRAM_API_TOKEN;
      const result = await this.dispatchTelegram(token, chatId, job);

      const sentAt = Date.now();
      this.ctx.storage.sql.exec(
        `UPDATE sent_events
         SET status = 'sent',
             sent_at = ?,
             telegram_message_id = ?,
             lease_attempt_id = NULL,
             lease_until = NULL
         WHERE idempotency_key = ?
           AND lease_attempt_id = ?`,
        sentAt,
        result.messageId ?? null,
        job.idempotencyKey,
        attemptId
      );
      this.releaseChatLock(attemptId);
      this.scheduleNextAllowedSendAt(sentAt, MIN_SEND_INTERVAL_MS);
      await this.scheduleCleanupAlarm();

      const current = this.ctx.storage.sql
        .exec<TelegramOutboxSentRow>(
          `SELECT idempotency_key, status, telegram_message_id,
                  lease_attempt_id, lease_until, attempts, permanent_error
           FROM sent_events
           WHERE idempotency_key = ?`,
          job.idempotencyKey
        )
        .toArray()[0];

      if (current?.status !== "sent") {
        return { status: "retry", delaySeconds: 5 };
      }

      return {
        status: "sent",
        duplicate: false,
        telegramMessageId: current.telegram_message_id ?? result.messageId ?? null,
      };
    } catch (error) {
      const telegramError =
        error instanceof TelegramApiError
          ? error
          : (() => {
              logBotError("telegram-outbox:internal", error, {
                retryable: true,
                delaySeconds: 5,
              });
              return new TelegramApiError("Telegram send failed", false);
            })();
      const failedAt = Date.now();
      this.ctx.storage.sql.exec(
        `UPDATE sent_events
         SET status = 'failed',
             failed_at = ?,
             error_message = ?,
             permanent_error = ?,
             lease_attempt_id = NULL,
             lease_until = NULL
         WHERE idempotency_key = ?
           AND lease_attempt_id = ?`,
        failedAt,
        telegramError.message.slice(0, 200),
        telegramError.permanent ? 1 : 0,
        job.idempotencyKey,
        attemptId
      );
      if (telegramError.permanent) {
        logBotError("telegram-outbox:dispatch", telegramError, {
          permanent: true,
        });
        this.releaseChatLock(attemptId);
        await this.scheduleCleanupAlarm();
        return { status: "rejected", reason: "permanent" };
      }

      const delaySeconds =
        telegramError.retryAfterSeconds ?? GENERIC_RETRY_DELAY_SECONDS;
      const retryLeaseUntil = failedAt + delaySeconds * 1000;
      this.scheduleNextAllowedSendAt(
        failedAt,
        Math.max(MIN_SEND_INTERVAL_MS, delaySeconds * 1000)
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO send_locks (id, attempt_id, lease_until)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           lease_until = CASE
             WHEN send_locks.attempt_id = excluded.attempt_id
             THEN excluded.lease_until
             ELSE send_locks.lease_until
           END`,
        CHAT_LOCK_ID,
        attemptId,
        retryLeaseUntil
      );
      logBotError("telegram-outbox:dispatch", telegramError, {
        retryable: true,
        delaySeconds,
      });
      await this.scheduleCleanupAlarm();
      return { status: "retry", delaySeconds };
    }
  }

  private paceDelaySeconds(now: number): number | null {
    const row = this.ctx.storage.sql
      .exec<{ last_refill_at: number }>(
        "SELECT last_refill_at FROM rate_buckets WHERE scope = ?",
        CHAT_PACE_SCOPE
      )
      .toArray()[0];
    if (!row || row.last_refill_at <= now) {
      return null;
    }
    return Math.max(1, Math.ceil((row.last_refill_at - now) / 1000));
  }

  private scheduleNextAllowedSendAt(now: number, delayMs: number): void {
    const nextAt = now + delayMs;
    this.ctx.storage.sql.exec(
      `INSERT INTO rate_buckets (scope, tokens, last_refill_at, updated_at)
       VALUES (?, 0, ?, ?)
       ON CONFLICT(scope) DO UPDATE SET
         last_refill_at = MAX(rate_buckets.last_refill_at, excluded.last_refill_at),
         updated_at = excluded.updated_at`,
      CHAT_PACE_SCOPE,
      nextAt,
      now
    );
  }

  private releaseChatLock(attemptId: string): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM send_locks WHERE id = ? AND attempt_id = ?",
      CHAT_LOCK_ID,
      attemptId
    );
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
      const body = await this.readTelegramResponse(response);
      if (!response.ok || !body.ok) {
        throw this.toTelegramError(response.status, body, "sendMessage failed");
      }
      return { messageId: String(body.result?.message_id ?? "") };
    }

    const mediaMethodField: Partial<Record<TelegramOutboxJob["method"], string>> = {
      sendPhoto: "photo",
      sendVideo: "video",
      sendAnimation: "animation",
      sendDocument: "document",
      sendSticker: "sticker",
      sendVoice: "voice",
      sendVideoNote: "video_note",
      sendAudio: "audio",
    };
    const mediaField = mediaMethodField[job.method];
    if (mediaField) {
      const fileId = job.payload[mediaField as keyof typeof job.payload];
      if (typeof fileId !== "string" || !fileId) {
        throw new TelegramApiError("Missing media file id", true);
      }
      const response = await fetch(`${base}/${job.method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          [mediaField]: fileId,
          caption: job.payload.caption,
          parse_mode: job.payload.parse_mode,
          reply_markup: job.payload.reply_markup,
          reply_to_message_id: job.payload.reply_to_message_id,
        }),
      });
      const body = await this.readTelegramResponse(response);
      if (!response.ok || !body.ok) {
        throw this.toTelegramError(response.status, body, `${job.method} failed`);
      }
      return { messageId: String(body.result?.message_id ?? "") };
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
      const body = await this.readTelegramResponse(response);
      if (!response.ok || !body.ok) {
        throw this.toTelegramError(
          response.status,
          body,
          "answerCallbackQuery failed"
        );
      }
      return {};
    }

    throw new Error("Unsupported outbox method");
  }

  private async readTelegramResponse(response: Response): Promise<TelegramApiResponse> {
    try {
      return await response.json<TelegramApiResponse>();
    } catch {
      return {
        ok: false,
        description: `Telegram HTTP ${response.status}`,
        error_code: response.status,
      };
    }
  }

  private toTelegramError(
    httpStatus: number,
    body: TelegramApiResponse,
    defaultDescription: string
  ): TelegramApiError {
    const retryAfter = body.parameters?.retry_after;
    return new TelegramApiError(
      body.description ?? defaultDescription,
      isPermanentTelegramError(httpStatus, body.error_code),
      typeof retryAfter === "number" && Number.isFinite(retryAfter)
        ? Math.max(1, Math.ceil(retryAfter))
        : undefined
    );
  }

  private cleanupRetainedRows(now: number): void {
    this.ctx.storage.sql.exec(
      `DELETE FROM sent_events
       WHERE idempotency_key IN (
         SELECT idempotency_key FROM sent_events
         WHERE (
             status = 'sent'
             AND sent_at IS NOT NULL
             AND sent_at <= ?
           )
           OR (
             status = 'failed'
             AND failed_at IS NOT NULL
             AND failed_at <= ?
           )
         ORDER BY COALESCE(sent_at, failed_at) ASC
         LIMIT ${OUTBOX_CLEANUP_LIMIT}
       )`,
      now - OUTBOX_RETENTION_MS,
      now - OUTBOX_RETENTION_MS
    );

    this.ctx.storage.sql.exec(
      "DELETE FROM send_locks WHERE lease_until <= ?",
      now
    );
  }

  private async scheduleCleanupAlarm(): Promise<void> {
    const now = Date.now();
    const next = this.ctx.storage.sql
      .exec<{ due_at: number }>(
        `SELECT MIN(due_at) AS due_at FROM (
           SELECT sent_at + ? AS due_at FROM sent_events
           WHERE status = 'sent' AND sent_at IS NOT NULL
           UNION ALL
           SELECT failed_at + ? AS due_at FROM sent_events
           WHERE status = 'failed' AND failed_at IS NOT NULL
           UNION ALL
           SELECT lease_until AS due_at FROM send_locks
         )`,
        OUTBOX_RETENTION_MS,
        OUTBOX_RETENTION_MS
      )
      .toArray()[0];

    if (next?.due_at) {
      await this.ctx.storage.setAlarm(
        next.due_at <= now ? now + 1 : next.due_at
      );
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  override async alarm(): Promise<void> {
    this.cleanupRetainedRows(Date.now());
    await this.scheduleCleanupAlarm();
  }
}
