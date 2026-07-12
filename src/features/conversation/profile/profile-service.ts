import {
  decryptMatchIntro,
  encryptMatchIntro,
} from "../../ticketing/ticketing-service";
import {
  createConversationOwnerProofTag,
  createIndexJobLookupHash,
  createProfileLookupHash,
  deriveIndexJobRouteKey,
  deriveProfileEncryptionKey,
  deriveProfileRouteKey,
  indexJobRouteAad,
  profileEncAad,
  profileRouteAad,
  randomIndexJobRef,
  randomProfileRef,
} from "../../ticketing/conversation-keys";
import { encryptEnvelope } from "../../ticketing/envelope";
import { PROFILE_INDEX_SCHEMA_VERSION } from "../../../queues/profile-index.types";
import {
  getProfileRecord,
  setProfileStatus,
  storeIndexJobRecord,
  storeProfileRecord,
  updateProfileRouteEnc,
} from "../../../storage/profile-vault/profile-vault.client";
import {
  getProfileMeta as getUserProfileMeta,
  setDiscoverable as setUserDiscoverable,
  setProfileCapabilityEnc as setUserProfileCapabilityEnc,
} from "../../../storage/user-state-client";
import type { Environment } from "../../../types";
import { INDEX_JOB_CAPABILITY_TTL_MS } from "../../ticketing/conversation-capabilities";
import type { ProfileRouteCapsule } from "../../ticketing/conversation-capabilities";
import { decryptEnvelope } from "../../ticketing/envelope";
import type { ProfileVaultRecordStatus } from "../../../storage/profile-vault/profile-vault.types";
import { buildConversationProfile, profileHasSafetyState } from "./profile-builder.ts";
import { clearProfileSession, getProfileSession } from "./profile-session-service.ts";
import { hasCompleteAnswers } from "./validation.ts";
import type { ConversationProfile, ProfileLocale } from "./types.ts";
import {
  recordDiscoverabilityEnabled,
  recordDiscoverabilityDisabled,
  recordProfileIndexRequested,
} from "../../../stats/product-events";

const capabilityScope = (userId: string): string => `profile-capability:v2:${userId}`;

const encryptProfileRef = async (
  userId: string,
  profileRef: string,
  appMasterKey: string
): Promise<string> =>
  encryptMatchIntro(capabilityScope(userId), profileRef, appMasterKey);

export const decryptStoredProfileRef = async (
  userId: string,
  ciphertext: string | null,
  appMasterKey: string
): Promise<string | null> => {
  if (!ciphertext) {
    return null;
  }
  return decryptMatchIntro(capabilityScope(userId), ciphertext, appMasterKey);
};

const resolveNextRevision = async (
  env: Environment,
  userId: string,
  appMasterKey: string
): Promise<number> => {
  const meta = await getUserProfileMeta(env, userId);
  const profileRef = await decryptStoredProfileRef(
    userId,
    meta.profileCapabilityEnc,
    appMasterKey
  );
  if (!profileRef) {
    return 1;
  }

  const profileHash = await createProfileLookupHash(appMasterKey, profileRef);
  const record = await getProfileRecord(env, profileHash);
  return (record?.revision ?? 0) + 1;
};

export const prepareProfileRetake = async (
  env: Environment,
  userId: string
): Promise<void> => {
  await setUserDiscoverable(env, userId, false);
  await clearProfileSession(env, userId);
};

