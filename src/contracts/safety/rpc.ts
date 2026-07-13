import type {
  AbuseSubjectTag,
  ReportEventTag,
  ReporterSubjectTag,
  UnixMillis,
} from "../primitives";
import type { ReportReasonCode, SafetyDecision } from "./model";

export type SafetyReportEvent = Readonly<{
  eventTag: ReportEventTag;
  reporterSubjectTag: ReporterSubjectTag;
  reasonCode: ReportReasonCode;
  createdAt: UnixMillis;
  expiresAt: UnixMillis;
}>;

export type SafetyReportResult = Readonly<{
  ok: boolean;
  duplicate: boolean;
  decision: SafetyDecision;
}>;

export type GetSafetyDecisionInput = Readonly<{
  abuseSubjectTag: AbuseSubjectTag;
}>;

export type SubmitReportInput = SafetyReportEvent;
export type OperatorClearSanctionInput = GetSafetyDecisionInput;
