import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../contracts/runtime";
import type { ReportReasonCode } from "../../contracts/safety/model";
import {
  FIRST_STRIKE_UNIQUE_REPORTERS,
  FIRST_STRIKE_WINDOW,
  FIRST_SUSPENSION_DURATION,
  PROBATION_DURATION,
  PROBATION_UNIQUE_REPORTERS,
  PROBATION_WINDOW,
  REPORT_EVENT_RETENTION,
} from "./safety-policy";
import type {
  SafetyDecision,
  SanctionStatus,
} from "../../contracts/safety/model";
import type {
  SafetyReportEvent,
  SafetyReportResult,
} from "../../contracts/safety/rpc";

const isSafeTag = (value: string): boolean => /^[A-Za-z0-9_-]{16,86}$/.test(value);

const ALLOWED_REASON_CODES = new Set<ReportReasonCode>([
  "inbox_report",
  "spam",
]);

const isReportEventConflict = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("unique constraint") && message.includes("event_tag");
};

type SanctionRow = {
  status: SanctionStatus;
  strike_count: number;
  suspended_until: number | null;
  probation_until: number | null;
  updated_at: number;
};

export class SafetyStateDurableObject extends DurableObject<Environment> {
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
        event_tag TEXT PRIMARY KEY,
        reporter_subject_tag TEXT NOT NULL,
        reason_code TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reporter_subject_created
      ON report_events(reporter_subject_tag, created_at);

      CREATE INDEX IF NOT EXISTS idx_report_events_created
      ON report_events(created_at);