export const finalizeProfileSession = async (
  env: Environment,
  userId: string,
  actorHash: string,
  locale: ProfileLocale
): Promise<{
  profile: ConversationProfile;
  summaryText: string;
  revision: number;
}> => {
  const session = await getProfileSession(env, userId);
  if (!session || !hasCompleteAnswers(session.answers)) {
    throw new Error("Profile session incomplete");
  }

  const revision = await resolveNextRevision(env, userId, env.APP_MASTER_KEY);
  const built = buildConversationProfile(session.answers, locale, revision);
  if (profileHasSafetyState(built.profile)) {
    throw new Error("Profile must not create safety state");
  }

  const profileRef = randomProfileRef();
  const profileHash = await createProfileLookupHash(
    env.APP_MASTER_KEY,
    profileRef
  );
  const ownerProofTag = await createConversationOwnerProofTag(
    env.APP_MASTER_KEY,
    actorHash,
    profileHash
  );

  const profileKey = await deriveProfileEncryptionKey(
    env.APP_MASTER_KEY,
    profileHash
  );
  const profileEnc = await encryptEnvelope(
    profileKey,
    JSON.stringify(built.profile),
    profileEncAad(profileHash)
  );

  const routeKey = await deriveProfileRouteKey(env.APP_MASTER_KEY, profileHash);
  const routeEnc = await encryptEnvelope(
    routeKey,
    JSON.stringify({ revision }),
    profileRouteAad(profileHash)
  );

  try {
    await storeProfileRecord(env, {
      profileHash,
      ownerProofTag,
      profileEnc,
      routeEnc,
      revision,
      status: "private",
    });
  } catch (error) {
    throw new Error("Profile vault persistence failed", { cause: error });
  }

  const indexJobRef = randomIndexJobRef();
  const jobHash = await createIndexJobLookupHash(env.APP_MASTER_KEY, indexJobRef);
  const indexRouteKey = await deriveIndexJobRouteKey(env.APP_MASTER_KEY, jobHash);
  const indexRouteEnc = await encryptEnvelope(
    indexRouteKey,
    JSON.stringify({ revision, profileHash }),
    indexJobRouteAad(jobHash)
  );

  try {
    await storeIndexJobRecord(env, {
      jobHash,
      routeEnc: indexRouteEnc,
      revision,
      status: "pending",
      expiresAt: Date.now() + INDEX_JOB_CAPABILITY_TTL_MS,
    });
  } catch (error) {
    throw new Error("Index job persistence failed", { cause: error });
  }

  try {
    await env.NEKO_PROFILE_INDEX_QUEUE.send({
      action: "upsert",
      indexJobRef,
      schemaVersion: PROFILE_INDEX_SCHEMA_VERSION,
      attempt: 0,
    });
    await recordProfileIndexRequested(env);
  } catch (error) {
    throw new Error("Profile index queue submission failed", { cause: error });
  }

  const capabilityEnc = await encryptProfileRef(
    userId,
    profileRef,
    env.APP_MASTER_KEY
  );
  await setUserProfileCapabilityEnc(env, userId, capabilityEnc);
  await setUserDiscoverable(env, userId, false);
  await clearProfileSession(env, userId);

  return {
    profile: built.profile,
    summaryText: built.summaryText,
    revision,
  };
};

export const getProfileDashboardMeta = async (
  env: Environment,
  userId: string
): Promise<{
  hasProfile: boolean;
  discoverable: boolean;
  hasActiveSession: boolean;
  sessionStatus: string | null;
  revision: number | null;
}> => {
  const meta = await getUserProfileMeta(env, userId);
  const profileRef = await decryptStoredProfileRef(
    userId,
    meta.profileCapabilityEnc,
    env.APP_MASTER_KEY
  );

  let revision: number | null = null;
  if (profileRef) {
    const profileHash = await createProfileLookupHash(
      env.APP_MASTER_KEY,
      profileRef
    );
    const record = await getProfileRecord(env, profileHash);
    revision = record?.revision ?? null;
  }

  return {
    hasProfile: !!profileRef,
    discoverable: meta.discoverable,
    hasActiveSession: meta.hasActiveSession,
    sessionStatus: meta.sessionStatus,
    revision,
  };
};

const READABLE_PROFILE_STATUSES = new Set<ProfileVaultRecordStatus>([
  "private",
  "indexing",
  "discoverable",
  "index_failed",
]);

export type RequesterProfileContext =
  | {
      ok: true;
      profileHash: string;
      profile: ConversationProfile;
      vaultStatus: ProfileVaultRecordStatus;
      revision: number;
    }
  | { ok: false; reason: "no_profile" | "profile_failed" };

export const isProfileSearchReady = (
  context: RequesterProfileContext
): context is Extract<RequesterProfileContext, { ok: true }> =>
  context.ok &&
  (context.vaultStatus === "private" || context.vaultStatus === "discoverable");

export const loadRequesterProfileContext = async (
  env: Environment,
  userId: string
): Promise<RequesterProfileContext> => {
  const meta = await getUserProfileMeta(env, userId);
  const profileRef = await decryptStoredProfileRef(
    userId,
    meta.profileCapabilityEnc,
    env.APP_MASTER_KEY
  );
  if (!profileRef) {
    return { ok: false, reason: "no_profile" };
  }

  const profileHash = await createProfileLookupHash(
    env.APP_MASTER_KEY,
    profileRef
  );
  const record = await getProfileRecord(env, profileHash);
  if (!record) {
    return { ok: false, reason: "no_profile" };
  }

  if (!READABLE_PROFILE_STATUSES.has(record.status)) {
    return {
      ok: false,
      reason: record.status === "invalidated" ? "no_profile" : "profile_failed",
    };
  }

  let profile: ConversationProfile;
  try {
    const profileKey = await deriveProfileEncryptionKey(
      env.APP_MASTER_KEY,
      profileHash
    );
    profile = await decryptEnvelope<ConversationProfile>(
      profileKey,
      record.profileEnc,
      profileEncAad(profileHash)
    );
  } catch {
    return { ok: false, reason: "profile_failed" };
  }

  return {
    ok: true,
    profileHash,
    profile,
    vaultStatus: record.status,
    revision: record.revision,
  };
};

