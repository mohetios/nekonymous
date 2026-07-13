import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const sourceFiles: string[] = [];
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (path.endsWith(".ts") && !path.endsWith(".d.ts")) {
      sourceFiles.push(path);
    }
  }
};

walk(join(root, "src"));

const read = (path: string): string => readFileSync(path, "utf8");
const rel = (path: string): string => relative(root, path);

const exportedDeclarations = new Map<string, string[]>();
const exportedDeclarationRe = /^export\s+(?:type|interface|enum)\s+([A-Za-z0-9_]+)/gm;

for (const file of sourceFiles) {
  const source = read(file);
  let match: RegExpExecArray | null;
  while ((match = exportedDeclarationRe.exec(source)) !== null) {
    const name = match[1];
    const entries = exportedDeclarations.get(name) ?? [];
    entries.push(rel(file));
    exportedDeclarations.set(name, entries);
  }
}

for (const [name, files] of exportedDeclarations) {
  if (files.length > 1) {
    fail(`duplicate exported declaration ${name}: ${files.join(", ")}`);
  }
}

for (const file of sourceFiles) {
  const source = read(file);
  const path = rel(file);

  if (/^export\s+enum\s+/m.test(source)) {
    fail(`exported enum is forbidden: ${path}`);
  }

  if (path.startsWith("src/contracts/")) {
    if (/\bany\b/.test(source)) {
      fail(`contract file must not use any: ${path}`);
    }
    if (/as\s+unknown\s+as|as\s+any/.test(source)) {
      fail(`contract file must not use double/any assertions: ${path}`);
    }
  }

  if (
    /(?:interface|type)\s+(?:Env|CloudflareBindings)\b/.test(source) &&
    path !== "src/contracts/runtime.ts"
  ) {
    fail(`manual Env/binding declaration outside runtime contract: ${path}`);
  }
}

const allSource = sourceFiles.map((file) => read(file)).join("\n");
for (const token of [
  "ReportLedger",
  "REPORT_LEDGER",
  "claimUnreadBatch",
  "unread_notice_state",
  "blocked_user_id",
  "target_user_id",
  "senderRouteTag",
  "recipientRouteTag",
  "senderAlias",
  "reportSeeds",
]) {
  if (allSource.includes(token)) {
    fail(`forbidden legacy type/storage token remains: ${token}`);
  }
}

const mustBeUnique = [
  "BotUser",
  "CipherEnvelope",
  "ConversationProfile",
  "ConversationRequestTicketRecord",
  "ConversationSuggestionTicketRecord",
  "D1User",
  "D1UserStatus",
  "Environment",
  "MessagePayload",
  "ProfileIndexJob",
  "ProfileIndexJobRecord",
  "ProfileVaultRecord",
  "ProfileVectorRouteRecord",
  "SafetyReportEvent",
  "SafetyReportResult",
  "SanctionStatus",
  "TicketCapability",
  "RouteCapsule",
  "TicketStatus",
  "TicketVaultRecord",
  "SafetyDecision",
  "TelegramOutboxSendStatus",
  "TelegramOutboxJob",
  "UnreadDeliveryClaim",
  "UserDraft",
  "UserDraftMode",
  "VectorRouteRole",
  "OutboxQueueJob",
];

for (const name of mustBeUnique) {
  const files = exportedDeclarations.get(name) ?? [];
  if (files.length !== 1 || !files[0].startsWith("src/contracts/")) {
    fail(`${name} must have exactly one exported owner under src/contracts`);
  }
}

try {
  read(join(root, "src/contracts/index.ts"));
  fail("root contract mega-barrel is forbidden: src/contracts/index.ts");
} catch {
  // expected: no root barrel
}

for (const path of [
  "src/types.ts",
  "src/status.ts",
  "src/features/conversation/profile/types.ts",
  "src/storage/profile-vault/profile-vault.types.ts",
  "src/storage/conversation-vault/conversation-vault.types.ts",
  "src/storage/ticket-vault/ticket-vault.types.ts",
  "src/storage/safety-state/safety-state.types.ts",
  "src/queues/telegram-outbox.types.ts",
  "src/queues/profile-index.types.ts",
]) {
  try {
    read(join(root, path));
    fail(`compatibility type shim is forbidden: ${path}`);
  } catch {
    // expected: removed compatibility shim
  }
}

console.log("audit-types: OK");
