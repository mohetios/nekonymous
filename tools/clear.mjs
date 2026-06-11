import { exec } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const NAMESPACE_ID = "de26a1b398614383a2b9702fafaa8824";

try {
  const { stdout } = await execAsync(
    `wrangler kv:key list --namespace-id ${NAMESPACE_ID}`
  );

  const keys = JSON.parse(stdout).map((keyObj) => keyObj.name);

  if (keys.length === 0) {
    console.log("No conversation keys found to delete.");
    process.exit(0);
  }

  writeFileSync("keys.json", JSON.stringify(keys), "utf8");

  const { stdout: deleteStdout } = await execAsync(
    `wrangler kv:bulk delete --namespace-id ${NAMESPACE_ID} keys.json`
  );

  console.log(`Deleted conversation keys: ${deleteStdout}`);
  unlinkSync("keys.json");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
