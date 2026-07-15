/**
 * Runs static verify scripts in a stable order.
 *
 * Usage:
 *   node --experimental-strip-types tools/run-verify.ts
 *   node --experimental-strip-types tools/run-verify.ts --filter=core
 *   node --experimental-strip-types tools/run-verify.ts --filter=conversation
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const CORE_SUITES = [
  "verify-ticketing.ts",
  "verify-idempotency.ts",
  "verify-stats.ts",
  "verify-bot-flow.ts",
  "verify-d1-schema.ts",
  "verify-profile-index-idempotency.ts",
  "verify-release-hardening.ts",
] as const;

const CONVERSATION_SUITES = [
  "verify-conversation-resources.ts",
  "verify-conversation-capabilities.ts",
  "verify-conversation-storage-leak.ts",
  "verify-conversation-profile.ts",
  "verify-conversation-index.ts",
  "verify-conversation-retrieval.ts",
  "verify-conversation-ranking.ts",
  "verify-conversation-eligibility.ts",
  "verify-conversation-suggestions.ts",
  "verify-conversation-requests.ts",
] as const;

const ALL_SUITES = [...CORE_SUITES, ...CONVERSATION_SUITES] as const;

const filterArg = process.argv.find((arg) => arg.startsWith("--filter="));
const filter = filterArg?.slice("--filter=".length) ?? "all";

const suites =
  filter === "core"
    ? CORE_SUITES
    : filter === "conversation"
      ? CONVERSATION_SUITES
      : filter === "all"
        ? ALL_SUITES
        : null;

if (!suites) {
  console.error("usage: run-verify.ts [--filter=core|conversation|all]");
  process.exit(1);
}

let failed = 0;

for (const script of suites) {
  const label = script.replace(/^verify-/, "").replace(/\.ts$/, "");
  process.stdout.write(`==> verify:${label}\n`);
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", `${root}/tools/${script}`],
    {
      cwd: root,
      stdio: "inherit",
    }
  );
  if (result.status !== 0) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`run-verify: ${failed} suite(s) failed`);
  process.exit(1);
}

console.log(`run-verify: OK (${suites.length} suites)`);
