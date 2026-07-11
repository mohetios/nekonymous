import type { Environment } from "../../types";
import { shardNameForLookupHash } from "../shard-routing";
import type {
  IndexJobRecord,
  IndexJobStatus,
  ProfileVaultRecord,
  ProfileVaultRecordStatus,
  ProfileVaultShardPing,
  StoreIndexJobInput,
  StoreProfileInput,
  StoreVectorRouteInput,
  VectorRouteRecord,
} from "./profile-vault.types";

const stub = (env: Environment, lookupHash: string) =>
  env.PROFILE_VAULT_DO.get(
    env.PROFILE_VAULT_DO.idFromName(shardNameForLookupHash("profile", lookupHash))
  );

const doFetch = async <T>(
  env: Environment,
  lookupHash: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await stub(env, lookupHash).fetch(
    `https://profile-vault${path}`,
    init
  );
  if (!response.ok) {
    throw new Error(`ProfileVaultDO ${path} failed: ${response.status}`);
  }
  return response.json<T>();
};

export const pingProfileVaultShard = async (
  env: Environment,
  lookupHash: string
): Promise<ProfileVaultShardPing> => {
  const shard = stub(env, lookupHash);
  return shard.ping();
};

export const storeProfileRecord = async (
  env: Environment,
  input: StoreProfileInput
): Promise<void> => {
  await doFetch(env, input.profileHash, "/profiles", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getProfileRecord = async (
  env: Environment,
  profileHash: string
): Promise<ProfileVaultRecord | null> => {
  const body = await doFetch<{ record: ProfileVaultRecord | null }>(
    env,
    profileHash,
    `/profiles/${encodeURIComponent(profileHash)}`
  );
  return body.record;
};

export const setProfileStatus = async (
  env: Environment,
  profileHash: string,
  status: ProfileVaultRecordStatus,
  expectedRevision?: number
): Promise<void> => {
  await doFetch(env, profileHash, `/profiles/${encodeURIComponent(profileHash)}/status`, {
    method: "POST",
    body: JSON.stringify({ status, expectedRevision }),
  });
};

export const updateProfileRouteEnc = async (
  env: Environment,
  profileHash: string,
  routeEnc: string
): Promise<void> => {
  await doFetch(env, profileHash, `/profiles/${encodeURIComponent(profileHash)}/route`, {
    method: "POST",
    body: JSON.stringify({ routeEnc }),
  });
};

export const storeVectorRouteRecord = async (
  env: Environment,
  input: StoreVectorRouteInput
): Promise<void> => {
  await doFetch(env, input.vectorHash, "/vector-routes", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getVectorRouteRecord = async (
  env: Environment,
  vectorHash: string
): Promise<VectorRouteRecord | null> => {
  const body = await doFetch<{ record: VectorRouteRecord | null }>(
    env,
    vectorHash,
    `/vector-routes/${encodeURIComponent(vectorHash)}`
  );
  return body.record;
};

export const storeIndexJobRecord = async (
  env: Environment,
  input: StoreIndexJobInput
): Promise<void> => {
  await doFetch(env, input.jobHash, "/index-jobs", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getIndexJobRecord = async (
  env: Environment,
  jobHash: string
): Promise<IndexJobRecord | null> => {
  const body = await doFetch<{ record: IndexJobRecord | null }>(
    env,
    jobHash,
    `/index-jobs/${encodeURIComponent(jobHash)}`
  );
  return body.record;
};

export const setIndexJobStatus = async (
  env: Environment,
  jobHash: string,
  status: IndexJobStatus,
  vectorsEnc?: string | null
): Promise<void> => {
  await doFetch(env, jobHash, `/index-jobs/${encodeURIComponent(jobHash)}/status`, {
    method: "POST",
    body: JSON.stringify({ status, vectorsEnc }),
  });
};
