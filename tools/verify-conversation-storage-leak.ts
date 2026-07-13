/**
 * Fail if conversation vault schemas or fixtures contain forbidden linkage fields.
 * Run: pnpm test:conversation-privacy
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const forbiddenColumnPatterns = [
  /\buser_id\b/i,
  /\btelegram_id\b/i,
  /\bprofile_ref\b/i,
  /\bcandidate_id\b/i,
  /\brequester_id\b/i,
  /\btelegram_user_hash\b/i,
  /\bdisplay_name\b/i,
  /\bmessage_text\b/i,
  /\bintro_plain\b/i,
  /\bprofile_json\b/i,
];

const forbiddenFixtureKeys = [
  "userId",
  "user_id",
  "telegramId",
  "telegram_id",
  "profileRef",
  "profile_ref",
  "candidateId",
  "requesterId",
  "displayName",
  "messageText",
  "profileJson",
];

const schemaSources = [
  `${root}/src/storage/profile-vault/profile-vault.do.ts`,
  `${root}/src/storage/conversation-vault/conversation-vault.do.ts`,
  `${root}/src/storage/pair-ledger/pair-ledger.do.ts`,
];

const scanSqlColumns = (source: string, content: string): void => {
  for (const pattern of forbiddenColumnPatterns) {
    if (pattern.test(content)) {
      fail(`${source}: forbidden storage column pattern ${pattern}`);
    }
  }
};

for (const source of schemaSources) {
  const content = readFileSync(source, "utf8");
  scanSqlColumns(source, content);
}

const queueTypes = readFileSync(
  `${root}/src/contracts/conversation/profile-index.ts`,
  "utf8"
);
if (/userId|profileRef|telegram/i.test(queueTypes)) {
  fail("profile-index contract must not name user or raw profile refs");
}

const fixtureSamples = [
  {
    profile_hash: "hash-only",
    owner_proof_tag: "proof",
    profile_enc: "cipher",
    route_enc: "cipher",
    revision: 1,
    status: "private",
    created_at: 1,
    updated_at: 1,
  },
  {
    suggestion_hash: "hash-only",
    requester_proof_tag: "proof",
    candidate_route_enc: "cipher",
    pair_tag: "blind-pair",
    explanation_enc: "cipher",
    status: "created",
    created_at: 1,
    expires_at: 2,
  },
  {
    request_hash: "hash-only",
    requester_proof_tag: "proof",
    candidate_proof_tag: "proof",
    requester_route_enc: "cipher",
    candidate_route_enc: "cipher",
    intro_enc: "cipher",
    status: "pending",
    created_at: 1,
    expires_at: 2,
  },
];

const walkFixture = (value: unknown, path: string): void => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      walkFixture(item, `${path}[${index}]`);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (forbiddenFixtureKeys.includes(key)) {
        fail(`fixture ${path}.${key}: forbidden key`);
      }
      walkFixture(nested, `${path}.${key}`);
    }
  }
};

for (const [index, fixture] of fixtureSamples.entries()) {
  walkFixture(fixture, `fixture-${index}`);
}

const storageDir = `${root}/src/storage`;
for (const dir of ["profile-vault", "conversation-vault", "pair-ledger"]) {
  for (const file of readdirSync(`${storageDir}/${dir}`)) {
    if (!file.endsWith(".do.ts")) {
      continue;
    }
    const content = readFileSync(`${storageDir}/${dir}/${file}`, "utf8");
    if (/profile_ref|user_id|candidate_id|requester_id/i.test(content)) {
      fail(`${dir}/${file}: forbidden linkage field in DO source`);
    }
  }
}

console.log("verify-conversation-storage-leak: ok");
