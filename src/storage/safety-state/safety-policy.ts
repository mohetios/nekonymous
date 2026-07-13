import type { SafetyPolicy } from "../../contracts/safety/policy";

export const safetyPolicy = {
  firstStrikeWindowMs: 24 * 60 * 60 * 1000,
  firstStrikeUniqueReporters: 5,
  firstSuspensionMs: 72 * 60 * 60 * 1000,
  probationDurationMs: 30 * 24 * 60 * 60 * 1000,
  probationWindowMs: 7 * 24 * 60 * 60 * 1000,
  probationUniqueReporters: 3,
  reportEventRetentionMs: 90 * 24 * 60 * 60 * 1000,
} as const satisfies SafetyPolicy;

export const FIRST_STRIKE_WINDOW = safetyPolicy.firstStrikeWindowMs;
export const FIRST_STRIKE_UNIQUE_REPORTERS =
  safetyPolicy.firstStrikeUniqueReporters;
export const FIRST_SUSPENSION_DURATION = safetyPolicy.firstSuspensionMs;

export const PROBATION_DURATION = safetyPolicy.probationDurationMs;
export const PROBATION_WINDOW = safetyPolicy.probationWindowMs;
export const PROBATION_UNIQUE_REPORTERS = safetyPolicy.probationUniqueReporters;

export const REPORT_EVENT_RETENTION = safetyPolicy.reportEventRetentionMs;
