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
  ClaimRequestAcceptResult,
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

const isSafeOperationId = (value: string): boolean =>
  /^[A-Za-z0-9:_-]{1,160}$/.test(value);

const REQUEST_ACCEPT_LEASE_MS = 30 * 1000;

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
  accept_operation_id: string | null;
  accept_lease_until: number | null;
  accepted_ticket_hash: string | null;
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
  acceptOperationId: row.accept_operation_id,
  acceptLeaseUntil: row.accept_lease_until,
  acceptedTicketHash: row.accepted_ticket_hash,
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
        accept_operation_id TEXT,
        accept_lease_until INTEGER,
        accepted_ticket_hash TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_request_tickets_status_expires
        ON request_tickets(status, expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);

    this.ensureRequestAcceptColumns();
  }

  private ensureRequestAcceptColumns(): void {
    const columns = new Set(
      this.ctx.storage.sql
        .exec<{ name: string }>("PRAGMA table_info(request_tickets)")
        .toArray()
        .map((column) => column.name)
    );

    if (!columns.has("accept_operation_id")) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE request_tickets ADD COLUMN accept_operation_id TEXT"
      );
    }
    if (!columns.has("accept_lease_until")) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE request_tickets ADD COLUMN accept_lease_until INTEGER"
      );
    }
    if (!columns.has("accepted_ticket_hash")) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE request_tickets ADD COLUMN accepted_ticket_hash TEXT"
      );
    }
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
        status, accept_operation_id, accept_lease_until, accepted_ticket_hash,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
      ON CONFLICT(request_hash) DO UPDATE SET
        requester_proof_tag = excluded.requester_proof_tag,
        candidate_proof_tag = excluded.candidate_proof_tag,
        requester_route_enc = excluded.requester_route_enc,
        candidate_route_enc = excluded.candidate_route_enc,
        intro_enc = excluded.intro_enc,
        status = excluded.status,
        accept_operation_id = NULL,
        accept_lease_until = NULL,
        accepted_ticket_hash = NULL,
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
          ? `UPDATE request_tickets
             SET status = ?,
                 intro_enc = NULL,
                 accept_lease_until = NULL
             WHERE request_hash = ?`
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
        ? `UPDATE request_tickets
           SET status = ?,
               intro_enc = NULL,
               accept_lease_until = NULL
           WHERE request_hash = ?`
        : `UPDATE request_tickets
           SET status = ?,
               accept_lease_until = CASE WHEN ? = 'accepting' THEN accept_lease_until ELSE NULL END
           WHERE request_hash = ?`,
      next,
      ...(shouldClearIntro ? [] : [next]),
      requestHash
    );

    return { ok: true, status: next };
  }

  claimRequestAccept(
    requestHash: string,
    operationId: string,
    leaseMsInput?: number
  ): ClaimRequestAcceptResult {
    if (!isSafeHash(requestHash) || !isSafeOperationId(operationId)) {
      return { ok: false, error: "invalid" };
    }

    const leaseMs =
      typeof leaseMsInput === "number" && Number.isFinite(leaseMsInput)
        ? Math.max(1000, Math.min(5 * 60 * 1000, Math.floor(leaseMsInput)))
        : REQUEST_ACCEPT_LEASE_MS;
    const now = Date.now();
    const leaseUntil = now + leaseMs;
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
      row.expires_at,
      now
    );

    if (current === "expired") {
      this.ctx.storage.sql.exec(
        `UPDATE request_tickets
         SET status = 'expired',
             intro_enc = NULL,
             accept_lease_until = NULL
         WHERE request_hash = ?`,
        requestHash
      );
      return { ok: false, error: "expired" };
    }

    if (current === "accepted") {
      return {
        ok: true,
        state: "accepted",
        acceptedTicketHash: row.accepted_ticket_hash,
      };
    }

    if (current === "pending") {
      this.ctx.storage.sql.exec(
        `UPDATE request_tickets
         SET status = 'accepting',
             accept_operation_id = ?,
             accept_lease_until = ?
         WHERE request_hash = ?`,
        operationId,
        leaseUntil,
        requestHash
      );
      return { ok: true, state: "acquired" };
    }

    if (current === "accepting") {
      if (row.accept_operation_id !== operationId) {
        return { ok: false, error: "conflict" };
      }
      if ((row.accept_lease_until ?? 0) > now) {
        return { ok: true, state: "processing" };
      }
      this.ctx.storage.sql.exec(
        `UPDATE request_tickets
         SET accept_lease_until = ?
         WHERE request_hash = ?`,
        leaseUntil,
        requestHash
      );
      return { ok: true, state: "acquired" };
    }

    return { ok: false, error: "conflict" };
  }

  completeRequestAccept(
    requestHash: string,
    operationId: string,
    acceptedTicketHash: string
  ): SetRequestStatusResult {
    if (
      !isSafeHash(requestHash) ||
      !isSafeOperationId(operationId) ||
      !isSafeHash(acceptedTicketHash)
    ) {
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

    const current = row.status as RequestTicketRecord["status"];
    if (current === "accepted") {
      if (
        row.accepted_ticket_hash &&
        row.accepted_ticket_hash !== acceptedTicketHash
      ) {
        return { ok: false, error: "conflict" };
      }
      return { ok: true, status: "accepted" };
    }

    if (
      current !== "accepting" ||
      row.accept_operation_id !== operationId ||
      !canTransitionRequestStatus(current, "accepted")
    ) {
      return { ok: false, error: "conflict" };
    }

    this.ctx.storage.sql.exec(
      `UPDATE request_tickets
       SET status = 'accepted',
           intro_enc = NULL,
           accept_lease_until = NULL,
           accepted_ticket_hash = ?
       WHERE request_hash = ?`,
      acceptedTicketHash,
      requestHash
    );
    return { ok: true, status: "accepted" };
  }

  failRequestAccept(
    requestHash: string,
    operationId: string
  ): SetRequestStatusResult {
    if (!isSafeHash(requestHash) || !isSafeOperationId(operationId)) {
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

    if (row.status === "accepted") {
      return { ok: true, status: "accepted" };
    }

    if (
      row.status !== "accepting" ||
      row.accept_operation_id !== operationId
    ) {
      return { ok: false, error: "conflict" };
    }

    if (row.expires_at <= Date.now()) {
      this.ctx.storage.sql.exec(
        `UPDATE request_tickets
         SET status = 'expired',
             intro_enc = NULL,
             accept_lease_until = NULL
         WHERE request_hash = ?`,
        requestHash
      );
      return { ok: true, status: "expired" };
    }

    this.ctx.storage.sql.exec(
      `UPDATE request_tickets
       SET status = 'pending',
           accept_operation_id = NULL,
           accept_lease_until = NULL
       WHERE request_hash = ?`,
      requestHash
    );
    return { ok: true, status: "pending" };
  }
}
