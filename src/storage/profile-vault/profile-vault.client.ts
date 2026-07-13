import type { Environment } from "../../contracts/runtime";
import { shardNameForLookupHash } from "../shard-routing";
import type {
  ProfileIndexJobRecord,
  IndexJobStatus,
  ProfileVaultRecord,
  ProfileVaultRecordStatus,
  StoreIndexJobInput,
  StoreProfileInput,
  StoreVectorRouteInput,
  ProfileVectorRouteRecord,
} from "../../contracts/conversation/profile-vault";

const stub = (env: Environment, lookupHash: string) =>
  env.PROFILE_VAULT_DO.get(
    env.PROFILE_VAULT_DO.idFromName(shardNameForLookupHash("profile", lookupHash))
  );

export const storeProfileRecord = async (
  env: Environment,
  input: StoreProfileInput
): Promise<void> => {
  await stub(env, input.profileHash).storeProfile(input);
};

export const getProfileRecord = async (
  env: Environment,
  profileHash: string
): Promise<ProfileVaultRecord | null> =>
  stub(env, profileHash).getProfile(profileHash);

export const setProfileStatus = async (
  env: Environment,
  profileHash: string,
  status: ProfileVaultRecordStatus,
  expectedRevision?: number
): Promise<void> => {
  await stub(env, profileHash).setProfileStatus(profileHash, status, expectedRevision);
};

export const updateProfileRouteEnc = async (
  env: Environment,
  profileHash: string,
  routeEnc: string
): Promise<void> => {
  await stub(env, profileHash).updateProfileRoute(profileHash, routeEnc);
};

export const storeVectorRouteRecord = async (
  env: Environment,
  input: StoreVectorRouteInput
): Promise<void> => {
  await stub(env, input.vectorHash).storeVectorRoute(input);
};

export const getVectorRouteRecord = async (
  env: Environment,
  vectorHash: string
): Promise<ProfileVectorRouteRecord | null> =>
  stub(env, vectorHash).getVectorRoute(vectorHash);

export const storeIndexJobRecord = async (
  env: Environment,
  input: StoreIndexJobInput
): Promise<void> => {
  await stub(env, input.jobHash).storeIndexJob(input);
};

export const getIndexJobRecord = async (
  env: Environment,
  jobHash: string
): Promise<ProfileIndexJobRecord | null> =>
  stub(env, jobHash).getIndexJob(jobHash);

export const setIndexJobStatus = async (
  env: Environment,
  jobHash: string,
  status: IndexJobStatus,
  vectorsEnc?: string | null
): Promise<void> => {
  await stub(env, jobHash).setIndexJobStatus(jobHash, status, vectorsEnc);
};
