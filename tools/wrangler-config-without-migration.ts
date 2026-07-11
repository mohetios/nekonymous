/**
 * Writes a temporary wrangler config with one DO migration tag removed.
 * Usage: node --experimental-strip-types tools/wrangler-config-without-migration.ts <tag> <outPath>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tag = process.argv[2];
const outPath = process.argv[3];
if (!tag || !outPath) {
  console.error("usage: wrangler-config-without-migration.ts <tag> <outPath>");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(`${root}/wrangler.jsonc`, "utf8");
const withoutComments = source.replace(/\/\/[^\n]*/g, "");
const config = JSON.parse(withoutComments) as {
  migrations?: Array<{ tag: string }>;
};

if (!Array.isArray(config.migrations)) {
  console.error("wrangler.jsonc has no migrations array");
  process.exit(1);
}

const next = config.migrations.filter((entry) => entry.tag !== tag);
if (next.length === config.migrations.length) {
  console.error(`migration tag not found: ${tag}`);
  process.exit(1);
}

config.migrations = next;
if (typeof config.main === "string" && !config.main.startsWith("/")) {
  config.main = `${root}/${config.main}`;
}
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
