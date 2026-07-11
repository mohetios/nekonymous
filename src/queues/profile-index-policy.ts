import type {
  IndexJobRecord,
  ProfileVaultRecord,
} from "../storage/profile-vault/profile-vault.types";

/** Queue consumer must ack without side effects (at-least-once delivery). */
export const shouldAckIndexJobEarly = (
  jobRecord: IndexJobRecord | null,
  profile: ProfileVaultRecord | null,
  routeRevision: number,
  now: number
): boolean => {
  if (!jobRecord) {
    return true;
  }
  if (jobRecord.status === "completed") {
    return true;
  }
  if (jobRecord.status === "expired" || jobRecord.expiresAt <= now) {
    return true;
  }
  if (!profile) {
    return true;
  }
  if (
    profile.revision !== routeRevision ||
    profile.revision !== jobRecord.revision
  ) {
    return true;
  }
  return false;
};

/** Skip re-index when profile is already discoverable (duplicate upsert job). */
export const shouldSkipUpsertForDiscoverableProfile = (
  profileStatus: ProfileVaultRecord["status"]
): boolean => profileStatus === "discoverable";

/** Skip verify retries when profile already left the indexing pipeline. */
export const shouldSkipVerifyForDiscoverableProfile = (
  profileStatus: ProfileVaultRecord["status"]
): boolean => profileStatus === "discoverable";
