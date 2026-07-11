import type { Environment } from "../../types";
import { createReportTag } from "../ticketing/keys";
import type { RouteCapsule } from "../messaging/create-sealed-ticket";

export type BlindAbuseTags = {
  senderAbuseTag: string;
  pairAbuseTag: string;
  linkAbuseTag?: string;
};

export const deriveBlindAbuseTags = async (
  env: Environment,
  route: RouteCapsule
): Promise<BlindAbuseTags> => {
  const [senderAbuseTag, pairAbuseTag, linkAbuseTag] = await Promise.all([
    createReportTag(env.APP_HMAC_PEPPER, route.reportSeeds.senderAbuseSeed),
    createReportTag(env.APP_HMAC_PEPPER, route.reportSeeds.pairAbuseSeed),
    route.reportSeeds.linkAbuseSeed
      ? createReportTag(env.APP_HMAC_PEPPER, route.reportSeeds.linkAbuseSeed)
      : Promise.resolve(undefined),
  ]);

  return {
    senderAbuseTag,
    pairAbuseTag,
    ...(linkAbuseTag ? { linkAbuseTag } : {}),
  };
};
