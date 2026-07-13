import {
  REQUEST_CAPABILITY_TTL_MS,
  CapabilityExpiredError,
  CapabilityProofError,
  CapabilityStateError,
  activeProfileStatuses,
  type RequestRouteCapsule,
} from "../../ticketing/conversation-capabilities.ts";
import {
  createConversationOwnerProofTag,
  createRequestLookupHash,
  deriveRequestIntroKey,
  deriveRequestRouteKey,
  randomRequestRef,
  requestIntroAad,
  requestRouteAad,
} from "../../ticketing/conversation-keys.ts";
import {
  resolveRequestCapability,
  resolveRequestForCandidate,
} from "../../ticketing/conversation-resolvers.ts";
import { encryptEnvelope } from "../../ticketing/envelope.ts";
import {
  getActiveSlugForUser,
  getUserById,
} from "../../identity/identity-service.ts";
import { createSealedTicket } from "../../ticketing/create-sealed-ticket.ts";
import {
  claimRequestAccept,
  completeRequestAccept,
  failRequestAccept,
  getRequestRecord,
  setRequestStatus,
  storeRequestRecord,
} from "../../../storage/conversation-vault/conversation-vault.client";
import { getProfileRecord } from "../../../storage/profile-vault/profile-vault.client";
import {
  acquirePairPendingLock,
  releasePairPendingLock,
  upsertPairStateRecord,
} from "../../../storage/pair-ledger/pair-ledger.client";
import type { D1User } from "../../../contracts/identity/model";
import type { Environment } from "../../../contracts/runtime";
import {
  recordRequestSent,
  recordRequestCanceled,
  recordRequestDeclined,
  recordRequestAccepted,
} from "../../../stats/product-events";
import {
  PAIR_ACCEPTED_COOLDOWN_MS,
  PAIR_DECLINED_COOLDOWN_MS,
} from "./constants.ts";
import { markSuggestionConvertedToRequest } from "./suggestion-service.ts";
import {
  notifyIncomingConversationRequest,
  notifyRequesterAccepted,
  notifyRequesterDeclined,
} from "./request-notify.ts";

export { parseRequestCallback } from "./request-callbacks.ts";

export type IssuedRequest = {
  requestRef: string;
  requestHash: string;
};

export type RequestActionResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "forbidden" | "state" | "blocked" };

export type CreateConversationRequestInput = {
  requester: D1User;
  requesterActorHash: string;
  requesterProfileHash: string;
  candidateProfileHash: string;
  pairTag: string;
  introText: string;
  explanation: string;
  suggestionRef?: string;
};

const REQUEST_ACCEPT_LEASE_MS = 30 * 1000;

const requestAcceptOperationId = (requestHash: string): string =>
  `conversation-request:${requestHash}`;

const loadRequestRecord = async (env: Environment, requestHash: string) =>
  getRequestRecord(env, requestHash);

const loadProfileRecord = async (env: Environment, profileHash: string) =>
  getProfileRecord(env, profileHash);

const profileCanCreateRequest = async (
  env: Environment,
  requesterProfileHash: string,
  candidateProfileHash: string
): Promise<boolean> => {
  const [requesterProfile, candidateProfile] = await Promise.all([
    getProfileRecord(env, requesterProfileHash),
    getProfileRecord(env, candidateProfileHash),
  ]);

  return (
    !!requesterProfile &&
    activeProfileStatuses.has(requesterProfile.status) &&
    candidateProfile?.status === "discoverable"
  );
};

const mapRequestError = (error: unknown): RequestActionResult => {
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
};

export const createConversationRequest = async (
  env: Environment,
  input: CreateConversationRequestInput
): Promise<RequestActionResult & { request?: IssuedRequest }> => {
  const introText = input.introText.trim();
  if (!introText) {
    return { ok: false, reason: "invalid" };
  }
  if (
    !(await profileCanCreateRequest(
      env,
      input.requesterProfileHash,
      input.candidateProfileHash
    ))
  ) {
    return { ok: false, reason: "state" };
  }

  const expiresAt = Date.now() + REQUEST_CAPABILITY_TTL_MS;
  const lock = await acquirePairPendingLock(env, input.pairTag, expiresAt);
  if (!lock.ok) {
    return { ok: false, reason: "blocked" };
  }

  if (input.suggestionRef) {
    const converted = await markSuggestionConvertedToRequest(
      env,
      input.requesterActorHash,
      input.suggestionRef
    );
    if (!converted.ok) {
      await releasePairPendingLock(env, input.pairTag);
      return converted;
    }
  }

  const requestRef = randomRequestRef();
  const requestHash = await createRequestLookupHash(env.APP_MASTER_KEY, requestRef);
  const requesterProofTag = await createConversationOwnerProofTag(
    env.APP_MASTER_KEY,
    input.requesterActorHash,
    requestHash
  );
  const candidateProofTag = await createConversationOwnerProofTag(
    env.APP_MASTER_KEY,
    input.candidateProfileHash,
    requestHash
  );

  const routeKey = await deriveRequestRouteKey(env.APP_MASTER_KEY, requestHash);
  const requesterRouteEnc = await encryptEnvelope(
    routeKey,
    JSON.stringify({
      requesterProfileHash: input.requesterProfileHash,
      candidateProfileHash: input.candidateProfileHash,
      requesterUserId: input.requester.id,
      pairTag: input.pairTag,
    } satisfies RequestRouteCapsule),
    requestRouteAad(requestHash)
  );

  const introKey = await deriveRequestIntroKey(env.APP_MASTER_KEY, requestHash);
  const introEnc = await encryptEnvelope(
    introKey,
    JSON.stringify(introText),
    requestIntroAad(requestHash)
  );

  try {
    await storeRequestRecord(env, {
      requestHash,
      requesterProofTag,
      candidateProofTag,
      requesterRouteEnc,
      candidateRouteEnc: "{}",
      introEnc,
      status: "pending",
      expiresAt,
    });
  } catch {
    await releasePairPendingLock(env, input.pairTag);
    return { ok: false, reason: "invalid" };
  }

  await recordRequestSent(env);
  await notifyIncomingConversationRequest(
    env,
    input.candidateProfileHash,
    requestRef,
    requestHash,
    introText,
    input.explanation
  );
  return {
    ok: true,
    request: { requestRef, requestHash },
  };
};

