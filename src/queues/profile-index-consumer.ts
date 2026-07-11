import type { Environment } from "../types";
import {
  shouldAckIndexJobEarly,
  shouldSkipUpsertForDiscoverableProfile,
  shouldSkipVerifyForDiscoverableProfile,
} from "./profile-index-policy.ts";
import { PROFILE_INDEX_SCHEMA_VERSION } from "./profile-index.types";
import type { ProfileIndexJob } from "./profile-index.types";
import {
  createIndexJobLookupHash,
  createVectorLookupHash,
  deriveIndexJobRouteKey,
  deriveProfileEncryptionKey,
  deriveVectorRouteKey,
  indexJobRouteAad,
  indexJobVectorsAad,
  profileEncAad,
  randomVectorRef,
  vectorRouteAad,
} from "../features/ticketing/conversation-keys.ts";
import { decryptEnvelope, encryptEnvelope } from "../features/ticketing/envelope.ts";
import type {
  IndexJobRouteCapsule,
  IndexJobVectorsCapsule,
  VectorRouteCapsule,
} from "../features/ticketing/conversation-capabilities.ts";
import {
  getIndexJobRecord,
  getProfileRecord,
  setIndexJobStatus,
  setProfileStatus,
  storeVectorRouteRecord,
} from "../storage/profile-vault/profile-vault.client";
import type {
  IndexJobRecord,
  ProfileVaultRecord,
  VectorRouteRole,
} from "../storage/profile-vault/profile-vault.types";
import type { ConversationProfile } from "../features/conversation-profile/types.ts";
import {
  namespaceFor,
  padVectorForIndex,
  projectDesiredVector,
  projectSelfVector,
} from "../features/conversation-profile/vector-projection.ts";

const MAX_INDEX_ATTEMPTS = 5;
const VERIFY_DELAY_SECONDS = 10;
const UPSERT_VERIFY_DELAY_SECONDS = 5;

type JobOutcome =
  | { type: "ack" }
  | { type: "retry"; delaySeconds?: number };

const isValidJob = (job: ProfileIndexJob | undefined): job is ProfileIndexJob =>
  !!job &&
  !!job.indexJobRef &&
  (job.action === "upsert" ||
    job.action === "verify" ||
    job.action === "delete") &&
  job.schemaVersion === PROFILE_INDEX_SCHEMA_VERSION;

const decryptJobVectors = async (
  env: Environment,
  jobHash: string,
  vectorsEnc: string
): Promise<IndexJobVectorsCapsule> => {
  const key = await deriveIndexJobRouteKey(env.APP_MASTER_KEY, jobHash);
  return decryptEnvelope<IndexJobVectorsCapsule>(
    key,
    vectorsEnc,
    indexJobVectorsAad(jobHash)
  );
};

const persistJobVectors = async (
  env: Environment,
  jobHash: string,
  vectors: IndexJobVectorsCapsule
): Promise<void> => {
  const key = await deriveIndexJobRouteKey(env.APP_MASTER_KEY, jobHash);
  const vectorsEnc = await encryptEnvelope(
    key,
    JSON.stringify(vectors),
    indexJobVectorsAad(jobHash)
  );
  await setIndexJobStatus(env, jobHash, "pending", vectorsEnc);
};

const saveVectorRoute = async (
  env: Environment,
  vectorizeId: string,
  role: VectorRouteRole,
  revision: number,
  profileHash: string,
  status: "active" | "deleted"
): Promise<void> => {
  const vectorHash = await createVectorLookupHash(env.APP_MASTER_KEY, vectorizeId);
  const routeKey = await deriveVectorRouteKey(env.APP_MASTER_KEY, vectorHash);
  const vectorRouteEnc = await encryptEnvelope(
    routeKey,
    JSON.stringify({
      revision,
      vectorizeId,
      role,
      profileHash,
    } satisfies VectorRouteCapsule),
    vectorRouteAad(vectorHash)
  );
  await storeVectorRouteRecord(env, {
    vectorHash,
    vectorRouteEnc,
    role,
    revision,
    status,
  });
};

const runUpsert = async (
  env: Environment,
  job: ProfileIndexJob,
  jobHash: string,
  jobRecord: IndexJobRecord,
  profile: ProfileVaultRecord
): Promise<JobOutcome> => {
  if (shouldSkipUpsertForDiscoverableProfile(profile.status)) {
    return { type: "ack" };
  }

  let vectors: IndexJobVectorsCapsule;
  if (jobRecord.vectorsEnc) {
    vectors = await decryptJobVectors(env, jobHash, jobRecord.vectorsEnc);
  } else {
    vectors = {
      selfVectorizeId: randomVectorRef(),
      desiredVectorizeId: randomVectorRef(),
    };
    await persistJobVectors(env, jobHash, vectors);
  }

  const profileKey = await deriveProfileEncryptionKey(
    env.APP_MASTER_KEY,
    profile.profileHash
  );
  const decoded = await decryptEnvelope<ConversationProfile>(
    profileKey,
    profile.profileEnc,
    profileEncAad(profile.profileHash)
  );

  await saveVectorRoute(
    env,
    vectors.selfVectorizeId,
    "self",
    profile.revision,
    profile.profileHash,
    "active"
  );
  await saveVectorRoute(
    env,
    vectors.desiredVectorizeId,
    "desired",
    profile.revision,
    profile.profileHash,
    "active"
  );

  await env.CONVERSATION_VECTORS.upsert([
    {
      id: vectors.selfVectorizeId,
      values: padVectorForIndex(projectSelfVector(decoded)),
      namespace: namespaceFor("self", decoded.locale),
      metadata: { schemaVersion: PROFILE_INDEX_SCHEMA_VERSION },
    },
    {
      id: vectors.desiredVectorizeId,
      values: padVectorForIndex(projectDesiredVector(decoded)),
      namespace: namespaceFor("desired", decoded.locale),
      metadata: { schemaVersion: PROFILE_INDEX_SCHEMA_VERSION },
    },
  ]);

  await setProfileStatus(env, profile.profileHash, "indexing", profile.revision);

  await env.NEKO_PROFILE_INDEX_QUEUE.send(
    {
      action: "verify",
      indexJobRef: job.indexJobRef,
      schemaVersion: PROFILE_INDEX_SCHEMA_VERSION,
      attempt: 0,
    },
    { delaySeconds: UPSERT_VERIFY_DELAY_SECONDS }
  );

  return { type: "ack" };
};

