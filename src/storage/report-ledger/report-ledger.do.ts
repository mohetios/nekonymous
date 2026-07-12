import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import type { ReportLedgerEvent, ReportLedgerResult } from "./report-ledger.types";

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

  createReport(body: ReportLedgerEvent): ReportLedgerResult {
    if (
      !body.reportId ||
      !isSafeTag(body.senderAbuseTag) ||
      !isSafeTag(body.reporterProofTag) ||
      !body.reasonCode ||
      !Number.isSafeInteger(body.createdAt)
    ) {
      return { ok: false, duplicate: false };
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
      return { ok: true, duplicate: true };
    }

    return { ok: true, duplicate: false };
  }
}
