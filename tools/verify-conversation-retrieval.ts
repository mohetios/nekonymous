/**
 * Conversation candidate retrieval tests (pure merge/filter logic).
 * Run: pnpm test:conversation-retrieval
 */

import {
  RETRIEVAL_MAX_MERGED_VECTOR_HITS,
  RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE,
  RETRIEVAL_TOP_K_PER_CHANNEL,
} from "../src/features/conversation-suggestions/constants.ts";
import { mergeVectorHits } from "../src/features/conversation-suggestions/retrieval-utils.ts";
import {
  dedupeResolvedHits,
  expectedRoleForChannel,
  passesRetrievalFilter,
  roleMatchesChannel,
} from "../src/features/conversation-suggestions/retrieval-utils.ts";
import type {
  ResolvedVectorHit,
  VectorHit,
} from "../src/features/conversation-suggestions/types.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const hit = (
  vectorizeId: string,
  channel: VectorHit["channel"]
): VectorHit => ({ vectorizeId, channel });

if (RETRIEVAL_TOP_K_PER_CHANNEL !== 30) {
  fail("topK per channel must be 30");
}
if (RETRIEVAL_MAX_MERGED_VECTOR_HITS !== 60) {
  fail("merged vector cap must be 60");
}
if (RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE !== 50) {
  fail("profile dedupe cap must be 50");
}

const desiredHits = Array.from({ length: 35 }, (_, index) =>
  hit(`d-${index}`, "desired_to_self")
);
const selfHits = Array.from({ length: 35 }, (_, index) =>
  hit(`s-${index}`, "self_to_desired")
);
const merged = mergeVectorHits(desiredHits, selfHits);
if (merged.length !== RETRIEVAL_MAX_MERGED_VECTOR_HITS) {
  fail(`merge must cap at ${RETRIEVAL_MAX_MERGED_VECTOR_HITS}`);
}

const duplicateMerged = mergeVectorHits(
  [hit("shared", "desired_to_self"), hit("shared", "desired_to_self")],
  [hit("shared", "self_to_desired")]
);
if (duplicateMerged.length !== 2) {
  fail("duplicate vector/channel pairs must collapse within channel");
}

const expectedRole = expectedRoleForChannel;

if (
  !roleMatchesChannel("desired_to_self", "self", expectedRole) ||
  roleMatchesChannel("desired_to_self", "desired", expectedRole)
) {
  fail("role/channel mapping failed for desired_to_self");
}
if (
  !roleMatchesChannel("self_to_desired", "desired", expectedRole) ||
  roleMatchesChannel("self_to_desired", "self", expectedRole)
) {
  fail("role/channel mapping failed for self_to_desired");
}

const baseFilter = {
  requesterProfileHash: "req-profile",
  requesterLocale: "fa" as const,
  profileHash: "cand-profile",
  profileStatus: "discoverable",
  profileRevision: 2,
  routeRevision: 2,
  routeStatus: "active",
  profileLocale: "fa" as const,
};

if (!passesRetrievalFilter(baseFilter)) {
  fail("valid candidate filter rejected");
}
if (passesRetrievalFilter({ ...baseFilter, profileHash: "req-profile" })) {
  fail("requester self must be rejected");
}
if (passesRetrievalFilter({ ...baseFilter, profileStatus: "indexing" })) {
  fail("non-discoverable profile must be rejected");
}
if (passesRetrievalFilter({ ...baseFilter, profileRevision: 3 })) {
  fail("revision mismatch must be rejected");
}
if (passesRetrievalFilter({ ...baseFilter, profileLocale: "en" })) {
  fail("locale mismatch must be rejected");
}

const resolvedHit = (
  profileHash: string,
  channel: VectorHit["channel"],
  revision = 1
): ResolvedVectorHit => ({
  vectorizeId: `${profileHash}-${channel}`,
  channel,
  profileHash,
  revision,
  role: expectedRole(channel),
});

const manyProfiles: ResolvedVectorHit[] = [];
for (let index = 0; index < 55; index += 1) {
  manyProfiles.push(resolvedHit(`profile-${index}`, "desired_to_self"));
}
const capped = dedupeResolvedHits(manyProfiles, RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE);
if (capped.size !== RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE) {
  fail("profile dedupe must cap at 50");
}

const dualChannel = dedupeResolvedHits(
  [
    resolvedHit("same", "desired_to_self"),
    resolvedHit("same", "self_to_desired"),
  ],
  RETRIEVAL_MAX_PROFILES_AFTER_DEDUPE
);
const dual = dualChannel.get("same");
if (!dual || dual.channels.length !== 2) {
  fail("dual-channel hits must merge channels for one profile");
}

console.log("verify-conversation-retrieval: OK");
