import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import {
  evaluateAcquirePairPending,
} from "./pair-pending.ts";
import type { PairLedgerShardPing, PairStateRecord } from "./pair-ledger.types";

export type { PairLedgerShardPing } from "./pair-ledger.types";

type PairStateRow = {
  pair_tag: string;
  state: string;
  expires_at: number | null;
  updated_at: number;
};

const rowToPairState = (row: PairStateRow): PairStateRecord => ({
  pairTag: row.pair_tag,
  state: row.state as PairStateRecord["state"],
  expiresAt: row.expires_at,
  updatedAt: row.updated_at,
});

export class PairLedgerShardDurableObject extends DurableObject<Environment> {
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

      CREATE TABLE IF NOT EXISTS pair_states (
        pair_tag TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        expires_at INTEGER,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pair_states_expires
        ON pair_states(expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/pair-states/batch") {
      return this.batchGetPairStates(request);
    }

    if (request.method === "POST" && pathname === "/pair-states") {
      return this.upsertPairState(request);
    }

    if (request.method === "POST" && pathname === "/pair-states/acquire-pending") {
      return this.acquirePairPending(request);
    }

    if (request.method === "POST" && pathname === "/pair-states/release-pending") {
      return this.releasePairPending(request);
    }

    if (pathname.startsWith("/pair-states/")) {
      const pairTag = decodeURIComponent(pathname.slice("/pair-states/".length));
      if (!pairTag || pairTag.length > 86) {
        return new Response("Invalid pair tag", { status: 400 });
      }
      if (request.method === "GET") {
        return this.getPairState(pairTag);
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  private getPairState(pairTag: string): Response {
    const row = this.ctx.storage.sql
      .exec<PairStateRow>(
        "SELECT * FROM pair_states WHERE pair_tag = ? LIMIT 1",
        pairTag
      )
      .toArray()[0];

    return Response.json({ record: row ? rowToPairState(row) : null });
  }

  private async batchGetPairStates(request: Request): Promise<Response> {
    const body = await request.json<{ pairTags?: string[] }>();
    if (
      !body.pairTags ||
      !Array.isArray(body.pairTags) ||
      body.pairTags.length === 0 ||
      body.pairTags.length > 50
    ) {
      return new Response("Invalid pair tag batch", { status: 400 });
    }

    const records: Record<string, PairStateRecord | null> = {};
    for (const pairTag of body.pairTags) {
      if (!pairTag || pairTag.length > 86) {
        return new Response("Invalid pair tag in batch", { status: 400 });
      }
      const row = this.ctx.storage.sql
        .exec<PairStateRow>(
          "SELECT * FROM pair_states WHERE pair_tag = ? LIMIT 1",
          pairTag
        )
        .toArray()[0];
      records[pairTag] = row ? rowToPairState(row) : null;
    }

    return Response.json({ records });
  }

  private async upsertPairState(request: Request): Promise<Response> {
    const body = await request.json<{
      pairTag?: string;
      state?: string;
      expiresAt?: number | null;
    }>();

    if (
      !body.pairTag ||
      body.pairTag.length > 86 ||
      !body.state ||
      (body.expiresAt !== null &&
        body.expiresAt !== undefined &&
        !Number.isInteger(body.expiresAt))
    ) {
      return new Response("Invalid pair state payload", { status: 400 });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO pair_states (pair_tag, state, expires_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(pair_tag) DO UPDATE SET
         state = excluded.state,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      body.pairTag,
      body.state,
      body.expiresAt ?? null,
      now
    );

    return Response.json({ ok: true });
  }

  private async acquirePairPending(request: Request): Promise<Response> {
    const body = await request.json<{ pairTag?: string; expiresAt?: number }>();
    if (
      !body.pairTag ||
      body.pairTag.length > 86 ||
      !Number.isInteger(body.expiresAt)
    ) {
      return new Response("Invalid acquire pending payload", { status: 400 });
    }

    const row = this.ctx.storage.sql
      .exec<PairStateRow>(
        "SELECT * FROM pair_states WHERE pair_tag = ? LIMIT 1",
        body.pairTag
      )
      .toArray()[0];

    const current = row ? rowToPairState(row) : null;
    const decision = evaluateAcquirePairPending(current);
    if (!decision.ok) {
      return new Response("Pair pending lock rejected", { status: 409 });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO pair_states (pair_tag, state, expires_at, updated_at)
       VALUES (?, 'pending', ?, ?)
       ON CONFLICT(pair_tag) DO UPDATE SET
         state = 'pending',
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      body.pairTag,
      body.expiresAt,
      now
    );

    return Response.json({ ok: true });
  }

  private async releasePairPending(request: Request): Promise<Response> {
    const body = await request.json<{ pairTag?: string }>();
    if (!body.pairTag || body.pairTag.length > 86) {
      return new Response("Invalid release pending payload", { status: 400 });
    }

    const row = this.ctx.storage.sql
      .exec<PairStateRow>(
        "SELECT * FROM pair_states WHERE pair_tag = ? LIMIT 1",
        body.pairTag
      )
      .toArray()[0];

    if (!row) {
      return Response.json({ ok: true, released: false });
    }

    const record = rowToPairState(row);
    if (
      record.state !== "pending" ||
      (record.expiresAt !== null && record.expiresAt <= Date.now())
    ) {
      return Response.json({ ok: true, released: false });
    }

    this.ctx.storage.sql.exec(
      "DELETE FROM pair_states WHERE pair_tag = ? AND state = 'pending'",
      body.pairTag
    );

    return Response.json({ ok: true, released: true });
  }

  ping(): PairLedgerShardPing {
    const pairStates =
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM pair_states")
        .one().n ?? 0;

    return { ok: true, plane: "pair", pairStates };
  }
}
