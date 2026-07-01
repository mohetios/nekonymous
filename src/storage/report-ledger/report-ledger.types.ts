export type ReportLedgerEvent = {
  reportId: string;
  senderAbuseTag: string;
  pairAbuseTag?: string | null;
  linkAbuseTag?: string | null;
  reporterProofTag: string;
  reasonCode: string;
  evidenceRef?: string | null;
  createdAt: number;
};

export type ReportLedgerResult = {
  ok: boolean;
  duplicate: boolean;
};
