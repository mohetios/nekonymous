import type { Environment } from "../../contracts/runtime";
import { shardNameForLookupHash } from "../shard-routing";
import { REPORT_EVENT_RETENTION } from "./safety-policy";
import type {
  GetSafetyDecisionInput,
  OperatorClearSanctionInput,
  SafetyReportResult,
  SubmitReportInput,
} from "../../contracts/safety/rpc";
import type { SafetyDecision } from "../../contracts/safety/model";

const stub = (env: Environment, abuseSubjectTag: string) =>
  env.SAFETY_STATE_DO.get(
    env.SAFETY_STATE_DO.idFromName(
      shardNameForLookupHash("safety", abuseSubjectTag)
    )
  );

export const getSafetyDecision = (
  env: Environment,
  abuseSubjectTag: GetSafetyDecisionInput["abuseSubjectTag"]
): Promise<SafetyDecision> =>
  stub(env, abuseSubjectTag).getSafetyDecision(Date.now());

export const refreshExpiredSanction = (
  env: Environment,
  abuseSubjectTag: GetSafetyDecisionInput["abuseSubjectTag"]
): Promise<SafetyDecision> =>
  stub(env, abuseSubjectTag).refreshExpiredSanction(Date.now());

export const submitReport = (
  env: Environment,
  abuseSubjectTag: GetSafetyDecisionInput["abuseSubjectTag"],
  event: Omit<SubmitReportInput, "expiresAt">
): Promise<SafetyReportResult> =>
  stub(env, abuseSubjectTag).submitReport({
    ...event,
    expiresAt: event.createdAt + REPORT_EVENT_RETENTION,
  });

export const operatorClearSanction = (
  env: Environment,
  abuseSubjectTag: OperatorClearSanctionInput["abuseSubjectTag"]
): Promise<SafetyDecision> =>
  stub(env, abuseSubjectTag).operatorClearSanction(Date.now());
