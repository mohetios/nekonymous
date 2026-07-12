import type { Environment } from "../../types";
import type {
  ReportLedgerEvent,
  ReportLedgerResult,
} from "./report-ledger.types";

const shardName = (tag: string): string => tag.slice(0, 8);

const stub = (env: Environment, tag: string) =>
  env.REPORT_LEDGER.get(env.REPORT_LEDGER.idFromName(shardName(tag)));

export const recordReportEvent = async (
  env: Environment,
  event: ReportLedgerEvent
): Promise<ReportLedgerResult> =>
  stub(env, event.pairAbuseTag ?? event.senderAbuseTag).createReport(event);
