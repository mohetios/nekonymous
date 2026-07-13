import type { UnixMillis } from "../primitives";

export type SanctionStatus = "clear" | "suspended" | "probation" | "banned";

export type SafetyDecision =
  | Readonly<{ status: "clear"; allowed: true; strikeCount: number }>
  | Readonly<{
      status: "suspended";
      allowed: false;
      strikeCount: number;
      suspendedUntil: UnixMillis;
      probationUntil: UnixMillis;
    }>
  | Readonly<{
      status: "probation";
      allowed: true;
      strikeCount: number;
      probationUntil: UnixMillis;
    }>
  | Readonly<{ status: "banned"; allowed: false; strikeCount: number }>;

export type ReportReasonCode = "inbox_report" | "spam";
