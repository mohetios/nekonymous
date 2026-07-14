/**
 * Validates migrations/0001_init.sql matches V2 D1 contract.
 * Run: pnpm test:d1-schema
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import contract from "./d1-contract.json" with { type: "json" };
import { assert } from "./verify-helpers.ts";

const migrationPath = fileURLToPath(
  new URL("../migrations/0001_init.sql", import.meta.url)
);
const sql = readFileSync(migrationPath, "utf8");

for (const table of contract.requiredTables) {
  assert(
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i").test(sql),
    `missing required table in migration: ${table}`
  );
}

for (const table of contract.forbiddenTables) {
  assert(
    !new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i").test(sql),
    `forbidden V1 table in migration: ${table}`
  );
}

assert(
  /telegram_user_hash TEXT NOT NULL UNIQUE/.test(sql),
  "users.telegram_user_hash must be UNIQUE"
);

assert(
  /telegram_chat_ciphertext TEXT NOT NULL/.test(sql),
  "users.telegram_chat_ciphertext must be required"
);

assert(
  !/profile_summary|match_request|assessment_/.test(sql),
  "migration must not reference V1 profile/match columns"
);

console.log("verify-d1-schema: OK");
