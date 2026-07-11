import {
  RETRIEVAL_MAX_MERGED_VECTOR_HITS,
  RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE,
  SUPPORTED_RETRIEVAL_LOCALES,
} from "./constants.ts";
import type {
  ResolvedVectorHit,
  RetrievalChannel,
  VectorHit,
} from "./types.ts";
import type { ProfileLocale } from "../conversation-profile/types.ts";
import type { VectorRouteRole } from "../../storage/profile-vault/profile-vault.types";

const supportedLocales = new Set<ProfileLocale>(SUPPORTED_RETRIEVAL_LOCALES);

export const expectedRoleForChannel = (
  channel: RetrievalChannel
): VectorRouteRole => (channel === "desired_to_self" ? "self" : "desired");

export const mergeVectorHits = (
  desiredChannelHits: VectorHit[],
  selfChannelHits: VectorHit[]
): VectorHit[] => {
  const merged: VectorHit[] = [];
  const seen = new Set<string>();

  for (const hit of [...desiredChannelHits, ...selfChannelHits]) {
    const key = `${hit.channel}:${hit.vectorizeId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(hit);
    if (merged.length >= RETRIEVAL_MAX_MERGED_VECTOR_HITS) {
      break;
    }
  }

  return merged;
};

export const roleMatchesChannel = (
  channel: RetrievalChannel,
  role: VectorRouteRole,
  roleForChannel: (channel: RetrievalChannel) => VectorRouteRole = expectedRoleForChannel
): boolean => role === roleForChannel(channel);

export const passesRetrievalFilter = (input: {
  requesterProfileHash: string;
  requesterLocale: ProfileLocale;
  profileHash: string;
  profileStatus: string;
  profileRevision: number;
  routeRevision: number;
  routeStatus: string;
  profileLocale: ProfileLocale;
}): boolean => {
  if (input.profileHash === input.requesterProfileHash) {
    return false;
  }
  if (input.profileStatus !== "discoverable") {
    return false;
  }
  if (input.routeStatus !== "active") {
    return false;
  }
  if (input.profileRevision !== input.routeRevision) {
    return false;
  }
  if (!supportedLocales.has(input.profileLocale)) {
    return false;
  }
  if (input.profileLocale !== input.requesterLocale) {
    return false;
  }
  return true;
};

export const dedupeResolvedHits = (
  hits: ResolvedVectorHit[],
  maxProfiles = RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE
): Map<string, { revision: number; channels: RetrievalChannel[] }> => {
  const byProfile = new Map<
    string,
    { revision: number; channels: Set<RetrievalChannel> }
  >();

  for (const hit of hits) {
    const existing = byProfile.get(hit.profileHash);
    if (!existing) {
      if (byProfile.size >= maxProfiles) {
        break;
      }
      byProfile.set(hit.profileHash, {
        revision: hit.revision,
        channels: new Set([hit.channel]),
      });
      continue;
    }

    if (existing.revision !== hit.revision) {
      continue;
    }
    existing.channels.add(hit.channel);
  }

  return new Map(
    [...byProfile.entries()].map(([profileHash, value]) => [
      profileHash,
      { revision: value.revision, channels: [...value.channels] },
    ])
  );
};
