/**
 * Writes a temporary wrangler config with one or more DO migration tags removed.
 *
 * Usage:
 *   node --experimental-strip-types tools/wrangler-config-without-migration.ts <outPath> <tag> [tag...]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const outPath = process.argv[2];
const tags = process.argv.slice(3);
if (!outPath || tags.length === 0) {
  console.error("usage: wrangler-config-without-migration.ts <outPath> <tag> [tag...]");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(`${root}/wrangler.jsonc`, "utf8");
const withoutComments = source.replace(/\/\/[^\n]*/g, "");
const config = JSON.parse(withoutComments) as {
  migrations?: Array<{ tag: string }>;
  main?: string;
};

if (!Array.isArray(config.migrations)) {
  console.error("wrangler.jsonc has no migrations array");
  process.exit(1);
}

const tagSet = new Set(tags);
const next = config.migrations.filter((entry) => !tagSet.has(entry.tag));
if (next.length === config.migrations.length) {
  console.error(`migration tag(s) not found: ${tags.join(", ")}`);
  process.exit(1);
}

config.migrations = next;
if (typeof config.main === "string" && !config.main.startsWith("/")) {
  config.main = `${root}/${config.main}`;
}
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
