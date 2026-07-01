import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import type { ReportLedgerEvent } from "./report-ledger.types";

const isSafeTag = (value: string): boolean => /^[A-Za-z0-9_-]{16,86}$/.test(value);

export class ReportLedgerDurableObject extends DurableObject<Environment> {
  constructor(ctx: DurableObjectState, env: Environment) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(() => {
      this.ensureSchema();
      return Promise.resolve();
    });
  }

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS report_events (
        report_id TEXT PRIMARY KEY,
        sender_abuse_tag TEXT NOT NULL,
        pair_abuse_tag TEXT,
        link_abuse_tag TEXT,
        reporter_proof_tag TEXT NOT NULL,
        reason_code TEXT NOT NULL,
        evidence_ref TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_report
      ON report_events(reporter_proof_tag);

      CREATE INDEX IF NOT EXISTS idx_sender_abuse
      ON report_events(sender_abuse_tag, created_at);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/reports") {
      return this.createReport(request);
    }

    if (request.method === "GET" && pathname.startsWith("/pair/")) {
      return this.hasPairReport(pathname.slice("/pair/".length));
    }

    return new Response("Not Found", { status: 404 });
  }

  private async createReport(request: Request): Promise<Response> {
    const body = await request.json<ReportLedgerEvent>();

    if (
      !body.reportId ||
      !isSafeTag(body.senderAbuseTag) ||
      !isSafeTag(body.reporterProofTag) ||
      !body.reasonCode ||
      !Number.isSafeInteger(body.createdAt)
    ) {
      return new Response("Invalid report", { status: 400 });
    }

    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO report_events (
          report_id, sender_abuse_tag, pair_abuse_tag, link_abuse_tag,
          reporter_proof_tag, reason_code, evidence_ref, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        body.reportId,
        body.senderAbuseTag,
        body.pairAbuseTag ?? null,
        body.linkAbuseTag ?? null,
        body.reporterProofTag,
        body.reasonCode,
        body.evidenceRef ?? null,
        body.createdAt
      );
    } catch {
      return Response.json({ ok: true, duplicate: true });
    }

    return Response.json({ ok: true, duplicate: false });
  }

  private hasPairReport(pairAbuseTag: string): Response {
    if (!isSafeTag(pairAbuseTag)) {
      return new Response("Invalid tag", { status: 400 });
    }

    const row = this.ctx.storage.sql
      .exec<{ report_id: string }>(
        "SELECT report_id FROM report_events WHERE pair_abuse_tag = ? LIMIT 1",
        pairAbuseTag
      )
      .toArray()[0];

    return Response.json({ found: !!row });
  }
}
