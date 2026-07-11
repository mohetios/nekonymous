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
  ConversationVaultShardPing,
  RequestTicketRecord,
  SuggestionTicketRecord,
} from "./conversation-vault.types";

export type { ConversationVaultShardPing } from "./conversation-vault.types";

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

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/suggestions") {
      return this.storeSuggestion(request);
    }

    if (pathname.startsWith("/suggestions/")) {
      const rest = pathname.slice("/suggestions/".length);
      if (rest.endsWith("/status")) {
        const suggestionHash = decodeURIComponent(
          rest.slice(0, -"/status".length)
        );
        if (!isSafeHash(suggestionHash)) {
          return new Response("Invalid suggestion hash", { status: 400 });
        }
        if (request.method === "POST") {
          return this.setSuggestionStatus(suggestionHash, request);
        }
      } else {
        const suggestionHash = decodeURIComponent(rest);
        if (!isSafeHash(suggestionHash)) {
          return new Response("Invalid suggestion hash", { status: 400 });
        }
        if (request.method === "GET") {
          return this.getSuggestion(suggestionHash);
        }
      }
    }

    if (request.method === "POST" && pathname === "/requests") {
      return this.storeRequest(request);
    }

    if (pathname.startsWith("/requests/")) {
      const rest = pathname.slice("/requests/".length);
      if (rest.endsWith("/status")) {
        const requestHash = decodeURIComponent(rest.slice(0, -"/status".length));
        if (!isSafeHash(requestHash)) {
          return new Response("Invalid request hash", { status: 400 });
        }
        if (request.method === "POST") {
          return this.setRequestStatus(requestHash, request);
        }
      } else {
        const requestHash = decodeURIComponent(rest);
        if (!isSafeHash(requestHash)) {
          return new Response("Invalid request hash", { status: 400 });
        }
        if (request.method === "GET") {
          return this.getRequest(requestHash);
        }
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  private async storeSuggestion(request: Request): Promise<Response> {
    const body = await request.json<{
      suggestionHash: string;
      requesterProofTag: string;
      candidateRouteEnc: string;
      pairTag: string;
      explanationEnc: string;
      status: string;
      expiresAt: number;
    }>();

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
      return new Response("Invalid suggestion payload", { status: 400 });
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

    return Response.json({ ok: true });
  }

  private getSuggestion(suggestionHash: string): Response {
    const row = this.ctx.storage.sql
      .exec<SuggestionRow>(
        "SELECT * FROM suggestion_tickets WHERE suggestion_hash = ? LIMIT 1",
        suggestionHash
      )
      .toArray()[0];

    if (!row) {
      return Response.json({ record: null });
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

    return Response.json({ record });
  }

  private async setSuggestionStatus(
    suggestionHash: string,
    request: Request
  ): Promise<Response> {
    const body = await request.json<{ status: string; expectedStatus?: string }>();
    if (!body.status) {
      return new Response("Invalid suggestion status payload", { status: 400 });
    }

    const row = this.ctx.storage.sql
      .exec<SuggestionRow>(
        "SELECT * FROM suggestion_tickets WHERE suggestion_hash = ? LIMIT 1",
        suggestionHash
      )
      .toArray()[0];

    if (!row) {
      return new Response("Suggestion not found", { status: 404 });
    }

    const current = effectiveSuggestionStatus(
      row.status as SuggestionTicketRecord["status"],
      row.expires_at
    );
    const next = body.status as SuggestionTicketRecord["status"];

    if (
      body.expectedStatus &&
      body.expectedStatus !== current &&
      body.expectedStatus !== row.status
    ) {
      return new Response("Suggestion status mismatch", { status: 409 });
    }

    if (current === next) {
      return Response.json({ ok: true, status: current });
    }

    if (!canTransitionSuggestionStatus(current, next)) {
      return new Response("Suggestion transition rejected", { status: 409 });
    }

    this.ctx.storage.sql.exec(
      "UPDATE suggestion_tickets SET status = ? WHERE suggestion_hash = ?",
      next,
      suggestionHash
    );

    return Response.json({ ok: true, status: next });
  }

  private async storeRequest(request: Request): Promise<Response> {
    const body = await request.json<{
      requestHash: string;
      requesterProofTag: string;
      candidateProofTag: string;
      requesterRouteEnc: string;
      candidateRouteEnc: string;
      introEnc: string;
      status: string;
      expiresAt: number;
    }>();

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
      return new Response("Invalid request payload", { status: 400 });
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

    return Response.json({ ok: true });
  }

  private getRequest(requestHash: string): Response {
    const row = this.ctx.storage.sql
      .exec<RequestRow>(
        "SELECT * FROM request_tickets WHERE request_hash = ? LIMIT 1",
        requestHash
      )
      .toArray()[0];

    if (!row) {
      return Response.json({ record: null });
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

    return Response.json({ record });
  }

  private async setRequestStatus(
    requestHash: string,
    request: Request
  ): Promise<Response> {
    const body = await request.json<{
      status: string;
      expectedStatus?: string;
      clearIntro?: boolean;
    }>();
    if (!body.status) {
      return new Response("Invalid request status payload", { status: 400 });
    }

    const row = this.ctx.storage.sql
      .exec<RequestRow>(
        "SELECT * FROM request_tickets WHERE request_hash = ? LIMIT 1",
        requestHash
      )
      .toArray()[0];

    if (!row) {
      return new Response("Request not found", { status: 404 });
    }

    const current = effectiveRequestStatus(
      row.status as RequestTicketRecord["status"],
      row.expires_at
    );
    const next = body.status as RequestTicketRecord["status"];

    if (
      body.expectedStatus &&
      body.expectedStatus !== current &&
      body.expectedStatus !== row.status
    ) {
      return new Response("Request status mismatch", { status: 409 });
    }

    if (current === next) {
      return Response.json({ ok: true, status: current });
    }

    if (!canTransitionRequestStatus(current, next)) {
      return new Response("Request transition rejected", { status: 409 });
    }

    const clearIntro =
      body.clearIntro === true || shouldClearRequestIntro(next);
    this.ctx.storage.sql.exec(
      clearIntro
        ? "UPDATE request_tickets SET status = ?, intro_enc = NULL WHERE request_hash = ?"
        : "UPDATE request_tickets SET status = ? WHERE request_hash = ?",
      next,
      requestHash
    );

    return Response.json({ ok: true, status: next });
  }

  ping(): ConversationVaultShardPing {
    const suggestions =
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM suggestion_tickets")
        .one().n ?? 0;
    const requests =
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM request_tickets")
        .one().n ?? 0;

    return {
      ok: true,
      plane: "conversation",
      suggestions,
      requests,
    };
  }
}
