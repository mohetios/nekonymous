import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import {
  canTransitionRequestStatus,
  effectiveRequestStatus,
  shouldClearRequestIntro,
} from "./request-transitions.ts";
import {
  canTransitionSuggestionStatus,
  effectiveSuggestionStatus,
} from "./suggestion-transitions.ts";
import type {
  RequestTicketStatus,
  RequestTicketRecord,
  SetRequestStatusResult,
  SetSuggestionStatusResult,
  StoreRequestInput,
  StoreSuggestionInput,
  SuggestionTicketStatus,
  SuggestionTicketRecord,
} from "./conversation-vault.types";

type SuggestionRow = {
  suggestion_hash: string;
  requester_proof_tag: string;
  candidate_route_enc: string;
  pair_tag: string;
  explanation_enc: string;
  status: string;
  created_at: number;
  expires_at: number;
};

const isSafeHash = (value: string): boolean =>
  /^[A-Za-z0-9_-]{32,86}$/.test(value);

const rowToSuggestion = (row: SuggestionRow): SuggestionTicketRecord => ({
  suggestionHash: row.suggestion_hash,
  requesterProofTag: row.requester_proof_tag,
  candidateRouteEnc: row.candidate_route_enc,
  pairTag: row.pair_tag,
  explanationEnc: row.explanation_enc,
  status: row.status as SuggestionTicketRecord["status"],
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

type RequestRow = {
  request_hash: string;
  requester_proof_tag: string;
  candidate_proof_tag: string;
  requester_route_enc: string;
  candidate_route_enc: string;
  intro_enc: string | null;
  status: string;
  created_at: number;
  expires_at: number;
};

const rowToRequest = (row: RequestRow): RequestTicketRecord => ({
  requestHash: row.request_hash,
  requesterProofTag: row.requester_proof_tag,
  candidateProofTag: row.candidate_proof_tag,
  requesterRouteEnc: row.requester_route_enc,
  candidateRouteEnc: row.candidate_route_enc,
  introEnc: row.intro_enc,
  status: row.status as RequestTicketRecord["status"],
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

export class ConversationVaultShardDurableObject extends DurableObject<Environment> {
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

      CREATE TABLE IF NOT EXISTS suggestion_tickets (
        suggestion_hash TEXT PRIMARY KEY,
        requester_proof_tag TEXT NOT NULL,
        candidate_route_enc TEXT NOT NULL,
        pair_tag TEXT NOT NULL,
        explanation_enc TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_suggestion_tickets_status_expires
        ON suggestion_tickets(status, expires_at);

      CREATE TABLE IF NOT EXISTS request_tickets (
        request_hash TEXT PRIMARY KEY,
        requester_proof_tag TEXT NOT NULL,
        candidate_proof_tag TEXT NOT NULL,
        requester_route_enc TEXT NOT NULL,
        candidate_route_enc TEXT NOT NULL,
        intro_enc TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_request_tickets_status_expires
        ON request_tickets(status, expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);
  }

  storeSuggestion(body: StoreSuggestionInput): void {
    if (
      !body.suggestionHash ||
      !isSafeHash(body.suggestionHash) ||
      !body.requesterProofTag ||
      !body.candidateRouteEnc ||
      !body.pairTag ||
      !body.explanationEnc ||
      !body.status ||
      !Number.isInteger(body.expiresAt)
    ) {
      throw new Error("Invalid suggestion payload");
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO suggestion_tickets (
        suggestion_hash, requester_proof_tag, candidate_route_enc,
        pair_tag, explanation_enc, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(suggestion_hash) DO UPDATE SET
        requester_proof_tag = excluded.requester_proof_tag,
        candidate_route_enc = excluded.candidate_route_enc,
        pair_tag = excluded.pair_tag,
        explanation_enc = excluded.explanation_enc,
        status = excluded.status,
        expires_at = excluded.expires_at`,
      body.suggestionHash,
      body.requesterProofTag,
      body.candidateRouteEnc,
      body.pairTag,
      body.explanationEnc,
      body.status,
      now,
      body.expiresAt
    );
  }

  getSuggestion(suggestionHash: string): SuggestionTicketRecord | null {
    if (!isSafeHash(suggestionHash)) {
      return null;
    }

    const row = this.ctx.storage.sql
      .exec<SuggestionRow>(
        "SELECT * FROM suggestion_tickets WHERE suggestion_hash = ? LIMIT 1",
        suggestionHash
      )
      .toArray()[0];

    if (!row) {
      return null;
    }

    const record = rowToSuggestion(row);
    const effectiveStatus = effectiveSuggestionStatus(
      record.status,
      record.expiresAt
    );
    if (effectiveStatus !== record.status) {
      this.ctx.storage.sql.exec(
        "UPDATE suggestion_tickets SET status = ? WHERE suggestion_hash = ?",
        effectiveStatus,
        suggestionHash
      );
      record.status = effectiveStatus;
    }

    return record;
  }

  setSuggestionStatus(
    suggestionHash: string,
    status: SuggestionTicketStatus,
    expectedStatus?: SuggestionTicketStatus
  ): SetSuggestionStatusResult {
    if (!isSafeHash(suggestionHash) || !status) {
      return { ok: false, error: "invalid" };
    }

    const row = this.ctx.storage.sql
      .exec<SuggestionRow>(
        "SELECT * FROM suggestion_tickets WHERE suggestion_hash = ? LIMIT 1",
        suggestionHash
      )
      .toArray()[0];

    if (!row) {
      return { ok: false, error: "not_found" };
    }

    const current = effectiveSuggestionStatus(
      row.status as SuggestionTicketRecord["status"],
      row.expires_at
    );
    const next = status;

    if (
      expectedStatus &&
      expectedStatus !== current &&
      expectedStatus !== row.status
    ) {
      return { ok: false, error: "conflict" };
    }

    if (current === next) {
      return { ok: true, status: current };
    }

    if (!canTransitionSuggestionStatus(current, next)) {
      return { ok: false, error: "conflict" };
    }

    this.ctx.storage.sql.exec(
      "UPDATE suggestion_tickets SET status = ? WHERE suggestion_hash = ?",
      next,
      suggestionHash
    );

    return { ok: true, status: next };
  }

  storeRequest(body: StoreRequestInput): void {
    if (
      !body.requestHash ||
      !isSafeHash(body.requestHash) ||
      !body.requesterProofTag ||
      !body.candidateProofTag ||
      !body.requesterRouteEnc ||
      !body.candidateRouteEnc ||
      !body.introEnc ||
      !body.status ||
      !Number.isInteger(body.expiresAt)
    ) {
      throw new Error("Invalid request payload");
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO request_tickets (
        request_hash, requester_proof_tag, candidate_proof_tag,
        requester_route_enc, candidate_route_enc, intro_enc,
        status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_hash) DO UPDATE SET
        requester_proof_tag = excluded.requester_proof_tag,
        candidate_proof_tag = excluded.candidate_proof_tag,
        requester_route_enc = excluded.requester_route_enc,
        candidate_route_enc = excluded.candidate_route_enc,
        intro_enc = excluded.intro_enc,
        status = excluded.status,
        expires_at = excluded.expires_at`,
      body.requestHash,
      body.requesterProofTag,
      body.candidateProofTag,
      body.requesterRouteEnc,
      body.candidateRouteEnc,
      body.introEnc,
      body.status,
      now,
      body.expiresAt
    );
  }

  getRequest(requestHash: string): RequestTicketRecord | null {
    if (!isSafeHash(requestHash)) {
      return null;
    }

    const row = this.ctx.storage.sql
      .exec<RequestRow>(
        "SELECT * FROM request_tickets WHERE request_hash = ? LIMIT 1",
        requestHash
      )
      .toArray()[0];

    if (!row) {
      return null;
    }

    const record = rowToRequest(row);
    const effectiveStatus = effectiveRequestStatus(record.status, record.expiresAt);
    if (effectiveStatus !== record.status) {
      const clearIntro = shouldClearRequestIntro(effectiveStatus);
      this.ctx.storage.sql.exec(
        clearIntro
          ? "UPDATE request_tickets SET status = ?, intro_enc = NULL WHERE request_hash = ?"
          : "UPDATE request_tickets SET status = ? WHERE request_hash = ?",
        effectiveStatus,
        requestHash
      );
      record.status = effectiveStatus;
      if (clearIntro) {
        record.introEnc = null;
      }
    }

    return record;
  }

  setRequestStatus(
    requestHash: string,
    status: RequestTicketStatus,
    expectedStatus?: RequestTicketStatus,
    clearIntro?: boolean
  ): SetRequestStatusResult {
    if (!isSafeHash(requestHash) || !status) {
      return { ok: false, error: "invalid" };
    }

    const row = this.ctx.storage.sql
      .exec<RequestRow>(
        "SELECT * FROM request_tickets WHERE request_hash = ? LIMIT 1",
        requestHash
      )
      .toArray()[0];

    if (!row) {
      return { ok: false, error: "not_found" };
    }

    const current = effectiveRequestStatus(
      row.status as RequestTicketRecord["status"],
      row.expires_at
    );
    const next = status;

    if (
      expectedStatus &&
      expectedStatus !== current &&
      expectedStatus !== row.status
    ) {
      return { ok: false, error: "conflict" };
    }

    if (current === next) {
      return { ok: true, status: current };
    }

    if (!canTransitionRequestStatus(current, next)) {
      return { ok: false, error: "conflict" };
    }

    const shouldClearIntro = clearIntro === true || shouldClearRequestIntro(next);
    this.ctx.storage.sql.exec(
      shouldClearIntro
        ? "UPDATE request_tickets SET status = ?, intro_enc = NULL WHERE request_hash = ?"
        : "UPDATE request_tickets SET status = ? WHERE request_hash = ?",
      next,
      requestHash
    );

    return { ok: true, status: next };
  }
}
