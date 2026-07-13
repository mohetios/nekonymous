import { SUGGESTION_CAPABILITY_TTL_MS } from "../../ticketing/conversation-capabilities.ts";
import {
  CapabilityExpiredError,
  CapabilityProofError,
  CapabilityStateError,
  type SuggestionRouteCapsule,
} from "../../ticketing/conversation-capabilities.ts";
import {
  createConversationOwnerProofTag,
  createExposureTokenHash,
  createSuggestionLookupHash,
  deriveSuggestionExplanationKey,
  deriveSuggestionRouteKey,
  randomSuggestionRef,
  suggestionExplanationAad,
  suggestionRouteAad,
} from "../../ticketing/conversation-keys.ts";
import { encryptEnvelope } from "../../ticketing/envelope.ts";
import { resolveSuggestionCapability } from "../../ticketing/conversation-resolvers.ts";
import {
  getSuggestionRecord,
  setSuggestionStatus,
  storeSuggestionRecord,
} from "../../../storage/conversation-vault/conversation-vault.client";
import { upsertPairStateRecord } from "../../../storage/pair-ledger/pair-ledger.client";
import { recordExposureTokenHash } from "../../../storage/user-state-client";
import type { Environment } from "../../../contracts/runtime";
import { recordSuggestionDismissed } from "../../../stats/product-events";
import type { RankedCandidate } from "./ranking-types.ts";
import { PAIR_DISMISS_COOLDOWN_MS } from "./constants.ts";

export { parseSuggestionCallback } from "./suggestion-callbacks.ts";

export type IssuedSuggestion = {
  suggestionRef: string;
  explanation: string;
  pairTag: string;
};

export type SuggestionActionResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "forbidden" | "state" };

const loadSuggestionRecord = async (
  env: Environment,
  suggestionHash: string
) => getSuggestionRecord(env, suggestionHash);

export const issueSuggestionTickets = async (
  env: Environment,
  actorHash: string,
  ranked: RankedCandidate[]
): Promise<IssuedSuggestion[]> => {
  const expiresAt = Date.now() + SUGGESTION_CAPABILITY_TTL_MS;
  const issued: IssuedSuggestion[] = [];

  for (const candidate of ranked) {
    const suggestionRef = randomSuggestionRef();
    const suggestionHash = await createSuggestionLookupHash(
      env.APP_MASTER_KEY,
      suggestionRef
    );
    const requesterProofTag = await createConversationOwnerProofTag(
      env.APP_MASTER_KEY,
      actorHash,
      suggestionHash
    );

    const routeKey = await deriveSuggestionRouteKey(
      env.APP_MASTER_KEY,
      suggestionHash
    );
    const candidateRouteEnc = await encryptEnvelope(
      routeKey,
      JSON.stringify({
        candidateProfileHash: candidate.profileHash,
      } satisfies SuggestionRouteCapsule),
      suggestionRouteAad(suggestionHash)
    );

    const explanationKey = await deriveSuggestionExplanationKey(
      env.APP_MASTER_KEY,
      suggestionHash
    );
    const explanationEnc = await encryptEnvelope(
      explanationKey,
      JSON.stringify(candidate.explanation),
      suggestionExplanationAad(suggestionHash)
    );

    await storeSuggestionRecord(env, {
      suggestionHash,
      requesterProofTag,
      candidateRouteEnc,
      pairTag: candidate.pairTag,
      explanationEnc,
      status: "created",
      expiresAt,
    });

    issued.push({
      suggestionRef,
      explanation: candidate.explanation,
      pairTag: candidate.pairTag,
    });
  }

  return issued;
};

export const recordSuggestionExposure = async (
  env: Environment,
  userId: string,
  pairTags: string[]
): Promise<void> => {
  for (const pairTag of pairTags) {
    const tokenHash = await createExposureTokenHash(env.APP_MASTER_KEY, pairTag);
    await recordExposureTokenHash(env, userId, tokenHash);
  }
};