export const cancelConversationRequest = async (
  env: Environment,
  requesterActorHash: string,
  requestRef: string
): Promise<RequestActionResult> => {
  try {
    const resolved = await resolveRequestCapability(
      env.APP_MASTER_KEY,
      { requestRef, actorHash: requesterActorHash, decryptRoute: true },
      (lookupHash) => loadRequestRecord(env, lookupHash)
    );

    if (resolved.status === "canceled") {
      return { ok: true };
    }

    if (!resolved.route) {
      return { ok: false, reason: "invalid" };
    }

    await setRequestStatus(
      env,
      resolved.requestHash,
      "canceled",
      resolved.status,
      true
    );
    await releasePairPendingLock(env, resolved.route.pairTag);
    await recordRequestCanceled(env);
    return { ok: true };
  } catch (error) {
    return mapRequestError(error);
  }
};

export const declineConversationRequest = async (
  env: Environment,
  candidateActorHash: string,
  requestRef: string
): Promise<RequestActionResult> => {
  try {
    const resolved = await resolveRequestForCandidate(
      env.APP_MASTER_KEY,
      { requestRef, actorHash: candidateActorHash },
      (lookupHash) => loadRequestRecord(env, lookupHash),
      (profileHash) => loadProfileRecord(env, profileHash)
    );

    if (resolved.status === "declined") {
      return { ok: true };
    }

    if (!resolved.route) {
      return { ok: false, reason: "invalid" };
    }

    await setRequestStatus(
      env,
      resolved.requestHash,
      "declined",
      resolved.status,
      true
    );
    await upsertPairStateRecord(env, {
      pairTag: resolved.route.pairTag,
      state: "declined_cooldown",
      expiresAt: Date.now() + PAIR_DECLINED_COOLDOWN_MS,
    });
    const requester = await getUserById(resolved.route.requesterUserId, env);
    if (requester) {
      await notifyRequesterDeclined(env, requester, resolved.requestHash);
    }
    await recordRequestDeclined(env);
    return { ok: true };
  } catch (error) {
    return mapRequestError(error);
  }
};

export const acceptConversationRequest = async (
  env: Environment,
  candidateUser: D1User,
  candidateActorHash: string,
  requestRef: string
): Promise<RequestActionResult> => {
  try {
    const resolved = await resolveRequestForCandidate(
      env.APP_MASTER_KEY,
      {
        requestRef,
        actorHash: candidateActorHash,
        decryptIntro: true,
        allowedTerminalStatuses: ["accepted"],
      },
      (lookupHash) => loadRequestRecord(env, lookupHash),
      (profileHash) => loadProfileRecord(env, profileHash)
    );

    if (!resolved.route) {
      return { ok: false, reason: "invalid" };
    }

    const operationId = requestAcceptOperationId(resolved.requestHash);
    const claim = await claimRequestAccept(
      env,
      resolved.requestHash,
      operationId,
      REQUEST_ACCEPT_LEASE_MS
    );
    if (!claim.ok) {
      return {
        ok: false,
        reason: claim.error === "expired" ? "expired" : "state",
      };
    }
    if (claim.state === "accepted") {
      return { ok: true };
    }
    if (claim.state === "processing") {
      return { ok: false, reason: "state" };
    }

    if (typeof resolved.intro !== "string") {
      await failRequestAccept(env, resolved.requestHash, operationId).catch(
        () => undefined
      );
      return { ok: false, reason: "invalid" };
    }

    const requester = await getUserById(resolved.route.requesterUserId, env);
    if (!requester) {
      await failRequestAccept(env, resolved.requestHash, operationId).catch(
        () => undefined
      );
      return { ok: false, reason: "invalid" };
    }

    const linkSlug =
      (await getActiveSlugForUser(requester.id, env)) ?? "conversation-request";
    const now = Date.now();
    const ticketResult = await createSealedTicket(env, {
      sender: requester,
      recipient: candidateUser,
      payload: {
        message_type: "text",
        message_text: resolved.intro,
        telegramMessageId: now,
        createdAt: now,
      },
      linkSlug,
      isThreadReply: false,
      dedupeKey: operationId,
    });

    if (!ticketResult.ok || !ticketResult.ticketHash) {
      await failRequestAccept(env, resolved.requestHash, operationId).catch(
        () => undefined
      );
      return { ok: false, reason: "state" };
    }

    await completeRequestAccept(
      env,
      resolved.requestHash,
      operationId,
      ticketResult.ticketHash
    );
    await upsertPairStateRecord(env, {
      pairTag: resolved.route.pairTag,
      state: "accepted_cooldown",
      expiresAt: Date.now() + PAIR_ACCEPTED_COOLDOWN_MS,
    });

    await notifyRequesterAccepted(env, requester, resolved.requestHash);
    await recordRequestAccepted(env);
    return { ok: true };
  } catch (error) {
    return mapRequestError(error);
  }
};
