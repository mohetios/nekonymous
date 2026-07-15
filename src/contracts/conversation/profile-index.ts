export type ProfileIndexAction = "upsert" | "delete" | "verify";

export const PROFILE_INDEX_SCHEMA_VERSION = "current" as const;

export type ProfileIndexJob = {
  action: ProfileIndexAction;
  indexJobRef: string;
  schemaVersion: typeof PROFILE_INDEX_SCHEMA_VERSION;
  attempt: number;
};