const refreshProfileDeliveryRoute = async (
  env: Environment,
  profileHash: string,
  revision: number,
  deliveryUserId: string | undefined
): Promise<void> => {
  const existing = await getProfileRecord(env, profileHash);
  let previousRoute: ProfileRouteCapsule | null = null;
  if (existing) {
    try {
      const existingRouteKey = await deriveProfileRouteKey(
        env.APP_MASTER_KEY,
        profileHash
      );
      previousRoute = await decryptEnvelope<ProfileRouteCapsule>(
        existingRouteKey,
        existing.routeEnc,
        profileRouteAad(profileHash)
      );
    } catch {
      previousRoute = null;
    }
  }

  const routeKey = await deriveProfileRouteKey(env.APP_MASTER_KEY, profileHash);
  const routeEnc = await encryptEnvelope(
    routeKey,
    JSON.stringify({
      revision,
      ...(previousRoute?.selfVectorizeId
        ? { selfVectorizeId: previousRoute.selfVectorizeId }
        : {}),
      ...(previousRoute?.desiredVectorizeId
        ? { desiredVectorizeId: previousRoute.desiredVectorizeId }
        : {}),
      ...(deliveryUserId ? { deliveryUserId } : {}),
    } satisfies ProfileRouteCapsule),
    profileRouteAad(profileHash)
  );
  await updateProfileRouteEnc(env, profileHash, routeEnc);
};

export const setConversationDiscoverability = async (
  env: Environment,
  userId: string,
  enabled: boolean
): Promise<{ ok: true } | { ok: false; reason: "no_profile" | "not_ready" }> => {
  const context = await loadRequesterProfileContext(env, userId);
  if (!context.ok) {
    return { ok: false, reason: "no_profile" };
  }

  if (enabled) {
    if (!isProfileSearchReady(context)) {
      return { ok: false, reason: "not_ready" };
    }
    await setProfileStatus(
      env,
      context.profileHash,
      "discoverable",
      context.revision
    );
    await refreshProfileDeliveryRoute(
      env,
      context.profileHash,
      context.revision,
      userId
    );
    await setUserDiscoverable(env, userId, true);
    await recordDiscoverabilityEnabled(env);
    return { ok: true };
  }

  await setProfileStatus(env, context.profileHash, "private", context.revision);
  await refreshProfileDeliveryRoute(
    env,
    context.profileHash,
    context.revision,
    undefined
  );
  await setUserDiscoverable(env, userId, false);
  await recordDiscoverabilityDisabled(env);
  return { ok: true };
};

export const resolveCandidateDeliveryUserId = async (
  env: Environment,
  candidateProfileHash: string
): Promise<string | null> => {
  const record = await getProfileRecord(env, candidateProfileHash);
  if (!record) {
    return null;
  }

  const routeKey = await deriveProfileRouteKey(
    env.APP_MASTER_KEY,
    candidateProfileHash
  );
  const route = await decryptEnvelope<ProfileRouteCapsule>(
    routeKey,
    record.routeEnc,
    profileRouteAad(candidateProfileHash)
  );

  return route.deliveryUserId ?? null;
};

export const invalidateUserConversationProfile = async (
  env: Environment,
  userId: string
): Promise<void> => {
  const meta = await getUserProfileMeta(env, userId);
  const profileRef = await decryptStoredProfileRef(
    userId,
    meta.profileCapabilityEnc,
    env.APP_MASTER_KEY
  );
  if (!profileRef) {
    return;
  }

  const profileHash = await createProfileLookupHash(
    env.APP_MASTER_KEY,
    profileRef
  );
  const record = await getProfileRecord(env, profileHash);
  if (!record) {
    await setUserDiscoverable(env, userId, false);
    await setUserProfileCapabilityEnc(env, userId, null);
    return;
  }

  try {
    const routeKey = await deriveProfileRouteKey(env.APP_MASTER_KEY, profileHash);
    const route = await decryptEnvelope<ProfileRouteCapsule>(
      routeKey,
      record.routeEnc,
      profileRouteAad(profileHash)
    );
    const vectorIds = [
      route.selfVectorizeId,
      route.desiredVectorizeId,
    ].filter((value): value is string => !!value);
    if (vectorIds.length > 0) {
      await env.CONVERSATION_VECTORS.deleteByIds(vectorIds).catch(() => undefined);
    }

    const clearedRouteEnc = await encryptEnvelope(
      routeKey,
      JSON.stringify({
        revision: record.revision,
        ...(route.selfVectorizeId ? { selfVectorizeId: route.selfVectorizeId } : {}),
        ...(route.desiredVectorizeId
          ? { desiredVectorizeId: route.desiredVectorizeId }
          : {}),
      } satisfies ProfileRouteCapsule),
      profileRouteAad(profileHash)
    );
    await updateProfileRouteEnc(env, profileHash, clearedRouteEnc);
  } catch {
    // Keep reset idempotent; status invalidation below prevents future use.
  }

  await setProfileStatus(env, profileHash, "invalidated", record.revision);
  await setUserDiscoverable(env, userId, false);
  await setUserProfileCapabilityEnc(env, userId, null);
};
