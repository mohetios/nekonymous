import type {
  ProfileIndexJobRecord,
  ProfileVaultRecord,
} from "../contracts/conversation/profile-vault";

/** Queue consumer must ack without side effects (at-least-once delivery). */
export const shouldAckIndexJobEarly = (
  jobRecord: ProfileIndexJobRecord | null,
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
    profile.status === "disabled" ||
    profile.status === "invalidated" ||
    profile.status === "restricted"
  ) {
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
): boolean =>
  profileStatus === "discoverable" ||
  profileStatus === "disabled" ||
  profileStatus === "invalidated" ||
  profileStatus === "restricted";

/** Skip verify retries when profile already left the indexing pipeline. */
export const shouldSkipVerifyForDiscoverableProfile = (
  profileStatus: ProfileVaultRecord["status"]
): boolean => profileStatus === "discoverable";
