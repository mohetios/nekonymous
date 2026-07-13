export type SafetyPolicy = Readonly<{
  firstStrikeWindowMs: number;
  firstStrikeUniqueReporters: number;
  firstSuspensionMs: number;
  probationDurationMs: number;
  probationWindowMs: number;
  probationUniqueReporters: number;
  reportEventRetentionMs: number;
}>;