      CREATE TABLE IF NOT EXISTS sanction_state (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        status TEXT NOT NULL,
        strike_count INTEGER NOT NULL,
        suspended_until INTEGER,
        probation_until INTEGER,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  private getSanctionRow(): { row: SanctionRow; persisted: boolean } {
    const row = this.ctx.storage.sql
      .exec<SanctionRow>(
        `SELECT status, strike_count, suspended_until, probation_until, updated_at
         FROM sanction_state WHERE singleton_id = 1`
      )
      .toArray()[0];
    if (row) {
      return { row, persisted: true };
    }
    return {
      persisted: false,
      row: {
        status: "clear",
        strike_count: 0,
        suspended_until: null,
        probation_until: null,
        // Ephemeral clear: phase window starts at (now - FIRST_STRIKE_WINDOW),
        // not "this millisecond", so reports can accumulate before first persist.
        updated_at: 0,
      },
    };
  }

  private saveSanction(row: SanctionRow): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO sanction_state (
        singleton_id, status, strike_count, suspended_until, probation_until, updated_at
       ) VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(singleton_id) DO UPDATE SET
        status = excluded.status,
        strike_count = excluded.strike_count,
        suspended_until = excluded.suspended_until,
        probation_until = excluded.probation_until,
        updated_at = excluded.updated_at`,
      row.status,
      row.strike_count,
      row.suspended_until,
      row.probation_until,
      row.updated_at
    );
  }

  private refresh(row: SanctionRow, now: number): SanctionRow {
    if (row.status === "banned") {
      return row;
    }
    if (row.status === "suspended" && row.suspended_until !== null && row.suspended_until <= now) {
      const next: SanctionRow = {
        status: "probation",
        strike_count: row.strike_count,
        suspended_until: null,
        probation_until: row.probation_until,
        updated_at: now,
      };
      this.saveSanction(next);
      return next;
    }
    if (row.status === "probation" && row.probation_until !== null && row.probation_until <= now) {
      const next: SanctionRow = {
        status: "clear",
        strike_count: row.strike_count,
        suspended_until: null,
        probation_until: null,
        updated_at: now,
      };
      this.saveSanction(next);
      return next;
    }
    return row;
  }

  private decision(row: SanctionRow): SafetyDecision {
    switch (row.status) {
      case "clear":
        return { status: "clear", allowed: true, strikeCount: row.strike_count };
      case "suspended":
        return {
          status: "suspended",
          allowed: false,
          strikeCount: row.strike_count,
          suspendedUntil: row.suspended_until ?? row.updated_at,
          probationUntil: row.probation_until ?? row.updated_at,
        };
      case "probation":
        return {
          status: "probation",
          allowed: true,
          strikeCount: row.strike_count,
          probationUntil: row.probation_until ?? row.updated_at,
        };
      case "banned":
        return { status: "banned", allowed: false, strikeCount: row.strike_count };
    }
  }

  private distinctReportersSince(since: number): number {
    return this.ctx.storage.sql
      .exec<{ count: number }>(
        `SELECT COUNT(*) AS count FROM (
           SELECT reporter_subject_tag FROM report_events
           WHERE created_at >= ?
           GROUP BY reporter_subject_tag
         )`,
        since
      )
      .one().count;
  }

  /** Count reporters only inside the current sanction phase window. */
  private reportersSincePhase(now: number, policyWindowMs: number, phaseStartedAt: number): number {
    const since = Math.max(now - policyWindowMs, phaseStartedAt);
    return this.distinctReportersSince(since);
  }

  getSafetyDecision(): SafetyDecision {
    const now = Date.now();
    return this.decision(this.refresh(this.getSanctionRow().row, now));
  }

  refreshExpiredSanction(): SafetyDecision {
    return this.getSafetyDecision();
  }

  submitReport(body: SafetyReportEvent): SafetyReportResult {
    const now = Date.now();
    if (
      !isSafeTag(body.eventTag) ||
      !isSafeTag(body.reporterSubjectTag) ||
      !ALLOWED_REASON_CODES.has(body.reasonCode)
    ) {
      return {
        ok: false,
        duplicate: false,
        decision: this.getSafetyDecision(),
      };
    }

    const initial = this.getSanctionRow();
    let row = this.refresh(initial.row, now);
    const persisted = initial.persisted;

    this.ctx.storage.sql.exec("DELETE FROM report_events WHERE expires_at <= ?", now);

    const expiresAt = now + REPORT_EVENT_RETENTION;
    let duplicate = false;
    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO report_events (
          event_tag, reporter_subject_tag, reason_code, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?)`,
        body.eventTag,
        body.reporterSubjectTag,
        body.reasonCode,
        now,
        expiresAt
      );
    } catch (error) {
      if (isReportEventConflict(error)) {
        duplicate = true;
      } else {
        throw error;
      }
    }

    if (!duplicate && row.status !== "banned") {
      if (row.status === "probation") {
        const reporters = this.reportersSincePhase(
          now,
          PROBATION_WINDOW,
          row.updated_at
        );
        if (reporters >= PROBATION_UNIQUE_REPORTERS) {
          row = {
            status: "banned",
            strike_count: row.strike_count,
            suspended_until: null,
            probation_until: null,
            updated_at: now,
          };
          this.saveSanction(row);
        }
      } else if (row.status === "clear") {
        // Persist FIRST_STRIKE phase start on the first countable report so the
        // window does not reset to "now" on every subsequent report.
        if (!persisted) {
          row = {
            status: "clear",
            strike_count: row.strike_count,
            suspended_until: null,
            probation_until: null,
            updated_at: now,
          };
          this.saveSanction(row);
        }
        const reporters = this.reportersSincePhase(
          now,
          FIRST_STRIKE_WINDOW,
          row.updated_at
        );
        if (reporters >= FIRST_STRIKE_UNIQUE_REPORTERS) {
          if (row.strike_count >= 1) {
            row = {
              status: "banned",
              strike_count: row.strike_count,
              suspended_until: null,
              probation_until: null,
              updated_at: now,
            };
          } else {
            const suspendedUntil = now + FIRST_SUSPENSION_DURATION;
            row = {
              status: "suspended",
              strike_count: 1,
              suspended_until: suspendedUntil,
              probation_until: suspendedUntil + PROBATION_DURATION,
              updated_at: now,
            };
          }
          this.saveSanction(row);
        }
      }
    }

    return { ok: true, duplicate, decision: this.decision(row) };
  }

  operatorClearSanction(): SafetyDecision {
    const now = Date.now();
    const row: SanctionRow = {
      status: "clear",
      strike_count: 0,
      suspended_until: null,
      probation_until: null,
      updated_at: now,
    };
    this.saveSanction(row);
    return this.decision(row);
  }
}
