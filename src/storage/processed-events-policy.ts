export type ProcessedEventStatus = "processing" | "done" | "failed";

export type ProcessedEventSnapshot = {
  status: ProcessedEventStatus;
  leaseUntil: number | null;
  expiresAt: number;
};

export type ProcessedEventClaimState = "acquired" | "processing" | "done";

export const resolveProcessedEventClaim = (
  existing: ProcessedEventSnapshot | null,
  now: number
): ProcessedEventClaimState => {
  if (!existing) {
    return "acquired";
  }
  if (existing.status === "done" && existing.expiresAt > now) {
    return "done";
  }
  if (existing.status === "processing" && (existing.leaseUntil ?? 0) > now) {
    return "processing";
  }
  return "acquired";
};
