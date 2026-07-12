import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import {
  evaluateAcquirePairPending,
} from "./pair-pending.ts";
import type { PairStateRecord, UpsertPairStateInput } from "./pair-ledger.types";

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

  batchGetPairStates(pairTags: string[]): Record<string, PairStateRecord | null> {
    if (
      !Array.isArray(pairTags) ||
      pairTags.length === 0 ||
      pairTags.length > 50
    ) {
      throw new Error("Invalid pair tag batch");
    }

    const records: Record<string, PairStateRecord | null> = {};
    for (const pairTag of pairTags) {
      if (!pairTag || pairTag.length > 86) {
        throw new Error("Invalid pair tag in batch");
      }
      const row = this.ctx.storage.sql
        .exec<PairStateRow>(
          "SELECT * FROM pair_states WHERE pair_tag = ? LIMIT 1",
          pairTag
        )
        .toArray()[0];
      records[pairTag] = row ? rowToPairState(row) : null;
    }

    return records;
  }

  upsertPairState(body: UpsertPairStateInput): void {
    if (
      !body.pairTag ||
      body.pairTag.length > 86 ||
      !body.state ||
      (body.expiresAt !== null &&
        body.expiresAt !== undefined &&
        !Number.isInteger(body.expiresAt))
    ) {
      throw new Error("Invalid pair state payload");
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
  }

  acquirePairPending(
    pairTag: string,
    expiresAt: number
  ): { ok: boolean; reason?: "blocked" } {
    if (
      !pairTag ||
      pairTag.length > 86 ||
      !Number.isInteger(expiresAt)
    ) {
      return { ok: false, reason: "blocked" };
    }

    const row = this.ctx.storage.sql
      .exec<PairStateRow>(
        "SELECT * FROM pair_states WHERE pair_tag = ? LIMIT 1",
        pairTag
      )
      .toArray()[0];

    const current = row ? rowToPairState(row) : null;
    const decision = evaluateAcquirePairPending(current);
    if (!decision.ok) {
      return { ok: false, reason: "blocked" };
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO pair_states (pair_tag, state, expires_at, updated_at)
       VALUES (?, 'pending', ?, ?)
       ON CONFLICT(pair_tag) DO UPDATE SET
         state = 'pending',
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      pairTag,
      expiresAt,
      now
    );

    return { ok: true };
  }

  releasePairPending(
    pairTag: string
  ): { ok: true; released: boolean } {
    if (!pairTag || pairTag.length > 86) {
      return { ok: true, released: false };
    }

    const row = this.ctx.storage.sql
      .exec<PairStateRow>(
        "SELECT * FROM pair_states WHERE pair_tag = ? LIMIT 1",
        pairTag
      )
      .toArray()[0];

    if (!row) {
      return { ok: true, released: false };
    }

    const record = rowToPairState(row);
    if (
      record.state !== "pending" ||
      (record.expiresAt !== null && record.expiresAt <= Date.now())
    ) {
      return { ok: true, released: false };
    }

    this.ctx.storage.sql.exec(
      "DELETE FROM pair_states WHERE pair_tag = ? AND state = 'pending'",
      pairTag
    );

    return { ok: true, released: true };
  }
}
