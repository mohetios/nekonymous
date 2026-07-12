import { DurableObject } from "cloudflare:workers";
import type { Environment, UserDraft } from "../types";
import type {
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
const PROCESSED_EVENT_LEASE_MS = 30 * 1000;
const PROCESSED_EVENT_DONE_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSED_EVENT_CLEANUP_LIMIT = 100;
const PROFILE_SESSION_ID = "active";
const PROFILE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SUGGESTION_SEARCH_SCOPE = "suggestion_search";
const SUGGESTION_SEARCH_LIMIT = 50;
const SUGGESTION_SEARCH_WINDOW_MS = 60 * 60 * 1000;
const EXPOSURE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type UserStateRow = {
  user_id: string;
  locale: string;
  locale_source: string;
  onboarding_completed: number;
  paused: number;
  display_name_ciphertext: string | null;
  discoverable: number;
  profile_capability_enc: string | null;
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

type ProfileSessionRow = {
  id: string;
  version: string;
  status: string;
  current_index: number;
  total_questions: number;
  answers_enc: string;
  profile_capability_enc: string | null;
  started_at: number;
  updated_at: number;
  expires_at: number | null;
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

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);

    this.ctx.storage.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_processed_events_lease
       ON processed_events(status, lease_until)`
    );

    this.ensureConversationV2UserStateSchema();
  }

  private ensureConversationV2UserStateSchema(): void {
    const applied = this.ctx.storage.sql
      .exec<{ id: number }>(
        "SELECT id FROM _sql_schema_migrations WHERE id = 2 LIMIT 1"
      )
      .toArray();
    if (applied.length > 0) {
      return;
    }

    this.ctx.storage.sql.exec(`
      ALTER TABLE user_state ADD COLUMN discoverable INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE user_state ADD COLUMN profile_capability_enc TEXT;

      CREATE TABLE IF NOT EXISTS profile_sessions (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_index INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL,
        answers_enc TEXT NOT NULL DEFAULT '',
        profile_capability_enc TEXT,
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_profile_sessions_status
        ON profile_sessions(status, updated_at);

      CREATE TABLE IF NOT EXISTS exposure_tokens (
        token_hash TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_exposure_tokens_expires
        ON exposure_tokens(expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (2);
    `);
  }

  private getUserId(): string | null {
    const rows = this.ctx.storage.sql
      .exec<{ user_id: string }>("SELECT user_id FROM user_state LIMIT 1")
      .toArray();
    return rows[0]?.user_id ?? null;
  }

  initState(userId: string, displayNameCiphertext?: string): {
    ok: boolean;
    existing?: boolean;
  } {
    if (!userId) {
      return { ok: false };
    }

    const existing = this.getUserId();
    if (existing) {
      return { ok: true, existing: true };
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO user_state (
        user_id, display_name_ciphertext, created_at, updated_at
      ) VALUES (?, ?, ?, ?)`,
      userId,
      displayNameCiphertext ?? null,
      now,
      now
    );

    return { ok: true };
  }

  getState(): {
    paused: boolean;
    displayNameCiphertext: string | null;
    discoverable: boolean;
    profileCapabilityEnc: string | null;
    draft: UserDraft | null;
    blockedUserIds: string[];
    labels: Array<{
      alias: string;
      target_user_id: string;
      nickname_ciphertext: string;
    }>;
    lastMessageAt?: number;
  } | null {
    const rows = this.ctx.storage.sql
      .exec<UserStateRow>("SELECT * FROM user_state LIMIT 1")
      .toArray();
    const state = rows[0];
    if (!state) {
      return null;
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

    return {
      paused: !!state.paused,
      displayNameCiphertext: state.display_name_ciphertext,
      discoverable: !!state.discoverable,
      profileCapabilityEnc: state.profile_capability_enc,
      draft: draftRows[0] ? rowToDraft(draftRows[0]) : null,
      blockedUserIds: blocks,
      labels,
      lastMessageAt: rateRow?.last_at,
    };
  }

  setPaused(paused: boolean): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET paused = ?, updated_at = ?",
      paused ? 1 : 0,
      now
    );
  }

  setDisplayName(ciphertext: string): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET display_name_ciphertext = ?, updated_at = ?",
      ciphertext,
      now
    );
  }

  setDraft(body: UserDraft & { id?: string }): void {
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
  }

  getDraft(): UserDraft | null {
    const rows = this.ctx.storage.sql
      .exec<DraftRow>("SELECT * FROM drafts ORDER BY updated_at DESC LIMIT 1")
      .toArray();
    return rows[0] ? rowToDraft(rows[0]) : null;
  }

  clearDraft(): void {
    this.ctx.storage.sql.exec("DELETE FROM drafts");
  }

  checkCanReceive(senderUserId: string): { ok: boolean; reason?: string } {
    const state = this.ctx.storage.sql
      .exec<UserStateRow>("SELECT paused FROM user_state LIMIT 1")
      .toArray()[0];

    if (state?.paused) {
      return { ok: false, reason: "paused" };
    }

    const blocked = this.ctx.storage.sql
      .exec<{ blocked_user_id: string }>(
        "SELECT blocked_user_id FROM blocks WHERE blocked_user_id = ?",
        senderUserId
      )
      .toArray();

    if (blocked.length > 0) {
      return { ok: false, reason: "blocked" };
    }

    return { ok: true };
  }

  consumeRateLimit(): { limited: boolean } {
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<{ last_at: number }>(
        "SELECT last_at FROM rate_limits WHERE scope = ?",
        RATE_LIMIT_SCOPE
      )
      .toArray()[0];

    if (row !== undefined && now - row.last_at < RATE_LIMIT_MS) {
      return { limited: true };
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO rate_limits (scope, tokens, last_at, updated_at)
       VALUES (?, 0, ?, ?)
       ON CONFLICT(scope) DO UPDATE SET last_at = excluded.last_at, updated_at = excluded.updated_at`,
      RATE_LIMIT_SCOPE,
      now,
      now
    );
    return { limited: false };
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

  claimProcessedEvent(
    rawEventKey: string,
    leaseMsInput?: number
  ): { state: "acquired" | "processing" | "done" } | { error: "invalid_event_key" } {
    const eventKey = rawEventKey?.trim();
    const leaseMs =
      typeof leaseMsInput === "number" && Number.isFinite(leaseMsInput)
        ? Math.max(1000, Math.min(24 * 60 * 60 * 1000, Math.floor(leaseMsInput)))
        : PROCESSED_EVENT_LEASE_MS;

    if (!eventKey || eventKey.length > 128) {
      return { error: "invalid_event_key" };
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
      return { state: "done" as const };
    }

    if (claimState === "processing") {
      return { state: "processing" as const };
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
      return { state: "acquired" as const };
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
    return { state: "acquired" as const };
  }

  completeProcessedEvent(rawEventKey: string): void {
    const eventKey = rawEventKey?.trim();
    if (!eventKey || eventKey.length > 128) {
      return;
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
  }

  failProcessedEvent(rawEventKey: string): void {
    const eventKey = rawEventKey?.trim();
    if (!eventKey || eventKey.length > 128) {
      return;
    }
    this.ctx.storage.sql.exec(
      `DELETE FROM processed_events WHERE key = ?`,
      eventKey
    );
  }

  addInboxPointer(body: {
      ticketHash: string;
      sealedTicketRef: string;
      displayNumber: string;
      createdBucket: number;
      createdAt: number;
      expiresAt: number;
      dedupeKey: string;
    }): {
      ok: boolean;
      reason?: "full" | "invalid";
      pendingCount?: number;
      duplicate?: boolean;
      evictedTicketHashes?: string[];
    } {

    if (
      !body.ticketHash ||
      !body.sealedTicketRef ||
      !body.displayNumber ||
      !Number.isSafeInteger(body.createdBucket) ||
      !Number.isSafeInteger(body.createdAt) ||
      !Number.isSafeInteger(body.expiresAt) ||
      body.expiresAt <= body.createdAt
    ) {
      return { ok: false, reason: "invalid" };
    }

    if (body.dedupeKey) {
      const existing = this.ctx.storage.sql
        .exec<{ ticket_hash: string }>(
          "SELECT ticket_hash FROM inbox_pointers WHERE dedupe_key = ?",
          body.dedupeKey
        )
        .toArray();
      if (existing.length > 0) {
        const pending = this.unreadInboxCount();
        return { ok: true, duplicate: true, pendingCount: pending };
      }
    }

    const evictedTicketHashes = this.cleanupExpiredPointers();

    const active = this.unreadInboxCount();
    if (active >= INBOX_MAX_TICKETS) {
      return { ok: false, reason: "full" };
    }

    const total = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM inbox_pointers")
      .one().count;

    if (total >= INBOX_MAX_TICKETS) {
      const removable = this.ctx.storage.sql
        .exec<{ ticket_hash: string }>(
          `SELECT ticket_hash FROM inbox_pointers
           WHERE status != 'active'
           ORDER BY created_at ASC
           LIMIT ?`,
          total - INBOX_MAX_TICKETS + 1
        )
        .toArray();
      evictedTicketHashes.push(...removable.map((row) => row.ticket_hash));
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
      const pendingAfter = this.unreadInboxCount();
      return { ok: true, duplicate: true, pendingCount: pendingAfter };
    }

    return {
      ok: true,
      pendingCount: this.unreadInboxCount(),
      evictedTicketHashes,
    };
  }

  private unreadInboxCount(): number {
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

  inboxPage(offset = 0): {
    pointers: Array<{
      ticketHash: string;
      sealedTicketRef: string;
      displayNumber: string;
      status: InboxPointerStatus;
      createdBucket: number;
      createdAt: number;
      expiresAt: number;
    }>;
    nextOffset?: number;
    expiredTicketHashes: string[];
  } {
    const normalizedOffset = Math.max(0, Number(offset) || 0);
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
        normalizedOffset
      )
      .toArray();

    const pageRows = rows.slice(0, INBOX_PAGE_SIZE);
    const nextOffset =
      rows.length > INBOX_PAGE_SIZE
        ? normalizedOffset + INBOX_PAGE_SIZE
        : undefined;

    return {
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
    };
  }

  markInboxStatus(ticketHash: string, status: string): void {
    if (!isInboxPointerTransition(status)) {
      return;
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
  }

  addBlock(blockedUserId: string): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO blocks (blocked_user_id, created_at) VALUES (?, ?)`,
      blockedUserId,
      now
    );
  }

  removeBlock(blockedUserId: string): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM blocks WHERE blocked_user_id = ?",
      blockedUserId
    );
  }

  clearBlocks(): void {
    this.ctx.storage.sql.exec("DELETE FROM blocks");
  }

  setLabel(
    alias: string,
    targetUserId: string,
    nicknameCiphertext: string | null
  ): { ok: boolean; limited?: boolean } {
    const now = Date.now();

    if (!nicknameCiphertext) {
      this.ctx.storage.sql.exec(
        "DELETE FROM contact_labels WHERE alias = ?",
        alias
      );
      return { ok: true };
    }

    const count = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM contact_labels")
      .one().count;

    const exists = this.ctx.storage.sql
      .exec<{ alias: string }>(
        "SELECT alias FROM contact_labels WHERE alias = ?",
        alias
      )
      .toArray();

    if (!exists.length && count >= 200) {
      return { ok: false, limited: true };
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO contact_labels (alias, target_user_id, nickname_ciphertext, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(alias) DO UPDATE SET
         nickname_ciphertext = excluded.nickname_ciphertext,
         updated_at = excluded.updated_at`,
      alias,
      targetUserId,
      nicknameCiphertext,
      now,
      now
    );

    return { ok: true };
  }

  private parseProfileSession(row: ProfileSessionRow) {
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      currentIndex: row.current_index,
      totalQuestions: row.total_questions,
      answersEnc: row.answers_enc,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  private getActiveProfileSessionRow(): ProfileSessionRow | null {
    const rows = this.ctx.storage.sql
      .exec<ProfileSessionRow>(
        `SELECT * FROM profile_sessions
         WHERE status IN ('active', 'ready_to_submit')
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .toArray();

    const row = rows[0];
    if (!row) {
      return null;
    }

    if (row.expires_at !== null && Date.now() > row.expires_at) {
      this.ctx.storage.sql.exec("DELETE FROM profile_sessions WHERE id = ?", row.id);
      return null;
    }

    return row;
  }

  startProfileSession(body: {
      version: string;
      totalQuestions: number;
      answersEnc: string;
    }): { ok: boolean } {

    if (!body.version || !body.totalQuestions || !body.answersEnc) {
      return { ok: false };
    }

    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM profile_sessions");

    this.ctx.storage.sql.exec(
      `INSERT INTO profile_sessions (
        id, version, status, current_index, total_questions, answers_enc,
        profile_capability_enc, started_at, updated_at, expires_at
      ) VALUES (?, ?, 'active', 0, ?, ?, NULL, ?, ?, ?)`,
      PROFILE_SESSION_ID,
      body.version,
      body.totalQuestions,
      body.answersEnc,
      now,
      now,
      now + PROFILE_SESSION_TTL_MS
    );

    return { ok: true };
  }

  getActiveProfileSession():
    | {
        id: string;
        version: string;
        status: string;
        currentIndex: number;
        totalQuestions: number;
        answersEnc: string;
        startedAt: number;
        updatedAt: number;
        expiresAt: number | null;
      }
    | null {
    const row = this.getActiveProfileSessionRow();
    if (!row) {
      return null;
    }

    return this.parseProfileSession(row);
  }

  updateProfileSession(body: {
      answersEnc: string;
      currentIndex: number;
      status?: string;
    }): { ok: boolean; reason?: "not_found" | "invalid" } {

    const row = this.getActiveProfileSessionRow();
    if (!row) {
      return { ok: false, reason: "not_found" };
    }

    if (!body.answersEnc || !Number.isInteger(body.currentIndex)) {
      return { ok: false, reason: "invalid" };
    }

    const now = Date.now();
    const status = body.status ?? row.status;
    this.ctx.storage.sql.exec(
      `UPDATE profile_sessions
       SET answers_enc = ?, current_index = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      body.answersEnc,
      Math.max(0, Math.min(body.currentIndex, row.total_questions)),
      status,
      now,
      row.id
    );

    return { ok: true };
  }

  deleteProfileSession(): void {
    this.ctx.storage.sql.exec("DELETE FROM profile_sessions");
  }

  getProfileMeta(): {
    discoverable: boolean;
    profileCapabilityEnc: string | null;
    hasActiveSession: boolean;
    sessionStatus: string | null;
  } | null {
    const rows = this.ctx.storage.sql
      .exec<{
        discoverable: number;
        profile_capability_enc: string | null;
      }>(
        `SELECT discoverable, profile_capability_enc FROM user_state LIMIT 1`
      )
      .toArray();

    const state = rows[0];
    if (!state) {
      return null;
    }

    const session = this.getActiveProfileSessionRow();

    return {
      discoverable: !!state.discoverable,
      profileCapabilityEnc: state.profile_capability_enc,
      hasActiveSession: !!session,
      sessionStatus: session?.status ?? null,
    };
  }

  setDiscoverable(discoverable: boolean): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET discoverable = ?, updated_at = ?",
      discoverable ? 1 : 0,
      now
    );
  }

  setProfileCapabilityEnc(ciphertext: string | null): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET profile_capability_enc = ?, updated_at = ?",
      ciphertext,
      now
    );
  }

  getActiveExposureTokens(): { tokenHashes: string[] } {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "DELETE FROM exposure_tokens WHERE expires_at <= ?",
      now
    );
    const rows = this.ctx.storage.sql
      .exec<{ token_hash: string }>(
        "SELECT token_hash FROM exposure_tokens WHERE expires_at > ?",
        now
      )
      .toArray();

    return { tokenHashes: rows.map((row) => row.token_hash) };
  }

  recordExposureToken(tokenHash: string): void {
    if (!tokenHash || tokenHash.length > 86) {
      return;
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO exposure_tokens (token_hash, created_at, expires_at)
       VALUES (?, ?, ?)
       ON CONFLICT(token_hash) DO UPDATE SET expires_at = excluded.expires_at`,
      tokenHash,
      now,
      now + EXPOSURE_TOKEN_TTL_MS
    );
  }

  consumeSuggestionSearch(): { limited: boolean; remaining?: number } {
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<{ tokens: number; updated_at: number }>(
        "SELECT tokens, updated_at FROM rate_limits WHERE scope = ?",
        SUGGESTION_SEARCH_SCOPE
      )
      .toArray()[0];

    if (!row || now - row.updated_at > SUGGESTION_SEARCH_WINDOW_MS) {
      this.ctx.storage.sql.exec(
        `INSERT INTO rate_limits (scope, tokens, last_at, updated_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(scope) DO UPDATE SET
           tokens = 1,
           last_at = excluded.last_at,
           updated_at = excluded.updated_at`,
        SUGGESTION_SEARCH_SCOPE,
        now,
        now
      );
      return {
        limited: false,
        remaining: SUGGESTION_SEARCH_LIMIT - 1,
      };
    }

    if (row.tokens >= SUGGESTION_SEARCH_LIMIT) {
      return { limited: true };
    }

    this.ctx.storage.sql.exec(
      "UPDATE rate_limits SET tokens = tokens + 1, updated_at = ? WHERE scope = ?",
      now,
      SUGGESTION_SEARCH_SCOPE
    );

    return {
      limited: false,
      remaining: SUGGESTION_SEARCH_LIMIT - row.tokens - 1,
    };
  }

  async purge(): Promise<{ ok: boolean; ticketHashes: string[] }> {
    const ticketHashes = this.ctx.storage.sql
      .exec<{ ticket_hash: string }>("SELECT ticket_hash FROM inbox_pointers")
      .toArray()
      .map((row) => row.ticket_hash);

    this.ctx.storage.sql.exec(`
      DELETE FROM processed_events;
      DELETE FROM rate_limits;
      DELETE FROM contact_labels;
      DELETE FROM blocks;
      DELETE FROM inbox_pointers;
      DELETE FROM drafts;
      DELETE FROM profile_sessions;
      DELETE FROM exposure_tokens;
      DELETE FROM user_state;
    `);
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    return { ok: true, ticketHashes };
  }
}
