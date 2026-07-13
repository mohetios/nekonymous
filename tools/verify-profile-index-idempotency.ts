/**
 * Profile index queue idempotency policy (at-least-once delivery).
 * Run: pnpm test:profile-index-idempotency
 */

import {
  shouldAckIndexJobEarly,
  shouldSkipUpsertForDiscoverableProfile,
  shouldSkipVerifyForDiscoverableProfile,
} from "../src/queues/profile-index-policy.ts";
import type {
  ProfileIndexJobRecord,
  ProfileVaultRecord,
} from "../src/contracts/conversation/profile-vault";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const now = 1_700_000_000_000;

const job = (overrides: Partial<ProfileIndexJobRecord>): ProfileIndexJobRecord => ({
  jobHash: "job",
  routeEnc: "enc",
  revision: 2,
  status: "pending",
  vectorsEnc: null,
  createdAt: now,
  expiresAt: now + 60_000,
  ...overrides,
});

const profile = (overrides: Partial<ProfileVaultRecord>): ProfileVaultRecord => ({
  profileHash: "hash",
  ownerProofTag: "tag",
  profileEnc: "enc",
  routeEnc: "route",
  revision: 2,
  status: "indexing",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

if (!shouldAckIndexJobEarly(job({ status: "completed" }), profile({}), 2, now)) {
  fail("completed job must ack without reprocessing");
}

if (!shouldAckIndexJobEarly(job({ status: "expired" }), profile({}), 2, now)) {
  fail("expired job must ack");
}

if (!shouldAckIndexJobEarly(job({ expiresAt: now - 1 }), profile({}), 2, now)) {
  fail("past expiresAt must ack");
}

if (!shouldAckIndexJobEarly(job({ revision: 1 }), profile({ revision: 2 }), 1, now)) {
  fail("stale job revision must ack when profile advanced");
}

if (!shouldAckIndexJobEarly(job({ revision: 2 }), profile({ revision: 2 }), 1, now)) {
  fail("route/profile revision mismatch must ack");
}

if (shouldAckIndexJobEarly(job({ revision: 2 }), profile({ revision: 2 }), 2, now)) {
  fail("matching revision must not ack early");
}

if (!shouldSkipUpsertForDiscoverableProfile("discoverable")) {
  fail("duplicate upsert must skip when already discoverable");
}

if (shouldSkipUpsertForDiscoverableProfile("indexing")) {
  fail("indexing profile must not skip upsert");
}

if (!shouldSkipVerifyForDiscoverableProfile("discoverable")) {
  fail("duplicate verify must skip when discoverable");
}

console.log("verify-profile-index-idempotency: OK");