export const markSuggestionViewed = async (
  env: Environment,
  actorHash: string,
  suggestionRef: string
): Promise<SuggestionActionResult> => {
  try {
    const resolved = await resolveSuggestionCapability(
      env.APP_MASTER_KEY,
      { suggestionRef, actorHash },
      (lookupHash) => loadSuggestionRecord(env, lookupHash)
    );

    if (resolved.status === "viewed") {
      return { ok: true };
    }

    await setSuggestionStatus(
      env,
      resolved.suggestionHash,
      "viewed",
      resolved.status
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof CapabilityExpiredError) {
      return { ok: false, reason: "expired" };
    }
    if (error instanceof CapabilityProofError) {
      return { ok: false, reason: "forbidden" };
    }
    if (error instanceof CapabilityStateError) {
      return { ok: false, reason: "state" };
    }
    return { ok: false, reason: "invalid" };
  }
};

export const dismissSuggestionTicket = async (
  env: Environment,
  actorHash: string,
  suggestionRef: string
): Promise<SuggestionActionResult> => {
  try {
    const resolved = await resolveSuggestionCapability(
      env.APP_MASTER_KEY,
      { suggestionRef, actorHash, decryptRoute: true },
      (lookupHash) => loadSuggestionRecord(env, lookupHash)
    );

    if (resolved.status === "dismissed") {
      return { ok: true };
    }

    const record = await loadSuggestionRecord(env, resolved.suggestionHash);
    if (!record) {
      return { ok: false, reason: "invalid" };
    }

    await setSuggestionStatus(
      env,
      resolved.suggestionHash,
      "dismissed",
      resolved.status
    );

    await upsertPairStateRecord(env, {
      pairTag: record.pairTag,
      state: "dismiss_cooldown",
      expiresAt: Date.now() + PAIR_DISMISS_COOLDOWN_MS,
    });

    await recordSuggestionDismissed(env);
    return { ok: true };
  } catch (error) {
    if (error instanceof CapabilityExpiredError) {
      return { ok: false, reason: "expired" };
    }
    if (error instanceof CapabilityProofError) {
      return { ok: false, reason: "forbidden" };
    }
    if (error instanceof CapabilityStateError) {
      return { ok: false, reason: "state" };
    }
    return { ok: false, reason: "invalid" };
  }
};

export const markSuggestionConvertedToRequest = async (
  env: Environment,
  actorHash: string,
  suggestionRef: string
): Promise<SuggestionActionResult> => {
  try {
    const resolved = await resolveSuggestionCapability(
      env.APP_MASTER_KEY,
      { suggestionRef, actorHash },
      (lookupHash) => loadSuggestionRecord(env, lookupHash)
    );

    if (resolved.status === "converted_to_request") {
      return { ok: true };
    }

    await setSuggestionStatus(
      env,
      resolved.suggestionHash,
      "converted_to_request",
      resolved.status
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof CapabilityExpiredError) {
      return { ok: false, reason: "expired" };
    }
    if (error instanceof CapabilityProofError) {
      return { ok: false, reason: "forbidden" };
    }
    if (error instanceof CapabilityStateError) {
      return { ok: false, reason: "state" };
    }
    return { ok: false, reason: "invalid" };
  }
};

export const resolveSuggestionRoute = async (
  env: Environment,
  actorHash: string,
  suggestionRef: string
): Promise<
  | { ok: true; candidateProfileHash: string; explanation: string; pairTag: string }
  | { ok: false; reason: "invalid" | "expired" | "forbidden" | "state" }
> => {
  try {
    const resolved = await resolveSuggestionCapability(
      env.APP_MASTER_KEY,
      {
        suggestionRef,
        actorHash,
        decryptRoute: true,
        decryptExplanation: true,
      },
      (lookupHash) => loadSuggestionRecord(env, lookupHash)
    );

    if (!resolved.route || typeof resolved.explanation !== "string") {
      return { ok: false, reason: "invalid" };
    }

    const record = await loadSuggestionRecord(env, resolved.suggestionHash);
    if (!record) {
      return { ok: false, reason: "invalid" };
    }

    return {
      ok: true,
      candidateProfileHash: resolved.route.candidateProfileHash,
      explanation: resolved.explanation,
      pairTag: record.pairTag,
    };
  } catch (error) {
    if (error instanceof CapabilityExpiredError) {
      return { ok: false, reason: "expired" };
    }
    if (error instanceof CapabilityProofError) {
      return { ok: false, reason: "forbidden" };
    }
    if (error instanceof CapabilityStateError) {
      return { ok: false, reason: "state" };
    }
    return { ok: false, reason: "invalid" };
  }
};
