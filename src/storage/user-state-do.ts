import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../contracts/runtime";
import type { UserDraft } from "../contracts/user-state/model";
import type { UserDraftMode } from "../contracts/user-state/model";
import type {
  InboxNotificationCycle,
  InboxNotificationCycleStatus,
} from "../contracts/inbox/model";
import { resolveProcessedEventClaim } from "./processed-events-policy";
import { INBOX_MAX_UNREAD } from "../features/ticketing/inbox-constants";

const INBOX_CLEANUP_LIMIT = 10;
const UNREAD_DELIVERY_LEASE_MS = 60 * 1000;
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
  parent_message_id: number | null;
  reply_to_message_id: number | null;
  pending_nickname_contact_tag: string | null;
  pending_settings: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
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

type UnreadInboxItemRow = {
  item_id: string;
  sealed_capability_enc: string;
  dedupe_tag: string;
  delivery_state: "active" | "delivering";
  delivery_attempt_id: string | null;
  delivery_lease_until: number | null;
  created_at: number;
  expires_at: number;
};

type InboxNotificationCycleRow = {
  cycle_id: string;
  status: InboxNotificationCycleStatus;
  created_at: number;
  sent_at: number | null;
};

type UnreadInboxSummary = {
  unreadCount: number;
};

type UnreadDeliveryClaim = {
  itemId: string;
  sealedCapabilityEnc: string;
  dedupeTag: string;
  deliveryAttemptId: string;
  expiresAt: number;
};