const runVerify = async (
  env: Environment,
  jobHash: string,
  jobRecord: IndexJobRecord,
  profile: ProfileVaultRecord,
  deliveryAttempt: number
): Promise<JobOutcome> => {
  if (shouldSkipVerifyForDiscoverableProfile(profile.status)) {
    return { type: "ack" };
  }
  if (!jobRecord.vectorsEnc) {
    return { type: "ack" };
  }

  const vectors = await decryptJobVectors(env, jobHash, jobRecord.vectorsEnc);
  const found = await env.CONVERSATION_VECTORS.getByIds([
    vectors.selfVectorizeId,
    vectors.desiredVectorizeId,
  ]);
  const presentIds = new Set(found.map((vector) => vector.id));

  if (
    presentIds.has(vectors.selfVectorizeId) &&
    presentIds.has(vectors.desiredVectorizeId)
  ) {
    await setProfileStatus(
      env,
      profile.profileHash,
      "private",
      profile.revision
    );
    await setIndexJobStatus(env, jobHash, "completed");
    return { type: "ack" };
  }

  if (deliveryAttempt >= MAX_INDEX_ATTEMPTS) {
    await setProfileStatus(
      env,
      profile.profileHash,
      "index_failed",
      profile.revision
    );
    await setIndexJobStatus(env, jobHash, "expired");
    return { type: "ack" };
  }

  return { type: "retry", delaySeconds: VERIFY_DELAY_SECONDS };
};

const runDelete = async (
  env: Environment,
  jobHash: string,
  jobRecord: IndexJobRecord,
  profile: ProfileVaultRecord
): Promise<JobOutcome> => {
  if (jobRecord.vectorsEnc) {
    const vectors = await decryptJobVectors(env, jobHash, jobRecord.vectorsEnc);
    await env.CONVERSATION_VECTORS.deleteByIds([
      vectors.selfVectorizeId,
      vectors.desiredVectorizeId,
    ]);
    await saveVectorRoute(
      env,
      vectors.selfVectorizeId,
      "self",
      profile.revision,
      profile.profileHash,
      "deleted"
    );
    await saveVectorRoute(
      env,
      vectors.desiredVectorizeId,
      "desired",
      profile.revision,
      profile.profileHash,
      "deleted"
    );
  }

  await setProfileStatus(env, profile.profileHash, "disabled", profile.revision);
  await setIndexJobStatus(env, jobHash, "completed");
  return { type: "ack" };
};

const processJob = async (
  env: Environment,
  job: ProfileIndexJob,
  deliveryAttempt: number
): Promise<JobOutcome> => {
  const jobHash = await createIndexJobLookupHash(
    env.APP_MASTER_KEY,
    job.indexJobRef
  );
  const jobRecord = await getIndexJobRecord(env, jobHash);
  const routeKey = await deriveIndexJobRouteKey(env.APP_MASTER_KEY, jobHash);

  if (!jobRecord) {
    return { type: "ack" };
  }

  const route = await decryptEnvelope<IndexJobRouteCapsule>(
    routeKey,
    jobRecord.routeEnc,
    indexJobRouteAad(jobHash)
  );

  const profile = await getProfileRecord(env, route.profileHash);
  if (
    shouldAckIndexJobEarly(jobRecord, profile, route.revision, Date.now())
  ) {
    if (
      jobRecord.status !== "completed" &&
      (jobRecord.status === "expired" || jobRecord.expiresAt <= Date.now())
    ) {
      await setIndexJobStatus(env, jobHash, "expired");
    }
    return { type: "ack" };
  }

  if (job.action === "upsert") {
    return runUpsert(env, job, jobHash, jobRecord, profile!);
  }
  if (job.action === "verify") {
    return runVerify(env, jobHash, jobRecord, profile!, deliveryAttempt);
  }
  return runDelete(env, jobHash, jobRecord, profile!);
};

export const handleProfileIndexBatch = async (
  batch: MessageBatch<ProfileIndexJob>,
  env: Environment
): Promise<void> => {
  for (const message of batch.messages) {
    if (!isValidJob(message.body)) {
      message.ack();
      continue;
    }

    try {
      const outcome = await processJob(env, message.body, message.attempts);
      if (outcome.type === "retry") {
        message.retry({ delaySeconds: outcome.delaySeconds });
      } else {
        message.ack();
      }
    } catch {
      message.retry();
    }
  }
};
