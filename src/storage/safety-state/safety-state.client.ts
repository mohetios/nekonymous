import type { Environment } from "../../contracts/runtime";
import { REPORT_EVENT_RETENTION } from "./safety-policy";
import type {
  GetSafetyDecisionInput,
  OperatorClearSanctionInput,
  SafetyReportResult,
  SubmitReportInput,
} from "../../contracts/safety/rpc";
import type { SafetyDecision } from "../../contracts/safety/model";

/** One Durable Object per abuse subject — never shard by tag prefix. */
const stub = (env: Environment, abuseSubjectTag: string) =>
  env.SAFETY_STATE_DO.get(
    env.SAFETY_STATE_DO.idFromName(`safety:${abuseSubjectTag}`)
  );

export const getSafetyDecision = (
  env: Environment,
  abuseSubjectTag: GetSafetyDecisionInput["abuseSubjectTag"]
): Promise<SafetyDecision> => stub(env, abuseSubjectTag).getSafetyDecision();

export const refreshExpiredSanction = (
  env: Environment,
  abuseSubjectTag: GetSafetyDecisionInput["abuseSubjectTag"]
): Promise<SafetyDecision> =>
  stub(env, abuseSubjectTag).refreshExpiredSanction();

export const submitReport = (
  env: Environment,
  abuseSubjectTag: GetSafetyDecisionInput["abuseSubjectTag"],
  event: SubmitReportInput
): Promise<SafetyReportResult> =>
  stub(env, abuseSubjectTag).submitReport(event);

export const operatorClearSanction = (
  env: Environment,
  abuseSubjectTag: OperatorClearSanctionInput["abuseSubjectTag"]
): Promise<SafetyDecision> =>
  stub(env, abuseSubjectTag).operatorClearSanction();

export { REPORT_EVENT_RETENTION };
