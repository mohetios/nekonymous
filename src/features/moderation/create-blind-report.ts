import type { Environment } from "../../types";
import { createReportEvidenceTag, createReportTag } from "../ticketing/keys";
import { randomBase64Url } from "../ticketing/base64url";
import { recordReportEvent } from "../../storage/report-ledger/report-ledger.client";
import type { RouteCapsule } from "../ticketing/create-sealed-ticket";
import { deriveBlindAbuseTags } from "./abuse-tags";

export type CreateBlindReportInput = {
  actorHash: string;
  ticketHash: string;
  route: RouteCapsule;
  reasonCode: string;
};

export const createBlindReport = async (
  env: Environment,
  input: CreateBlindReportInput
): Promise<{ reportId: string; duplicate: boolean }> => {
  const tags = await deriveBlindAbuseTags(env, input.route);
  const reporterProofTag = await createReportTag(
    env.APP_HMAC_PEPPER,
    `${input.actorHash}:${input.ticketHash}`
  );
  const evidenceRef = await createReportEvidenceTag(
    env.APP_HMAC_PEPPER,
    input.ticketHash
  );
  const reportId = randomBase64Url(12);
  const result = await recordReportEvent(env, {
    reportId,
    senderAbuseTag: tags.senderAbuseTag,
    pairAbuseTag: tags.pairAbuseTag,
    linkAbuseTag: tags.linkAbuseTag ?? null,
    reporterProofTag,
    reasonCode: input.reasonCode,
    evidenceRef,
    createdAt: Date.now(),
  });

  return {
    reportId,
    duplicate: result.duplicate,
  };
};
