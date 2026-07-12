import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import type { StoreTicketInput, TicketVaultRecord } from "./ticket-vault.types";

type TicketRow = {
  ticket_hash: string;
  owner_proof_tag: string;
  route_enc: string | null;
  payload_enc: string | null;
  meta_enc: string | null;
  status: string;
  created_at: number;
  expires_at: number;
};

const rowToRecord = (row: TicketRow): TicketVaultRecord => ({
  ticketHash: row.ticket_hash,
  ownerProofTag: row.owner_proof_tag,
  routeEnc: row.route_enc,
  payloadEnc: row.payload_enc,
  ...(row.meta_enc ? { metaEnc: row.meta_enc } : {}),
  status: row.status as TicketVaultRecord["status"],
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

const isSafeHash = (value: string): boolean =>
  /^[A-Za-z0-9_-]{32,86}$/.test(value);

const EXPIRY_SWEEP_LIMIT = 50;

export class TicketVaultDurableObject extends DurableObject<Environment> {
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

      CREATE TABLE IF NOT EXISTS tickets (
        ticket_hash TEXT PRIMARY KEY,
        owner_proof_tag TEXT NOT NULL,
        route_enc TEXT,
        payload_enc TEXT,
        meta_enc TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_status
      ON tickets(status, created_at);

      CREATE INDEX IF NOT EXISTS idx_tickets_expires
      ON tickets(expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);

    this.migrateNullableTicketMaterial();
    this.ensureIndexes();
  }

  private ensureIndexes(): void {
    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_tickets_status
      ON tickets(status, created_at);

      CREATE INDEX IF NOT EXISTS idx_tickets_expires
      ON tickets(expires_at);
    `);
  }

  private migrateNullableTicketMaterial(): void {
    const routeColumn = this.ctx.storage.sql
      .exec<{ name: string; notnull: number }>("PRAGMA table_info(tickets)")
      .toArray()
      .find((column) => column.name === "route_enc");

    if (!routeColumn?.notnull) {
      return;
    }

    this.ctx.storage.sql.exec(`
      CREATE TABLE tickets_next (
        ticket_hash TEXT PRIMARY KEY,
        owner_proof_tag TEXT NOT NULL,
        route_enc TEXT,
        payload_enc TEXT,
        meta_enc TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      INSERT INTO tickets_next (
        ticket_hash, owner_proof_tag, route_enc, payload_enc, meta_enc,
        status, created_at, expires_at
      )
      SELECT
        ticket_hash, owner_proof_tag, route_enc, payload_enc, meta_enc,
        status, created_at, expires_at
      FROM tickets;

      DROP TABLE tickets;
      ALTER TABLE tickets_next RENAME TO tickets;
      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (2);
    `);
  }

  private expireDueTickets(now = Date.now()): number {
    const rows = this.ctx.storage.sql
      .exec<{ ticket_hash: string }>(
        `SELECT ticket_hash FROM tickets
         WHERE expires_at <= ?
           AND status != 'expired'
         ORDER BY expires_at ASC
         LIMIT ${EXPIRY_SWEEP_LIMIT}`,
        now
      )
      .toArray();

    if (rows.length === 0) {
      return 0;
    }

    const placeholders = rows.map(() => "?").join(",");
    this.ctx.storage.sql.exec(
      `UPDATE tickets
       SET route_enc = NULL,
           payload_enc = NULL,
           meta_enc = NULL,
           status = 'expired'
       WHERE ticket_hash IN (${placeholders})`,
      ...rows.map((row) => row.ticket_hash)
    );

    return rows.length;
  }

  private async scheduleNextExpiryAlarm(): Promise<void> {
    const now = Date.now();
    const next = this.ctx.storage.sql
      .exec<{ expires_at: number }>(
        `SELECT expires_at FROM tickets
         WHERE status != 'expired'
         ORDER BY expires_at ASC
         LIMIT 1`
      )
      .toArray()[0];

    if (next) {
      await this.ctx.storage.setAlarm(
        next.expires_at <= now ? now + 1 : next.expires_at
      );
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/tickets") {
      return this.storeTicket(request);
    }

    if (pathname.startsWith("/tickets/")) {
      const rest = pathname.slice("/tickets/".length);
      const [ticketHash, action] = rest.split("/");

      if (!ticketHash || !isSafeHash(ticketHash)) {
        return new Response("Invalid ticket hash", { status: 400 });
      }

      if (request.method === "GET" && !action) {
        return this.getTicket(ticketHash);
      }

      if (request.method === "POST" && action === "mark-viewed") {
        return this.markStatus(ticketHash, "viewed", true);
      }

      if (request.method === "POST" && action === "mark-replied") {
        return this.markStatus(ticketHash, "replied", true);
      }

      if (request.method === "POST" && action === "mark-blocked") {
        return this.markStatus(ticketHash, "blocked", true);
      }

      if (request.method === "POST" && action === "mark-reported") {
        return this.markStatus(ticketHash, "reported", true);
      }

      if (request.method === "POST" && action === "expire") {
        return this.expireTicket(ticketHash);
      }

      if (request.method === "DELETE" && !action) {
        return this.deleteTicket(ticketHash);
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  private async storeTicket(request: Request): Promise<Response> {
    const body = await request.json<StoreTicketInput>();

    if (
      !isSafeHash(body.ticketHash) ||
      !body.ownerProofTag ||
      !body.routeEnc ||
      !body.payloadEnc ||
      !Number.isSafeInteger(body.createdAt) ||
      !Number.isSafeInteger(body.expiresAt) ||
      body.expiresAt <= body.createdAt
    ) {
      return new Response("Invalid ticket", { status: 400 });
    }

    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO tickets (
          ticket_hash, owner_proof_tag, route_enc, payload_enc, meta_enc,
          status, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        body.ticketHash,
        body.ownerProofTag,
        body.routeEnc,
        body.payloadEnc,
        body.metaEnc ?? null,
        body.status ?? "active",
        body.createdAt,
        body.expiresAt
      );
    } catch {
      return new Response("Duplicate ticket", { status: 409 });
    }

    await this.scheduleNextExpiryAlarm();
    return Response.json({ ok: true });
  }

  private async getTicket(ticketHash: string): Promise<Response> {
    const row = this.ctx.storage.sql
      .exec<TicketRow>("SELECT * FROM tickets WHERE ticket_hash = ?", ticketHash)
      .toArray()[0];

    if (!row) {
      return new Response("Not found", { status: 404 });
    }

    if (row.status === "expired" || row.expires_at < Date.now()) {
      await this.expireTicket(ticketHash);
      return new Response("Expired", { status: 410 });
    }

    if (!row.route_enc) {
      return new Response("Expired", { status: 410 });
    }

    return Response.json(rowToRecord(row));
  }

  private markStatus(
    ticketHash: string,
    status: TicketVaultRecord["status"],
    clearPayload: boolean
  ): Response {
    const allowedPrevious =
      status === "viewed"
        ? ["active", "viewed"]
        : ["active", "viewed", status];
    const placeholders = allowedPrevious.map(() => "?").join(",");

    this.ctx.storage.sql.exec(
      `UPDATE tickets
       SET payload_enc = CASE WHEN ? THEN NULL ELSE payload_enc END,
           status = ?
       WHERE ticket_hash = ?
         AND status IN (${placeholders})
         AND expires_at > ?`,
      clearPayload ? 1 : 0,
      status,
      ticketHash,
      ...allowedPrevious,
      Date.now()
    );
    return Response.json({ ok: true });
  }

  private async expireTicket(ticketHash: string): Promise<Response> {
    this.ctx.storage.sql.exec(
      `UPDATE tickets
       SET route_enc = NULL,
           payload_enc = NULL,
           meta_enc = NULL,
           status = 'expired'
       WHERE ticket_hash = ?`,
      ticketHash
    );
    await this.scheduleNextExpiryAlarm();
    return Response.json({ ok: true });
  }

  private async deleteTicket(ticketHash: string): Promise<Response> {
    this.ctx.storage.sql.exec(
      "DELETE FROM tickets WHERE ticket_hash = ?",
      ticketHash
    );
    await this.scheduleNextExpiryAlarm();
    return Response.json({ ok: true });
  }

  async alarm(): Promise<void> {
    this.expireDueTickets();
    await this.scheduleNextExpiryAlarm();
  }
}
