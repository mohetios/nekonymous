/**
 * Validates migrations/0001_init.sql matches V2 D1 contract.
 * Run: pnpm test:d1-schema
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const migrationPath = fileURLToPath(
  new URL("../migrations/0001_init.sql", import.meta.url)
);
const sql = readFileSync(migrationPath, "utf8");

const REQUIRED_TABLES = [
  "users",
  "public_links",
  "platform_daily_stats",
  "platform_daily_stats_by_key",
  "platform_daily_unique_stats",
] as const;

const FORBIDDEN_TABLES = [
  "assessment_profiles",
  "assessment_attempts",
  "assessment_answers",
  "profile_vector_index_events",
  "match_requests",
  "match_suggestions",
  "match_blocks",
  "match_events",
  "reports",
  "platform_stats",
] as const;

for (const table of REQUIRED_TABLES) {
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i").test(sql)) {
    fail(`missing required table in migration: ${table}`);
  }
}

for (const table of FORBIDDEN_TABLES) {
  if (new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i").test(sql)) {
    fail(`forbidden V1 table in migration: ${table}`);
  }
}

if (!/telegram_user_hash TEXT NOT NULL UNIQUE/.test(sql)) {
  fail("users.telegram_user_hash must be UNIQUE");
}

if (!/telegram_chat_ciphertext TEXT NOT NULL/.test(sql)) {
  fail("users.telegram_chat_ciphertext must be required");
}

if (/profile_summary|match_request|assessment_/.test(sql)) {
  fail("migration must not reference V1 profile/match columns");
}

console.log("verify-d1-schema: OK");
