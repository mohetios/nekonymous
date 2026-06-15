import { DurableObject } from "cloudflare:workers";
import type { Environment, InboxMessage } from "../types";
import { generateInboxRef } from "../utils/inbox";

const INBOX_MAX_MESSAGES = 50;

type InboxRow = {
  ref: string;
  ticket_id: string;
  conversation_id: string;
  ciphertext: string | null;
  delivered: number;
};

const rowToMessage = (row: InboxRow): InboxMessage => ({
  ref: row.ref,
  ticketId: row.ticket_id,
  conversationId: row.conversation_id,
  ...(row.ciphertext ? { ciphertext: row.ciphertext } : {}),
  ...(row.delivered ? { delivered: true } : {}),
});

export class InboxSqliteDurableObject extends DurableObject<Environment> {
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
        CREATE TABLE IF NOT EXISTS inbox_entries (
          ref TEXT PRIMARY KEY,
          ticket_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          ciphertext TEXT,
          delivered INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_inbox_pending
          ON inbox_entries(delivered) WHERE delivered = 0;
        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/add") {
      return this.addMessage(request);
    }
    if (request.method === "POST" && pathname === "/mark-delivered") {
      return this.markDelivered(request);
    }
    if (request.method === "GET" && pathname === "/list") {
      return this.listInbox();
    }
    if (request.method === "GET" && pathname === "/all") {
      return this.listAllInbox();
    }
    if (request.method === "GET" && pathname === "/entry") {
      return this.getEntry(request);
    }
    if (request.method === "DELETE" && pathname === "/purge") {
      return this.purgeInbox();
    }

    return new Response("Not Found", { status: 404 });
  }

  private async addMessage(request: Request): Promise<Response> {
    const body = await request.json<InboxMessage>();
    const { ticketId, conversationId, ciphertext } = body;

    if (!ticketId || !conversationId || !ciphertext) {
      return new Response("Missing fields", { status: 400 });
    }

    const pending = this.ctx.storage.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM inbox_entries WHERE delivered = 0"
      )
      .one().count;

    if (pending >= INBOX_MAX_MESSAGES) {
      return new Response("Inbox full", { status: 429 });
    }

    const total = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM inbox_entries")
      .one().count;

    if (total >= INBOX_MAX_MESSAGES) {
      this.ctx.storage.sql.exec(
        `DELETE FROM inbox_entries
         WHERE ref IN (
           SELECT ref FROM inbox_entries
           WHERE delivered = 1
           ORDER BY created_at ASC
           LIMIT ?
         )`,
        total - INBOX_MAX_MESSAGES + 1
      );
    }

    const ref = generateInboxRef();

    this.ctx.storage.sql.exec(
      `INSERT INTO inbox_entries (ref, ticket_id, conversation_id, ciphertext, delivered, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      ref,
      ticketId,
      conversationId,
      ciphertext,
      Date.now()
    );

    const pendingCount = this.ctx.storage.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM inbox_entries WHERE delivered = 0"
      )
      .one().count;

    return Response.json({ pendingCount });
  }

  private listInbox(): Response {
    const rows = this.ctx.storage.sql
      .exec<InboxRow>(
        `SELECT ref, ticket_id, conversation_id, ciphertext, delivered
         FROM inbox_entries
         WHERE delivered = 0 AND ciphertext IS NOT NULL
         ORDER BY created_at ASC`
      )
      .toArray();

    return Response.json(rows.map(rowToMessage));
  }

  private listAllInbox(): Response {
    const rows = this.ctx.storage.sql
      .exec<InboxRow>(
        `SELECT ref, ticket_id, conversation_id, ciphertext, delivered
         FROM inbox_entries
         ORDER BY created_at ASC`
      )
      .toArray();

    return Response.json(rows.map(rowToMessage));
  }

  private getEntry(request: Request): Response {
    const ref = new URL(request.url).searchParams.get("ref");
    if (!ref) {
      return new Response("Missing ref", { status: 400 });
    }

    const rows = this.ctx.storage.sql
      .exec<InboxRow>(
        `SELECT ref, ticket_id, conversation_id, ciphertext, delivered
         FROM inbox_entries WHERE ref = ?`,
        ref
      )
      .toArray();

    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    return Response.json(rowToMessage(rows[0]));
  }

  private async markDelivered(request: Request): Promise<Response> {
    const { ref } = await request.json<Pick<InboxMessage, "ref">>();
    if (!ref) {
      return new Response("Missing ref", { status: 400 });
    }

    const rows = this.ctx.storage.sql
      .exec<{ ref: string }>("SELECT ref FROM inbox_entries WHERE ref = ?", ref)
      .toArray();

    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    this.ctx.storage.sql.exec(
      "UPDATE inbox_entries SET ciphertext = NULL, delivered = 1 WHERE ref = ?",
      ref
    );

    return new Response("OK", { status: 200 });
  }

  private async purgeInbox(): Promise<Response> {
    this.ctx.storage.sql.exec("DELETE FROM inbox_entries");
    await this.ctx.storage.deleteAll();
    return new Response("Inbox purged", { status: 200 });
  }
}
