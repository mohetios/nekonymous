import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { shardNameForLookupHash } from "../src/storage/shard-routing.ts";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const wranglerSource = readFileSync(
  fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
  "utf8"
);

assert(
  wranglerSource.includes('"PROFILE_VAULT_DO"'),
  "wrangler.jsonc must bind PROFILE_VAULT_DO"
);
assert(
  wranglerSource.includes('"CONVERSATION_VAULT_DO"'),
  "wrangler.jsonc must bind CONVERSATION_VAULT_DO"
);
assert(
  wranglerSource.includes('"PAIR_LEDGER_DO"'),
  "wrangler.jsonc must bind PAIR_LEDGER_DO"
);
assert(
  wranglerSource.includes('"CONVERSATION_VECTORS"'),
  "wrangler.jsonc must bind CONVERSATION_VECTORS"
);
assert(
  wranglerSource.includes("nekonymous-conversation-v2"),
  "wrangler.jsonc must use nekonymous-conversation-v2 vector index"
);
assert(
  wranglerSource.includes("neko-profile-index"),
  "wrangler.jsonc must configure neko-profile-index queue"
);
assert(
  wranglerSource.includes("v8-conversation-v2-vault-shards"),
  "wrangler.jsonc must include v8 DO migration"
);
assert(
  !wranglerSource.includes('"PROFILE_VECTORS"'),
  "wrangler.jsonc must not bind legacy PROFILE_VECTORS"
);
assert(!wranglerSource.includes('"binding": "AI"'), "wrangler.jsonc must not bind Workers AI");

const profileShard = shardNameForLookupHash("profile", "abcd1234efgh5678");
const conversationShard = shardNameForLookupHash("conversation", "abcd1234efgh5678");
const pairShard = shardNameForLookupHash("pair", "abcd1234efgh5678");

assert(profileShard === "profile:abcd", `unexpected profile shard: ${profileShard}`);
assert(
  conversationShard === "conversation:abcd",
  `unexpected conversation shard: ${conversationShard}`
);
assert(pairShard === "pair:abcd", `unexpected pair shard: ${pairShard}`);

console.log("verify-conversation-v2-resources: ok");