const rowToDraft = (row: DraftRow): UserDraft => ({
  id: row.id,
  mode: row.mode as UserDraftMode,
  ...(row.to_user_id ? { toUserId: row.to_user_id } : {}),
  ...(row.link_slug ? { linkSlug: row.link_slug } : {}),
  ...(row.parent_message_id !== null
    ? { parent_message_id: row.parent_message_id }
    : {}),
  ...(row.reply_to_message_id !== null
    ? { reply_to_message_id: row.reply_to_message_id }
    : {}),
  ...(row.pending_nickname_contact_tag
    ? { pendingNicknameContactTag: row.pending_nickname_contact_tag }
    : {}),
  ...(row.pending_settings
    ? {
        pendingSettings: row.pending_settings as UserDraft["pendingSettings"],
      }
    : {}),
  ...(row.expires_at !== null ? { expiresAt: row.expires_at } : {}),
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
        parent_message_id INTEGER,
        reply_to_message_id INTEGER,
        pending_nickname_contact_tag TEXT,
        pending_settings TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at);

      CREATE TABLE IF NOT EXISTS unread_inbox_items (
        item_id TEXT PRIMARY KEY,
        sealed_capability_enc BLOB NOT NULL,
        dedupe_tag TEXT NOT NULL UNIQUE,
        delivery_state TEXT NOT NULL,
        delivery_attempt_id TEXT,
        delivery_lease_until INTEGER,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_unread_inbox_items_state_created
        ON unread_inbox_items(delivery_state, created_at, item_id);

      CREATE INDEX IF NOT EXISTS idx_unread_inbox_items_expires
        ON unread_inbox_items(expires_at);

      CREATE TABLE IF NOT EXISTS inbox_notification_cycle (
        cycle_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        sent_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS blocks (
        block_tag TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contact_labels (
        contact_tag TEXT PRIMARY KEY,
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
    blockTags: string[];
    labels: Array<{
      contact_tag: string;
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
      .exec<{ block_tag: string }>(
        "SELECT block_tag FROM blocks ORDER BY created_at ASC"
      )
      .toArray()
      .map((row) => row.block_tag);

    const labels = this.ctx.storage.sql
      .exec<{
        contact_tag: string;
        nickname_ciphertext: string;
      }>("SELECT contact_tag, nickname_ciphertext FROM contact_labels")
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
      blockTags: blocks,
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
        id, mode, to_user_id, link_slug,
        parent_message_id, reply_to_message_id,
        pending_nickname_contact_tag, pending_settings,
        expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      draftId,
      body.mode,
      body.toUserId ?? null,
      body.linkSlug ?? null,
      body.parent_message_id ?? null,
      body.reply_to_message_id ?? null,
      body.pendingNicknameContactTag ?? null,
      body.pendingSettings ?? null,
      body.expiresAt ?? null,
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

  checkCanReceive(blockTag: string): { ok: boolean; reason?: string } {
    const state = this.ctx.storage.sql
      .exec<UserStateRow>("SELECT paused FROM user_state LIMIT 1")
      .toArray()[0];

    if (state?.paused) {
      return { ok: false, reason: "paused" };
    }

    const blocked = this.ctx.storage.sql
      .exec<{ block_tag: string }>(
        "SELECT block_tag FROM blocks WHERE block_tag = ?",
        blockTag
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

  private recoverExpiredUnreadLeases(now = Date.now()): void {
    this.ctx.storage.sql.exec(
      `UPDATE unread_inbox_items
       SET delivery_state = 'active',
           delivery_attempt_id = NULL,
           delivery_lease_until = NULL
       WHERE delivery_state = 'delivering'
         AND delivery_lease_until IS NOT NULL
         AND delivery_lease_until <= ?`,
      now
    );
  }

  private activeNotificationCycle(): InboxNotificationCycle | null {
    const row = this.ctx.storage.sql
      .exec<InboxNotificationCycleRow>(
        `SELECT cycle_id, status, created_at, sent_at
         FROM inbox_notification_cycle
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .toArray()[0];
    if (!row) {
      return null;
    }
    return {
      cycleId: row.cycle_id,
      status: row.status,
      createdAt: row.created_at,
      sentAt: row.sent_at,
    };
  }

  private createNotificationCycle(now: number): InboxNotificationCycle {
    const cycleId = crypto.randomUUID();
    this.ctx.storage.sql.exec("DELETE FROM inbox_notification_cycle");
    this.ctx.storage.sql.exec(
      `INSERT INTO inbox_notification_cycle (
        cycle_id, status, created_at, sent_at
      ) VALUES (?, 'pending', ?, NULL)`,
      cycleId,
      now
    );
    return {
      cycleId,
      status: "pending",
      createdAt: now,
      sentAt: null,
    };
  }

  private closeNotificationCycleIfInboxEmpty(): void {
    if (this.activeUnreadCount() > 0) {
      return;
    }
    this.ctx.storage.sql.exec("DELETE FROM inbox_notification_cycle");
  }

  cleanupExpiredUnreadItems(): { deleted: number; summary: UnreadInboxSummary } {
    const now = Date.now();
    const rows = this.ctx.storage.sql
      .exec<{ item_id: string }>(
        `SELECT item_id FROM unread_inbox_items
         WHERE expires_at <= ?
         ORDER BY expires_at ASC
         LIMIT ${INBOX_CLEANUP_LIMIT}`,
        now
      )
      .toArray();
    if (rows.length > 0) {
      const placeholders = rows.map(() => "?").join(",");
      this.ctx.storage.sql.exec(
        `DELETE FROM unread_inbox_items WHERE item_id IN (${placeholders})`,
        ...rows.map((row) => row.item_id)
      );
    }
    this.recoverExpiredUnreadLeases(now);
    this.closeNotificationCycleIfInboxEmpty();
    return { deleted: rows.length, summary: this.getUnreadSummary() };
  }

  private activeUnreadCount(): number {
    this.recoverExpiredUnreadLeases();
    return this.ctx.storage.sql
      .exec<{ count: number }>(
        `SELECT COUNT(*) AS count FROM unread_inbox_items
         WHERE expires_at > ?
           AND delivery_state IN ('active', 'delivering')`,
        Date.now()
      )
      .one().count;
  }

  getUnreadSummary(): UnreadInboxSummary {
    return {
      unreadCount: this.activeUnreadCount(),
    };
  }

  addUnreadItem(body: {
    itemId: string;
    sealedCapabilityEnc: string;
    dedupeTag: string;
    createdAt: number;
    expiresAt: number;
  }): {
    ok: boolean;
    reason?: "full" | "invalid";
    unreadCount?: number;
    duplicate?: boolean;
    notification: { required: true; cycleId: string } | { required: false };
  } {
    if (
      !body.itemId ||
      body.itemId.length > 80 ||
      !body.sealedCapabilityEnc ||
      !body.dedupeTag ||
      body.dedupeTag.length > 86 ||
      !Number.isSafeInteger(body.createdAt) ||
      !Number.isSafeInteger(body.expiresAt) ||
      body.expiresAt <= body.createdAt
    ) {
      return {
        ok: false,
        reason: "invalid",
        notification: { required: false },
      };
    }

    this.cleanupExpiredUnreadItems();
    const existing = this.ctx.storage.sql
      .exec<{ item_id: string }>(
        "SELECT item_id FROM unread_inbox_items WHERE dedupe_tag = ?",
        body.dedupeTag
      )
      .toArray()[0];
    if (existing) {
      const summary = this.getUnreadSummary();
      return {
        ok: true,
        duplicate: true,
        unreadCount: summary.unreadCount,
        notification: { required: false },
      };
    }

    const active = this.activeUnreadCount();
    if (active >= INBOX_MAX_UNREAD) {
      return {
        ok: false,
        reason: "full",
        notification: { required: false },
      };
    }
    const wasEmpty = active === 0;

    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO unread_inbox_items (
          item_id, sealed_capability_enc, dedupe_tag, delivery_state,
          delivery_attempt_id, delivery_lease_until, created_at, expires_at
        ) VALUES (?, ?, ?, 'active', NULL, NULL, ?, ?)`,
        body.itemId,
        body.sealedCapabilityEnc,
        body.dedupeTag,
        body.createdAt,
        body.expiresAt
      );
    } catch {
      const summary = this.getUnreadSummary();
      return {
        ok: true,
        duplicate: true,
        unreadCount: summary.unreadCount,
        notification: { required: false },
      };
    }

    const summary = this.getUnreadSummary();
    const currentCycle = this.activeNotificationCycle();
    const notification =
      wasEmpty || !currentCycle
        ? {
            required: true as const,
            cycleId: this.createNotificationCycle(body.createdAt).cycleId,
          }
        : currentCycle?.status === "pending"
          ? { required: true as const, cycleId: currentCycle.cycleId }
          : { required: false as const };
    return {
      ok: true,
      unreadCount: summary.unreadCount,
      notification,
    };
  }

  getInboxNotificationCycle(): InboxNotificationCycle | null {
    return this.activeNotificationCycle();
  }

  markInboxNotificationSent(body: {
    cycleId: string;
    sentAt: number;
  }): { ok: boolean; cycle: InboxNotificationCycle | null } {
    if (!body.cycleId || !Number.isSafeInteger(body.sentAt)) {
      return { ok: false, cycle: this.activeNotificationCycle() };
    }
    this.ctx.storage.sql.exec(
      `UPDATE inbox_notification_cycle
       SET status = 'sent', sent_at = ?
       WHERE cycle_id = ?`,
      body.sentAt,
      body.cycleId
    );
    return { ok: true, cycle: this.activeNotificationCycle() };
  }

  closeInboxNotificationCycle(body?: {
    cycleId?: string;
  }): { ok: boolean; cycle: InboxNotificationCycle | null } {
    if (body?.cycleId) {
      this.ctx.storage.sql.exec(
        "DELETE FROM inbox_notification_cycle WHERE cycle_id = ?",
        body.cycleId
      );
    } else {
      this.ctx.storage.sql.exec("DELETE FROM inbox_notification_cycle");
    }
    return { ok: true, cycle: this.activeNotificationCycle() };
  }

  private claimUnreadRows(limit: number): UnreadDeliveryClaim[] {
    const cappedLimit = Math.min(5, Math.max(1, Math.floor(limit)));
    const now = Date.now();
    this.cleanupExpiredUnreadItems();
    this.recoverExpiredUnreadLeases(now);
    const rows = this.ctx.storage.sql
      .exec<UnreadInboxItemRow>(
        `SELECT item_id, sealed_capability_enc, dedupe_tag, delivery_state,
                delivery_attempt_id, delivery_lease_until, created_at, expires_at
         FROM unread_inbox_items
         WHERE delivery_state = 'active'
           AND expires_at > ?
         ORDER BY created_at ASC, item_id ASC
         LIMIT ?`,
        now,
        cappedLimit
      )
      .toArray();

    const claims: UnreadDeliveryClaim[] = [];
    for (const row of rows) {
      const attemptId = crypto.randomUUID();
      const leaseUntil = now + UNREAD_DELIVERY_LEASE_MS;
      this.ctx.storage.sql.exec(
        `UPDATE unread_inbox_items
         SET delivery_state = 'delivering',
             delivery_attempt_id = ?,
             delivery_lease_until = ?
         WHERE item_id = ?
           AND delivery_state = 'active'`,
        attemptId,
        leaseUntil,
        row.item_id
      );
      const updated = this.ctx.storage.sql
        .exec<UnreadInboxItemRow>(
          `SELECT item_id, sealed_capability_enc, dedupe_tag, delivery_state,
                  delivery_attempt_id, delivery_lease_until, created_at, expires_at
           FROM unread_inbox_items
           WHERE item_id = ?
             AND delivery_attempt_id = ?`,
          row.item_id,
          attemptId
        )
        .toArray()[0];
      if (updated) {
        claims.push({
          itemId: updated.item_id,
          sealedCapabilityEnc: updated.sealed_capability_enc,
          dedupeTag: updated.dedupe_tag,
          deliveryAttemptId: attemptId,
          expiresAt: updated.expires_at,
        });
      }
    }
    return claims;
  }

  claimNextUnreadItem(): UnreadDeliveryClaim | null {
    return this.claimUnreadRows(1)[0] ?? null;
  }

  completeUnreadDelivery(body: {
    itemId: string;
    deliveryAttemptId: string;
  }): { ok: boolean; summary: UnreadInboxSummary } {
    if (!body.itemId || !body.deliveryAttemptId) {
      return { ok: false, summary: this.getUnreadSummary() };
    }
    this.ctx.storage.sql.exec(
      `DELETE FROM unread_inbox_items
       WHERE item_id = ?
         AND delivery_attempt_id = ?`,
      body.itemId,
      body.deliveryAttemptId
    );
    this.closeNotificationCycleIfInboxEmpty();
    return { ok: true, summary: this.getUnreadSummary() };
  }

  releaseUnreadDelivery(body: {
    itemId: string;
    deliveryAttemptId: string;
  }): { ok: boolean } {
    if (!body.itemId || !body.deliveryAttemptId) {
      return { ok: false };
    }
    this.ctx.storage.sql.exec(
      `UPDATE unread_inbox_items
       SET delivery_state = 'active',
           delivery_attempt_id = NULL,
           delivery_lease_until = NULL
       WHERE item_id = ?
         AND delivery_attempt_id = ?`,
      body.itemId,
      body.deliveryAttemptId
    );
    return { ok: true };
  }

  purgeUnreadInbox(): { ok: boolean; summary: UnreadInboxSummary } {
    this.ctx.storage.sql.exec("DELETE FROM unread_inbox_items");
    this.ctx.storage.sql.exec("DELETE FROM inbox_notification_cycle");
    return { ok: true, summary: this.getUnreadSummary() };
  }

  listUnreadItemsForReset(): Array<{
    itemId: string;
    sealedCapabilityEnc: string;
    dedupeTag: string;
  }> {
    return this.ctx.storage.sql
      .exec<UnreadInboxItemRow>(
        `SELECT item_id, sealed_capability_enc, dedupe_tag, delivery_state,
                delivery_attempt_id, delivery_lease_until, created_at, expires_at
         FROM unread_inbox_items`
      )
      .toArray()
      .map((row) => ({
        itemId: row.item_id,
        sealedCapabilityEnc: row.sealed_capability_enc,
        dedupeTag: row.dedupe_tag,
      }));
  }

  deleteUnreadItem(itemId: string): void {
    if (!itemId || itemId.length > 80) {
      return;
    }
    this.ctx.storage.sql.exec("DELETE FROM unread_inbox_items WHERE item_id = ?", itemId);
    this.closeNotificationCycleIfInboxEmpty();
  }

  addBlock(blockTag: string): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO blocks (block_tag, created_at) VALUES (?, ?)`,
      blockTag,
      now
    );
  }

  removeBlock(blockTag: string): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM blocks WHERE block_tag = ?",
      blockTag
    );
  }

  clearBlocks(): void {
    this.ctx.storage.sql.exec("DELETE FROM blocks");
  }

  setLabel(
    contactTag: string,
    nicknameCiphertext: string | null
  ): { ok: boolean; limited?: boolean } {
    const now = Date.now();

    if (!nicknameCiphertext) {
      this.ctx.storage.sql.exec(
        "DELETE FROM contact_labels WHERE contact_tag = ?",
        contactTag
      );
      return { ok: true };
    }

    const count = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM contact_labels")
      .one().count;

    const exists = this.ctx.storage.sql
      .exec<{ contact_tag: string }>(
        "SELECT contact_tag FROM contact_labels WHERE contact_tag = ?",
        contactTag
      )
      .toArray();

    if (!exists.length && count >= 200) {
      return { ok: false, limited: true };
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO contact_labels (contact_tag, nickname_ciphertext, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(contact_tag) DO UPDATE SET
         nickname_ciphertext = excluded.nickname_ciphertext,
         updated_at = excluded.updated_at`,
      contactTag,
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

  async purge(): Promise<{ ok: boolean }> {
    this.ctx.storage.sql.exec(`
      DELETE FROM processed_events;
      DELETE FROM rate_limits;
      DELETE FROM contact_labels;
      DELETE FROM blocks;
      DELETE FROM unread_inbox_items;
      DELETE FROM inbox_notification_cycle;
      DELETE FROM drafts;
      DELETE FROM profile_sessions;
      DELETE FROM exposure_tokens;
      DELETE FROM user_state;
    `);
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    return { ok: true };
  }
}
