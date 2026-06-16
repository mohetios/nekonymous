import { DurableObject } from "cloudflare:workers";
import type { Environment, UserDraft } from "../../types";

const INBOX_MAX_TICKETS = 50;
const RATE_LIMIT_SECONDS = 5;
const RATE_LIMIT_SCOPE = "message";

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

type InboxRow = {
  ref: string;
  ticket_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  conversation_id: string;
  payload_ciphertext: string | null;
  connection_ciphertext: string;
  status: string;
  created_at: number;
  delivered_at: number | null;
  dedupe_key: string | null;
};

const rowToDraft = (row: DraftRow): UserDraft => ({
  id: row.id,
  mode: row.mode,
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
      )
    `);

    const version = this.ctx.storage.sql
      .exec<{ version: number }>(
        "SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations"
      )
      .one().version;

    if (version < 1) {
      this.ctx.storage.sql.exec(`
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

        CREATE TABLE IF NOT EXISTS inbox_tickets (
          ref TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL,
          sender_user_id TEXT NOT NULL,
          recipient_user_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          payload_ciphertext TEXT,
          connection_ciphertext TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          delivered_at INTEGER,
          replied_at INTEGER,
          blocked_at INTEGER,
          reported_at INTEGER,
          deleted_at INTEGER,
          expires_at INTEGER,
          dedupe_key TEXT UNIQUE
        );

        CREATE INDEX IF NOT EXISTS idx_inbox_pending
          ON inbox_tickets(status, created_at)
          WHERE status = 'pending';

        CREATE INDEX IF NOT EXISTS idx_inbox_created
          ON inbox_tickets(created_at);

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
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_processed_events_expires
          ON processed_events(expires_at);

        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
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
    if (request.method === "POST" && pathname === "/check-rate-limit") {
      return this.checkRateLimit();
    }
    if (request.method === "POST" && pathname === "/touch-rate-limit") {
      return this.touchRateLimit();
    }
    if (request.method === "POST" && pathname === "/add-ticket") {
      return this.addTicket(request);
    }
    if (request.method === "GET" && pathname === "/pending-inbox") {
      return this.pendingInbox();
    }
    if (request.method === "POST" && pathname === "/mark-delivered") {
      return this.markDelivered(request);
    }
    if (request.method === "GET" && pathname.startsWith("/ticket/")) {
      return this.getTicket(pathname.slice("/ticket/".length));
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

  private checkRateLimit(): Response {
    const row = this.ctx.storage.sql
      .exec<{ last_at: number }>(
        "SELECT last_at FROM rate_limits WHERE scope = ?",
        RATE_LIMIT_SCOPE
      )
      .toArray()[0];

    const limited =
      row !== undefined &&
      Date.now() - row.last_at < RATE_LIMIT_SECONDS * 1000;

    return Response.json({ limited });
  }

  private touchRateLimit(): Response {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO rate_limits (scope, tokens, last_at, updated_at)
       VALUES (?, 0, ?, ?)
       ON CONFLICT(scope) DO UPDATE SET last_at = excluded.last_at, updated_at = excluded.updated_at`,
      RATE_LIMIT_SCOPE,
      now,
      now
    );
    return Response.json({ ok: true });
  }

  private async addTicket(request: Request): Promise<Response> {
    const body = await request.json<{
      ref: string;
      ticketId: string;
      senderUserId: string;
      recipientUserId: string;
      conversationId: string;
      payloadCiphertext: string;
      connectionCiphertext: string;
      dedupeKey: string;
    }>();

    if (body.dedupeKey) {
      const existing = this.ctx.storage.sql
        .exec<{ ref: string }>(
          "SELECT ref FROM inbox_tickets WHERE dedupe_key = ?",
          body.dedupeKey
        )
        .toArray();
      if (existing.length > 0) {
        const pending = this.pendingCount();
        return Response.json({ ok: true, duplicate: true, pendingCount: pending });
      }
    }

    const pending = this.pendingCount();
    if (pending >= INBOX_MAX_TICKETS) {
      return new Response("Inbox full", { status: 429 });
    }

    const total = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM inbox_tickets")
      .one().count;

    if (total >= INBOX_MAX_TICKETS) {
      this.ctx.storage.sql.exec(
        `DELETE FROM inbox_tickets
         WHERE ref IN (
           SELECT ref FROM inbox_tickets
           WHERE status != 'pending' OR payload_ciphertext IS NULL
           ORDER BY created_at ASC
           LIMIT ?
         )`,
        total - INBOX_MAX_TICKETS + 1
      );
    }

    const now = Date.now();
    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO inbox_tickets (
          ref, ticket_id, sender_user_id, recipient_user_id, conversation_id,
          payload_ciphertext, connection_ciphertext, status, created_at, dedupe_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        body.ref,
        body.ticketId,
        body.senderUserId,
        body.recipientUserId,
        body.conversationId,
        body.payloadCiphertext,
        body.connectionCiphertext,
        now,
        body.dedupeKey
      );
    } catch {
      const pendingAfter = this.pendingCount();
      return Response.json({ ok: true, duplicate: true, pendingCount: pendingAfter });
    }

    return Response.json({
      ok: true,
      pendingCount: this.pendingCount(),
    });
  }

  private pendingCount(): number {
    return this.ctx.storage.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM inbox_tickets WHERE status = 'pending' AND payload_ciphertext IS NOT NULL"
      )
      .one().count;
  }

  private pendingInbox(): Response {
    const rows = this.ctx.storage.sql
      .exec<InboxRow>(
        `SELECT ref, ticket_id, sender_user_id, recipient_user_id, conversation_id,
                payload_ciphertext, connection_ciphertext, status, created_at, delivered_at, dedupe_key
         FROM inbox_tickets
         WHERE status = 'pending' AND payload_ciphertext IS NOT NULL
         ORDER BY created_at ASC
         LIMIT ${INBOX_MAX_TICKETS}`
      )
      .toArray();

    return Response.json({
      tickets: rows.map((row) => ({
        ref: row.ref,
        ticketId: row.ticket_id,
        senderUserId: row.sender_user_id,
        recipientUserId: row.recipient_user_id,
        conversationId: row.conversation_id,
        payloadCiphertext: row.payload_ciphertext ?? undefined,
        connectionCiphertext: row.connection_ciphertext,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  }

  private async markDelivered(request: Request): Promise<Response> {
    const { ref } = await request.json<{ ref: string }>();
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `UPDATE inbox_tickets
       SET status = 'delivered', payload_ciphertext = NULL, delivered_at = ?
       WHERE ref = ?`,
      now,
      ref
    );
    return Response.json({ ok: true });
  }

  private getTicket(ref: string): Response {
    const rows = this.ctx.storage.sql
      .exec<InboxRow>(
        `SELECT ref, ticket_id, sender_user_id, recipient_user_id, conversation_id,
                payload_ciphertext, connection_ciphertext, status, created_at
         FROM inbox_tickets WHERE ref = ?`,
        ref
      )
      .toArray();

    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    const row = rows[0];
    return Response.json({
      ref: row.ref,
      ticketId: row.ticket_id,
      senderUserId: row.sender_user_id,
      recipientUserId: row.recipient_user_id,
      conversationId: row.conversation_id,
      payloadCiphertext: row.payload_ciphertext ?? undefined,
      connectionCiphertext: row.connection_ciphertext,
      status: row.status,
      createdAt: row.created_at,
    });
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
    const { ref } = await request.json<{ ref: string }>();
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE inbox_tickets SET reported_at = ? WHERE ref = ?",
      now,
      ref
    );
    return Response.json({ ok: true });
  }

  private async purge(): Promise<Response> {
    this.ctx.storage.sql.exec(`
      DELETE FROM processed_events;
      DELETE FROM rate_limits;
      DELETE FROM contact_labels;
      DELETE FROM blocks;
      DELETE FROM inbox_tickets;
      DELETE FROM drafts;
      DELETE FROM user_state;
    `);
    await this.ctx.storage.deleteAll();
    return Response.json({ ok: true });
  }
}
