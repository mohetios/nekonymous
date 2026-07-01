import { DurableObject } from "cloudflare:workers";
import type { Environment, UserDraft } from "../types";
import type {
  AssessmentSessionStatus,
  InboxPointerStatus,
  UserDraftMode,
} from "../status";
import { isInboxPointerTransition } from "../status";
import { resolveProcessedEventClaim } from "./processed-events-policy";

const INBOX_MAX_TICKETS = 50;
const INBOX_PAGE_SIZE = 10;
const INBOX_CLEANUP_LIMIT = 10;
/** Minimum gap between user actions (messages, commands, inline buttons). */
const RATE_LIMIT_MS = 1000;
const RATE_LIMIT_SCOPE = "user_action";
const ASSESSMENT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ASSESSMENT_SESSION_ID = "current";
const PROCESSED_EVENT_LEASE_MS = 30 * 1000;
const PROCESSED_EVENT_DONE_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSED_EVENT_CLEANUP_LIMIT = 100;

type UserStateRow = {
  user_id: string;
  locale: string;
  locale_source: string;
  onboarding_completed: number;
  paused: number;
  display_name_ciphertext: string | null;
  created_at: number;
  updated_at: number;
};

type DraftRow = {
  id: string;
  mode: string;
  to_user_id: string | null;
  link_slug: string | null;
  reply_ref: string | null;
  parent_message_id: number | null;
  reply_to_message_id: number | null;
  pending_nickname_alias: string | null;
  pending_settings: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
};

type AssessmentSessionRow = {
  id: string;
  version: string;
  status: AssessmentSessionStatus;
  current_index: number;
  total_questions: number;
  answers_json: string;
  attempt_id: string | null;
  started_at: number;
  updated_at: number;
  expires_at: number | null;
};

type InboxPointerRow = {
  ticket_hash: string;
  sealed_ref_enc: string;
  display_number: string;
  status: InboxPointerStatus;
  created_bucket: number;
  created_at: number;
  expires_at: number;
  delivered_at: number | null;
  dedupe_key: string | null;
};

type ProcessedEventRow = {
  key: string;
  status: "processing" | "done" | "failed";
  lease_until: number | null;
  attempts: number;
  created_at: number;
  updated_at: number;
  expires_at: number;
};

const rowToDraft = (row: DraftRow): UserDraft => ({
  id: row.id,
  mode: row.mode as UserDraftMode,
  ...(row.to_user_id ? { toUserId: row.to_user_id } : {}),
  ...(row.link_slug ? { linkSlug: row.link_slug } : {}),
  ...(row.reply_ref ? { replyRef: row.reply_ref } : {}),
  ...(row.parent_message_id !== null
    ? { parent_message_id: row.parent_message_id }
    : {}),
  ...(row.reply_to_message_id !== null
    ? { reply_to_message_id: row.reply_to_message_id }
    : {}),
  ...(row.pending_nickname_alias
    ? { pendingNicknameAlias: row.pending_nickname_alias }
    : {}),
  ...(row.pending_settings
    ? {
        pendingSettings: row.pending_settings as UserDraft["pendingSettings"],
      }
    : {}),
});

export class UserStateDurableObject extends DurableObject<Environment> {
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
      );

      CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT PRIMARY KEY,
        locale TEXT NOT NULL DEFAULT 'fa',
        locale_source TEXT NOT NULL DEFAULT 'fallback',
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        paused INTEGER NOT NULL DEFAULT 0,
        display_name_ciphertext TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        to_user_id TEXT,
        link_slug TEXT,
        reply_ref TEXT,
        parent_message_id INTEGER,
        reply_to_message_id INTEGER,
        pending_nickname_alias TEXT,
        pending_settings TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at);

      CREATE TABLE IF NOT EXISTS inbox_pointers (
        ticket_hash TEXT PRIMARY KEY,
        sealed_ref_enc TEXT NOT NULL,
        display_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_bucket INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        delivered_at INTEGER,
        replied_at INTEGER,
        blocked_at INTEGER,
        reported_at INTEGER,
        deleted_at INTEGER,
        expires_at INTEGER NOT NULL,
        dedupe_key TEXT UNIQUE
      );

      CREATE INDEX IF NOT EXISTS idx_inbox_status_created
        ON inbox_pointers(status, created_at);

      CREATE INDEX IF NOT EXISTS idx_inbox_created
        ON inbox_pointers(created_at);

      CREATE INDEX IF NOT EXISTS idx_inbox_expires
        ON inbox_pointers(expires_at);

      CREATE TABLE IF NOT EXISTS blocks (
        blocked_user_id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contact_labels (
        alias TEXT PRIMARY KEY,
        target_user_id TEXT NOT NULL,
        nickname_ciphertext TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        scope TEXT PRIMARY KEY,
        tokens REAL,
        last_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processed_events (
        key TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'processing',
        lease_until INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_processed_events_expires
        ON processed_events(expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_processed_events_lease
        ON processed_events(status, lease_until);

      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_index INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL,
        answers_json TEXT NOT NULL DEFAULT '{}',
        attempt_id TEXT,
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);

    // Backward-compatible column backfill for already-created DO databases.
    try {
      this.ctx.storage.sql.exec(
        "ALTER TABLE processed_events ADD COLUMN status TEXT NOT NULL DEFAULT 'processing'"
      );
    } catch {
      // column already exists
    }
    try {
      this.ctx.storage.sql.exec(
        "ALTER TABLE processed_events ADD COLUMN lease_until INTEGER"
      );
    } catch {
      // column already exists
    }
    try {
      this.ctx.storage.sql.exec(
        "ALTER TABLE processed_events ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0"
      );
    } catch {
      // column already exists
    }
    try {
      this.ctx.storage.sql.exec(
        "ALTER TABLE processed_events ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0"
      );
    } catch {
      // column already exists
    }
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/init") {
      return this.initState(request);
    }
    if (request.method === "GET" && pathname === "/state") {
      return this.getState();
    }
    if (request.method === "POST" && pathname === "/set-paused") {
      return this.setPaused(request);
    }
    if (request.method === "POST" && pathname === "/set-display-name") {
      return this.setDisplayName(request);
    }
    if (request.method === "POST" && pathname === "/set-draft") {
      return this.setDraft(request);
    }
    if (request.method === "GET" && pathname === "/draft") {
      return this.getDraft();
    }
    if (request.method === "POST" && pathname === "/clear-draft") {
      return this.clearDraft();
    }
    if (request.method === "POST" && pathname === "/check-can-receive") {
      return this.checkCanReceive(request);
    }
    if (request.method === "POST" && pathname === "/consume-rate-limit") {
      return this.consumeRateLimit();
    }
    if (request.method === "POST" && pathname === "/processed-events/claim") {
      return this.claimProcessedEvent(request);
    }
    if (request.method === "POST" && pathname === "/processed-events/complete") {
      return this.completeProcessedEvent(request);
    }
    if (request.method === "POST" && pathname === "/processed-events/fail") {
      return this.failProcessedEvent(request);
    }
    if (request.method === "POST" && pathname === "/add-inbox-pointer") {
      return this.addInboxPointer(request);
    }
    if (request.method === "GET" && pathname === "/inbox-page") {
      return this.inboxPage(request);
    }
    if (request.method === "POST" && pathname === "/mark-inbox-status") {
      return this.markInboxStatus(request);
    }
    if (request.method === "POST" && pathname === "/add-block") {
      return this.addBlock(request);
    }
    if (request.method === "POST" && pathname === "/remove-block") {
      return this.removeBlock(request);
    }
    if (request.method === "POST" && pathname === "/clear-blocks") {
      return this.clearBlocks();
    }
    if (request.method === "POST" && pathname === "/set-label") {
      return this.setLabel(request);
    }
    if (request.method === "POST" && pathname === "/mark-reported") {
      return this.markReported(request);
    }
    if (request.method === "DELETE" && pathname === "/purge") {
      return this.purge();
    }
    if (request.method === "POST" && pathname === "/assessment/start") {
      return this.startAssessmentSession(request);
    }
    if (request.method === "GET" && pathname === "/assessment/session") {
      return this.getAssessmentSession();
    }
    if (request.method === "POST" && pathname === "/assessment/answer") {
      return this.saveAssessmentAnswer(request);
    }
    if (request.method === "POST" && pathname === "/assessment/set-current-index") {
      return this.setAssessmentCurrentIndex(request);
    }
    if (request.method === "POST" && pathname === "/assessment/complete") {
      return this.completeAssessmentSession();
    }
    if (request.method === "POST" && pathname === "/assessment/cancel") {
      return this.cancelAssessmentSession();
    }
    if (request.method === "DELETE" && pathname === "/assessment/reset") {
      return this.resetAssessmentSession();
    }

    return new Response("Not Found", { status: 404 });
  }

  private getUserId(): string | null {
    const rows = this.ctx.storage.sql
      .exec<{ user_id: string }>("SELECT user_id FROM user_state LIMIT 1")
      .toArray();
    return rows[0]?.user_id ?? null;
  }

  private async initState(request: Request): Promise<Response> {
    const body = await request.json<{
      userId: string;
      displayNameCiphertext?: string;
    }>();

    if (!body.userId) {
      return new Response("Missing userId", { status: 400 });
    }

    const existing = this.getUserId();
    if (existing) {
      return Response.json({ ok: true, existing: true });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO user_state (
        user_id, display_name_ciphertext, created_at, updated_at
      ) VALUES (?, ?, ?, ?)`,
      body.userId,
      body.displayNameCiphertext ?? null,
      now,
      now
    );

    return Response.json({ ok: true });
  }

  private getState(): Response {
    const rows = this.ctx.storage.sql
      .exec<UserStateRow>("SELECT * FROM user_state LIMIT 1")
      .toArray();
    const state = rows[0];
    if (!state) {
      return new Response("Not initialized", { status: 404 });
    }

    const draftRows = this.ctx.storage.sql
      .exec<DraftRow>(
        "SELECT * FROM drafts ORDER BY updated_at DESC LIMIT 1"
      )
      .toArray();

    const blocks = this.ctx.storage.sql
      .exec<{ blocked_user_id: string }>(
        "SELECT blocked_user_id FROM blocks ORDER BY created_at ASC"
      )
      .toArray()
      .map((row) => row.blocked_user_id);

    const labels = this.ctx.storage.sql
      .exec<{
        alias: string;
        target_user_id: string;
        nickname_ciphertext: string;
      }>("SELECT alias, target_user_id, nickname_ciphertext FROM contact_labels")
      .toArray();

    const rateRow = this.ctx.storage.sql
      .exec<{ last_at: number }>(
        "SELECT last_at FROM rate_limits WHERE scope = ?",
        RATE_LIMIT_SCOPE
      )
      .toArray()[0];

    return Response.json({
      paused: !!state.paused,
      displayNameCiphertext: state.display_name_ciphertext,
      draft: draftRows[0] ? rowToDraft(draftRows[0]) : null,
      blockedUserIds: blocks,
      labels,
      lastMessageAt: rateRow?.last_at,
    });
  }

  private async setPaused(request: Request): Promise<Response> {
    const { paused } = await request.json<{ paused: boolean }>();
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET paused = ?, updated_at = ?",
      paused ? 1 : 0,
      now
    );
    return Response.json({ ok: true });
  }

  private async setDisplayName(request: Request): Promise<Response> {
    const { ciphertext } = await request.json<{ ciphertext: string }>();
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET display_name_ciphertext = ?, updated_at = ?",
      ciphertext,
      now
    );
    return Response.json({ ok: true });
  }

  private async setDraft(request: Request): Promise<Response> {
    const body = await request.json<UserDraft & { id?: string }>();
    const now = Date.now();
    const draftId = body.id ?? "primary";

    this.ctx.storage.sql.exec("DELETE FROM drafts");

    this.ctx.storage.sql.exec(
      `INSERT INTO drafts (
        id, mode, to_user_id, link_slug, reply_ref,
        parent_message_id, reply_to_message_id,
        pending_nickname_alias, pending_settings,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      draftId,
      body.mode,
      body.toUserId ?? null,
      body.linkSlug ?? null,
      body.replyRef ?? null,
      body.parent_message_id ?? null,
      body.reply_to_message_id ?? null,
      body.pendingNicknameAlias ?? null,
      body.pendingSettings ?? null,
      now,
      now
    );

    return Response.json({ ok: true });
  }

  private getDraft(): Response {
    const rows = this.ctx.storage.sql
      .exec<DraftRow>("SELECT * FROM drafts ORDER BY updated_at DESC LIMIT 1")
      .toArray();
    return Response.json({ draft: rows[0] ? rowToDraft(rows[0]) : null });
  }

  private clearDraft(): Response {
    this.ctx.storage.sql.exec("DELETE FROM drafts");
    return Response.json({ ok: true });
  }

  private async checkCanReceive(request: Request): Promise<Response> {
    const { senderUserId } = await request.json<{ senderUserId: string }>();
    const state = this.ctx.storage.sql
      .exec<UserStateRow>("SELECT paused FROM user_state LIMIT 1")
      .toArray()[0];

    if (state?.paused) {
      return Response.json({ ok: false, reason: "paused" });
    }

    const blocked = this.ctx.storage.sql
      .exec<{ blocked_user_id: string }>(
        "SELECT blocked_user_id FROM blocks WHERE blocked_user_id = ?",
        senderUserId
      )
      .toArray();

    if (blocked.length > 0) {
      return Response.json({ ok: false, reason: "blocked" });
    }

    return Response.json({ ok: true });
  }

  private consumeRateLimit(): Response {
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<{ last_at: number }>(
        "SELECT last_at FROM rate_limits WHERE scope = ?",
        RATE_LIMIT_SCOPE
      )
      .toArray()[0];

    if (row !== undefined && now - row.last_at < RATE_LIMIT_MS) {
      return Response.json({ limited: true });
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO rate_limits (scope, tokens, last_at, updated_at)
       VALUES (?, 0, ?, ?)
       ON CONFLICT(scope) DO UPDATE SET last_at = excluded.last_at, updated_at = excluded.updated_at`,
      RATE_LIMIT_SCOPE,
      now,
      now
    );
    return Response.json({ limited: false });
  }

  private cleanupProcessedEvents(now: number): void {
    this.ctx.storage.sql.exec(
      `DELETE FROM processed_events
       WHERE key IN (
         SELECT key FROM processed_events
         WHERE expires_at <= ?
         ORDER BY expires_at ASC
         LIMIT ${PROCESSED_EVENT_CLEANUP_LIMIT}
       )`,
      now
    );
  }

  private async claimProcessedEvent(request: Request): Promise<Response> {
    const body = await request.json<{ eventKey?: string; leaseMs?: number }>();
    const eventKey = body.eventKey?.trim();
    const leaseMs =
      typeof body.leaseMs === "number" && Number.isFinite(body.leaseMs)
        ? Math.max(1000, Math.min(24 * 60 * 60 * 1000, Math.floor(body.leaseMs)))
        : PROCESSED_EVENT_LEASE_MS;

    if (!eventKey || eventKey.length > 128) {
      return new Response("Invalid event key", { status: 400 });
    }

    const now = Date.now();
    this.cleanupProcessedEvents(now);
    const leaseUntil = now + leaseMs;
    const expiresAt = now + PROCESSED_EVENT_DONE_TTL_MS;
    const existing = this.ctx.storage.sql
      .exec<ProcessedEventRow>(
        `SELECT key, status, lease_until, attempts, created_at, updated_at, expires_at
         FROM processed_events
         WHERE key = ?`,
        eventKey
      )
      .toArray()[0];

    const claimState = resolveProcessedEventClaim(
      existing
        ? {
            status: existing.status,
            leaseUntil: existing.lease_until,
            expiresAt: existing.expires_at,
          }
        : null,
      now
    );

    if (claimState === "done") {
      return Response.json({ state: "done" as const });
    }

    if (claimState === "processing") {
      return Response.json({ state: "processing" as const });
    }

    if (!existing) {
      this.ctx.storage.sql.exec(
        `INSERT INTO processed_events (
          key, status, lease_until, attempts, created_at, updated_at, expires_at
        ) VALUES (?, 'processing', ?, 1, ?, ?, ?)`,
        eventKey,
        leaseUntil,
        now,
        now,
        expiresAt
      );
      return Response.json({ state: "acquired" as const });
    }

    this.ctx.storage.sql.exec(
      `UPDATE processed_events
       SET status = 'processing',
           lease_until = ?,
           attempts = attempts + 1,
           updated_at = ?,
           expires_at = ?
       WHERE key = ?`,
      leaseUntil,
      now,
      expiresAt,
      eventKey
    );
    return Response.json({ state: "acquired" as const });
  }

  private async completeProcessedEvent(request: Request): Promise<Response> {
    const body = await request.json<{ eventKey?: string }>();
    const eventKey = body.eventKey?.trim();
    if (!eventKey || eventKey.length > 128) {
      return new Response("Invalid event key", { status: 400 });
    }
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `UPDATE processed_events
       SET status = 'done',
           lease_until = NULL,
           updated_at = ?,
           expires_at = ?
       WHERE key = ?`,
      now,
      now + PROCESSED_EVENT_DONE_TTL_MS,
      eventKey
    );
    return Response.json({ ok: true });
  }

  private async failProcessedEvent(request: Request): Promise<Response> {
    const body = await request.json<{ eventKey?: string }>();
    const eventKey = body.eventKey?.trim();
    if (!eventKey || eventKey.length > 128) {
      return new Response("Invalid event key", { status: 400 });
    }
    this.ctx.storage.sql.exec(
      `DELETE FROM processed_events WHERE key = ?`,
      eventKey
    );
    return Response.json({ ok: true });
  }

  private async addInboxPointer(request: Request): Promise<Response> {
    const body = await request.json<{
      ticketHash: string;
      sealedTicketRef: string;
      displayNumber: string;
      createdBucket: number;
      createdAt: number;
      expiresAt: number;
      dedupeKey: string;
    }>();

    if (
      !body.ticketHash ||
      !body.sealedTicketRef ||
      !body.displayNumber ||
      !Number.isSafeInteger(body.createdBucket) ||
      !Number.isSafeInteger(body.createdAt) ||
      !Number.isSafeInteger(body.expiresAt) ||
      body.expiresAt <= body.createdAt
    ) {
      return new Response("Invalid inbox pointer", { status: 400 });
    }

    if (body.dedupeKey) {
      const existing = this.ctx.storage.sql
        .exec<{ ticket_hash: string }>(
          "SELECT ticket_hash FROM inbox_pointers WHERE dedupe_key = ?",
          body.dedupeKey
        )
        .toArray();
      if (existing.length > 0) {
        const pending = this.activeCount();
        return Response.json({ ok: true, duplicate: true, pendingCount: pending });
      }
    }

    this.cleanupExpiredPointers();

    const active = this.activeCount();
    if (active >= INBOX_MAX_TICKETS) {
      return new Response("Inbox full", { status: 429 });
    }

    const total = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM inbox_pointers")
      .one().count;

    if (total >= INBOX_MAX_TICKETS) {
      this.ctx.storage.sql.exec(
        `DELETE FROM inbox_pointers
         WHERE ticket_hash IN (
           SELECT ticket_hash FROM inbox_pointers
           WHERE status != 'active'
           ORDER BY created_at ASC
           LIMIT ?
         )`,
        total - INBOX_MAX_TICKETS + 1
      );
    }

    const now = Date.now();
    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO inbox_pointers (
          ticket_hash, sealed_ref_enc, display_number, status,
          created_bucket, created_at, expires_at, dedupe_key
        ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
        body.ticketHash,
        body.sealedTicketRef,
        body.displayNumber,
        body.createdBucket,
        body.createdAt || now,
        body.expiresAt,
        body.dedupeKey
      );
    } catch {
      const pendingAfter = this.activeCount();
      return Response.json({ ok: true, duplicate: true, pendingCount: pendingAfter });
    }

    return Response.json({
      ok: true,
      pendingCount: this.activeCount(),
    });
  }

  private activeCount(): number {
    return this.ctx.storage.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM inbox_pointers WHERE status = 'active' AND expires_at > ?",
        Date.now()
      )
      .one().count;
  }

  private cleanupExpiredPointers(): string[] {
    const now = Date.now();
    const rows = this.ctx.storage.sql
      .exec<{ ticket_hash: string }>(
        `SELECT ticket_hash FROM inbox_pointers
         WHERE expires_at <= ?
         ORDER BY expires_at ASC
         LIMIT ${INBOX_CLEANUP_LIMIT}`,
        now
      )
      .toArray();

    if (rows.length === 0) {
      return [];
    }

    const placeholders = rows.map(() => "?").join(",");
    this.ctx.storage.sql.exec(
      `DELETE FROM inbox_pointers WHERE ticket_hash IN (${placeholders})`,
      ...rows.map((row) => row.ticket_hash)
    );
    return rows.map((row) => row.ticket_hash);
  }

  private inboxPage(request: Request): Response {
    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
    const expiredTicketHashes = this.cleanupExpiredPointers();
    const rows = this.ctx.storage.sql
      .exec<InboxPointerRow>(
        `SELECT ticket_hash, sealed_ref_enc, display_number, status,
                created_bucket, created_at, expires_at, delivered_at, dedupe_key
         FROM inbox_pointers
         WHERE expires_at > ?
           AND status = 'active'
         ORDER BY created_at ASC
         LIMIT ${INBOX_PAGE_SIZE + 1}
         OFFSET ?`,
        Date.now(),
        offset
      )
      .toArray();

    const pageRows = rows.slice(0, INBOX_PAGE_SIZE);
    const nextOffset =
      rows.length > INBOX_PAGE_SIZE ? offset + INBOX_PAGE_SIZE : undefined;

    return Response.json({
      pointers: pageRows.map((row) => ({
        ticketHash: row.ticket_hash,
        sealedTicketRef: row.sealed_ref_enc,
        displayNumber: row.display_number,
        status: row.status,
        createdBucket: row.created_bucket,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })),
      ...(nextOffset !== undefined ? { nextOffset } : {}),
      expiredTicketHashes,
    });
  }

  private async markInboxStatus(request: Request): Promise<Response> {
    const { ticketHash, status } = await request.json<{
      ticketHash: string;
      status: string;
    }>();
    if (!isInboxPointerTransition(status)) {
      return new Response("Invalid status", { status: 400 });
    }
    const now = Date.now();
    const timestampColumn =
      status === "viewed"
        ? "delivered_at"
        : status === "replied"
          ? "replied_at"
          : status === "blocked"
            ? "blocked_at"
            : "reported_at";
    this.ctx.storage.sql.exec(
      `UPDATE inbox_pointers
       SET status = ?, ${timestampColumn} = ?
       WHERE ticket_hash = ?`,
      status,
      now,
      ticketHash
    );
    return Response.json({ ok: true });
  }

  private async addBlock(request: Request): Promise<Response> {
    const { blockedUserId } = await request.json<{ blockedUserId: string }>();
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO blocks (blocked_user_id, created_at) VALUES (?, ?)`,
      blockedUserId,
      now
    );
    return Response.json({ ok: true });
  }

  private async removeBlock(request: Request): Promise<Response> {
    const { blockedUserId } = await request.json<{ blockedUserId: string }>();
    this.ctx.storage.sql.exec(
      "DELETE FROM blocks WHERE blocked_user_id = ?",
      blockedUserId
    );
    return Response.json({ ok: true });
  }

  private clearBlocks(): Response {
    this.ctx.storage.sql.exec("DELETE FROM blocks");
    return Response.json({ ok: true });
  }

  private async setLabel(request: Request): Promise<Response> {
    const body = await request.json<{
      alias: string;
      targetUserId: string;
      nicknameCiphertext: string | null;
    }>();
    const now = Date.now();

    if (!body.nicknameCiphertext) {
      this.ctx.storage.sql.exec(
        "DELETE FROM contact_labels WHERE alias = ?",
        body.alias
      );
      return Response.json({ ok: true });
    }

    const count = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM contact_labels")
      .one().count;

    const exists = this.ctx.storage.sql
      .exec<{ alias: string }>(
        "SELECT alias FROM contact_labels WHERE alias = ?",
        body.alias
      )
      .toArray();

    if (!exists.length && count >= 200) {
      return new Response("Label limit", { status: 429 });
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO contact_labels (alias, target_user_id, nickname_ciphertext, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(alias) DO UPDATE SET
         nickname_ciphertext = excluded.nickname_ciphertext,
         updated_at = excluded.updated_at`,
      body.alias,
      body.targetUserId,
      body.nicknameCiphertext,
      now,
      now
    );

    return Response.json({ ok: true });
  }

  private async markReported(request: Request): Promise<Response> {
    const { ticketHash } = await request.json<{ ticketHash: string }>();
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE inbox_pointers SET reported_at = ? WHERE ticket_hash = ?",
      now,
      ticketHash
    );
    return Response.json({ ok: true });
  }

  private parseAnswersJson(json: string): Record<string, number> {
    try {
      return JSON.parse(json) as Record<string, number>;
    } catch {
      return {};
    }
  }

  private parseAssessmentSession(row: AssessmentSessionRow) {
    const answers = this.parseAnswersJson(row.answers_json);

    return {
      id: row.id,
      version: row.version,
      status: row.status,
      currentIndex: row.current_index,
      totalQuestions: row.total_questions,
      answers,
      attemptId: row.attempt_id,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  private getActiveAssessmentSessionRow(): AssessmentSessionRow | null {
    const rows = this.ctx.storage.sql
      .exec<AssessmentSessionRow>(
        `SELECT * FROM assessment_sessions
         WHERE status = 'active'
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .toArray();

    const row = rows[0];
    if (!row) {
      return null;
    }

    if (row.expires_at !== null && Date.now() > row.expires_at) {
      this.ctx.storage.sql.exec("DELETE FROM assessment_sessions WHERE id = ?", row.id);
      return null;
    }

    return row;
  }

  private async startAssessmentSession(request: Request): Promise<Response> {
    const body = await request.json<{
      version: string;
      totalQuestions: number;
      attemptId: string;
    }>();

    if (!body.version || !body.totalQuestions || !body.attemptId) {
      return new Response("Missing fields", { status: 400 });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM assessment_sessions");

    this.ctx.storage.sql.exec(
      `INSERT INTO assessment_sessions (
        id, version, status, current_index, total_questions, answers_json,
        attempt_id, started_at, updated_at, expires_at
      ) VALUES (?, ?, 'active', 0, ?, '{}', ?, ?, ?, ?)`,
      ASSESSMENT_SESSION_ID,
      body.version,
      body.totalQuestions,
      body.attemptId,
      now,
      now,
      now + ASSESSMENT_SESSION_TTL_MS
    );

    return Response.json({ ok: true });
  }

  private getAssessmentSession(): Response {
    const row = this.getActiveAssessmentSessionRow();
    if (!row) {
      return Response.json({ session: null });
    }

    return Response.json({ session: this.parseAssessmentSession(row) });
  }

  private async saveAssessmentAnswer(request: Request): Promise<Response> {
    const body = await request.json<{
      questionId: string;
      answerValue: number;
      currentIndex?: number;
    }>();

    const row = this.getActiveAssessmentSessionRow();
    if (!row) {
      return new Response("No active session", { status: 404 });
    }

    if (
      !body.questionId ||
      body.answerValue < 1 ||
      body.answerValue > 5
    ) {
      return new Response("Invalid answer", { status: 400 });
    }

    const answers = this.parseAnswersJson(row.answers_json);
    answers[body.questionId] = body.answerValue;

    const nextIndex =
      body.currentIndex !== undefined
        ? body.currentIndex + 1
        : row.current_index + 1;
    const now = Date.now();

    this.ctx.storage.sql.exec(
      `UPDATE assessment_sessions
       SET answers_json = ?, current_index = ?, updated_at = ?
       WHERE id = ?`,
      JSON.stringify(answers),
      Math.min(nextIndex, row.total_questions),
      now,
      row.id
    );

    return Response.json({ ok: true, answers, currentIndex: nextIndex });
  }

  private async setAssessmentCurrentIndex(request: Request): Promise<Response> {
    const { currentIndex } = await request.json<{ currentIndex: number }>();
    const row = this.getActiveAssessmentSessionRow();
    if (!row) {
      return new Response("No active session", { status: 404 });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE assessment_sessions SET current_index = ?, updated_at = ? WHERE id = ?",
      Math.max(0, currentIndex),
      now,
      row.id
    );

    return Response.json({ ok: true });
  }

  private completeAssessmentSession(): Response {
    const row = this.getActiveAssessmentSessionRow();
    if (!row) {
      return new Response("No active session", { status: 404 });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE assessment_sessions SET status = 'completed', updated_at = ? WHERE id = ?",
      now,
      row.id
    );

    return Response.json({ ok: true });
  }

  private cancelAssessmentSession(): Response {
    const row = this.getActiveAssessmentSessionRow();
    if (!row) {
      return Response.json({ ok: true });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE assessment_sessions SET updated_at = ? WHERE id = ?",
      now,
      row.id
    );

    return Response.json({ ok: true });
  }

  private resetAssessmentSession(): Response {
    this.ctx.storage.sql.exec("DELETE FROM assessment_sessions");
    return Response.json({ ok: true });
  }

  private async purge(): Promise<Response> {
    this.ctx.storage.sql.exec(`
      DELETE FROM processed_events;
      DELETE FROM rate_limits;
      DELETE FROM contact_labels;
      DELETE FROM blocks;
      DELETE FROM inbox_pointers;
      DELETE FROM drafts;
      DELETE FROM assessment_sessions;
      DELETE FROM user_state;
    `);
    await this.ctx.storage.deleteAll();
    return Response.json({ ok: true });
  }
}
