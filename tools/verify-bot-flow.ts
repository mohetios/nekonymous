import {
  CALLBACK_REF_RE,
  INBOX_CALLBACK,
  inboxCallbackQueryRegex,
  isCallbackRef,
} from "../src/utils/telegram-callbacks.ts";
import { MENU, isMainMenuLabel } from "../src/i18n/labels.ts";
import {
  MATCH_CALLBACK,
  matchCallbackQueryRegex,
} from "../src/features/matching/constants.ts";
import { BOT_COMMANDS, BOT_COMMAND_DEFINITIONS } from "../src/bot/commands.ts";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const readSource = async (relativePath: string): Promise<string> =>
  import("node:fs/promises").then((fs) =>
    fs.readFile(new URL(relativePath, import.meta.url), "utf8")
  );

const listSourceFiles = async (): Promise<string[]> => {
  const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
  const files: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.name.endsWith(".ts")) {
        files.push(relative(srcRoot, fullPath));
      }
    }
  };

  await walk(srcRoot);
  return files;
};

const FORBIDDEN_SOURCE_TOKENS = [
  "match_system",
  "m:refresh",
  "m:back",
  "callback-compat",
  "CALLBACK_COMPAT",
  "legacyMatch",
] as const;

const callbackRef = "A".repeat(32);

assert(CALLBACK_REF_RE.test(callbackRef), "callback ref must accept 32-char base64url");
assert(isCallbackRef(callbackRef), "isCallbackRef must accept valid callback ref");
assert(!isCallbackRef("abc"), "isCallbackRef must reject short callback ref");

for (const callbackData of [
  INBOX_CALLBACK.reply(callbackRef),
  INBOX_CALLBACK.block(callbackRef),
  INBOX_CALLBACK.unblock(callbackRef),
  INBOX_CALLBACK.report(callbackRef),
  INBOX_CALLBACK.nickname(callbackRef),
]) {
  assert(
    Buffer.byteLength(callbackData, "utf8") <= 64,
    `callback_data must be <= 64 bytes: ${callbackData}`
  );
}

assert(
  inboxCallbackQueryRegex("reply").test(`r:${callbackRef}`),
  "reply callback regex must match r:<ref>"
);

const matchCallbackRegex = matchCallbackQueryRegex();
assert(matchCallbackRegex.test("m:hub"), "match callback regex must accept m:hub");
assert(matchCallbackRegex.test("m:search"), "match callback regex must accept m:search");
assert(matchCallbackRegex.test("m:req:abc123"), "match callback regex must accept m:req");
assert(!matchCallbackRegex.test("m:refresh"), "match callback regex must reject m:refresh");
assert(!matchCallbackRegex.test("m:back"), "match callback regex must reject m:back");

const [
  handlersSource,
  resolveSource,
  inboxSource,
  messagingSource,
  labelsSource,
  userSource,
  keyboardsSource,
  settingsKeyboardsSource,
  matchingKeyboardsSource,
  inputNavigationSource,
  matchHandlersSource,
  commandsSource,
  menuSource,
  suggestionHubSource,
  profileScriptSource,
] = await Promise.all([
  readSource("../src/bot/register-handlers.ts"),
  readSource("../src/features/messaging/resolve-ticket-action.ts"),
  readSource("../src/features/messaging/render-inbox.ts"),
  readSource("../src/features/messaging/messaging-commands.ts"),
  readSource("../src/i18n/labels.ts"),
  readSource("../src/utils/user.ts"),
  readSource("../src/bot/keyboards.ts"),
  readSource("../src/features/settings/keyboards.ts"),
  readSource("../src/features/matching/keyboards.ts"),
  readSource("../src/bot/input-navigation.ts"),
  readSource("../src/features/matching/match-handlers.ts"),
  readSource("../src/bot/commands.ts"),
  readSource("../src/bot/menu.ts"),
  readSource("../src/features/matching/suggestion-hub.ts"),
  readSource("../tools/set-telegram-bot-profile.sh"),
]);

for (const action of ["reply", "block", "unblock", "nickname", "report"]) {
  assert(
    handlersSource.includes(`inboxCallbackQueryRegex("${action}")`),
    `register-handlers must wire inbox callback action: ${action}`
  );
}

assert(!handlersSource.includes("handleOpenTicketAction"), "dead o: open handler must be removed");
assert(!handlersSource.includes("match-system-handlers"), "match-system handlers must be removed");
assert(!handlersSource.includes('bot.command("match_system"'), "/match_system must not be registered");
assert(!commandsSource.includes('"match_system"'), "match_system must not be in BOT_COMMANDS");
assert(BOT_COMMANDS.length === 5, "public command list must contain exactly five commands");
assert(
  BOT_COMMAND_DEFINITIONS.length === 5,
  "BotFather command definitions must contain exactly five commands"
);
for (const item of BOT_COMMAND_DEFINITIONS) {
  assert(
    (BOT_COMMANDS as readonly string[]).includes(item.command),
    `BOT_COMMAND_DEFINITIONS must mirror BOT_COMMANDS: ${item.command}`
  );
}
assert(handlersSource.includes("UNKNOWN_COMMAND_MESSAGE"), "/match_system must reach generic unknown-command flow");
assert(handlersSource.includes("isBotCommand"), "register-handlers must use central command list via isBotCommand");
assert(handlersSource.includes("EXPIRED_CALLBACK_MESSAGE"), "unknown callbacks must use generic unavailable copy");
assert(
  handlersSource.includes("matchCallbackQueryRegex()"),
  "match callbacks must register only active match patterns"
);
assert(
  !handlersSource.includes('bot.callbackQuery(/^m:/'),
  "broad m: callback registration must be removed"
);
assert(
  handlersSource.includes('bot.callbackQuery(/.+/'),
  "unmatched callbacks must be answered by one generic catch-all"
);

assert(
  matchHandlersSource.includes("renderSuggestionHub") &&
    matchHandlersSource.includes("handleMatchCommand"),
  "/match must render the canonical suggestion hub"
);
assert(
  !matchHandlersSource.includes("m:refresh") && !matchHandlersSource.includes("m:back"),
  "legacy match callback aliases must not appear in match handlers"
);
assert(
  !matchHandlersSource.includes(
    "await renderSuggestionHub(ctx, env, userId);\n  } catch (error)"
  ),
  "unknown match callbacks must not fall through to renderSuggestionHub"
);

assert(typeof isMainMenuLabel === "function", "main menu label guard must be exported");
assert(
  menuSource.includes("renderSuggestionHub") && menuSource.includes("MENU.matchSystem"),
  "main menu match entry must render suggestion hub"
);

for (const token of ["MENU.link", "MENU.inbox", "MENU.matchSystem", "MENU.settings"]) {
  assert(keyboardsSource.includes(token), `main menu must include ${token}`);
}
assert(keyboardsSource.includes(".persistent()"), "main menu must be persistent");
assert(!keyboardsSource.includes(MENU.editName), "settings actions must not be on main reply keyboard");

assert(
  settingsKeyboardsSource.includes("buildSettingsHomeKeyboard"),
  "settings home must be inline"
);
assert(
  settingsKeyboardsSource.includes("SETTINGS_CALLBACK.editName"),
  "settings inline keyboard must wire edit name"
);

assert(
  matchingKeyboardsSource.includes("buildSuggestionHubKeyboard"),
  "suggestion hub must be inline"
);
assert(
  matchingKeyboardsSource.includes("MATCH_CALLBACK.search"),
  "suggestion hub must wire inline search"
);
assert(
  !matchingKeyboardsSource.includes("m:refresh") &&
    !matchingKeyboardsSource.includes("m:back"),
  "keyboards must not emit legacy match callbacks"
);

assert(
  labelsSource.includes("↩️ لغو") &&
    inputNavigationSource.includes("DRAFT_CANCEL_LABEL"),
  "draft keyboard must only expose cancel"
);
assert(
  !inputNavigationSource.includes(MENU.settings),
  "draft keyboard must not include settings"
);

const draftIndex = messagingSource.indexOf("if (isTextInputDraft(draft))");
const menuIndex = messagingSource.indexOf("await handleMainMenuCommand(ctx");
assert(draftIndex > 0 && menuIndex > draftIndex, "draft input must route before main menu labels");

assert(!messagingSource.includes('pendingSettings === "editName"'), "legacy editName draft path must be removed");
assert(messagingSource.includes('draft.mode === "display_name"'), "display name draft must use display_name mode");
assert(!userSource.includes("isMenuLabel"), "display name validation must not reserve menu labels");
assert(labelsSource.includes('trimmed.startsWith("/")'), "display name validation must only forbid commands");

assert(
  inboxSource.includes("MAX_INBOX_DECRYPT_PER_REQUEST = 10"),
  "render-inbox must keep decrypt cap at 10 per request"
);
assert(inboxSource.includes("buildInboxPaginationKeyboard"), "render-inbox must expose pagination keyboard");

assert(resolveSource.includes("isCallbackRef(ticketRef)"), "resolve-ticket-action must validate callback ref format");
assert(
  resolveSource.includes("constantTimeEqual(ownerProofCandidate, ticket.ownerProofTag)"),
  "resolve-ticket-action must verify owner proof"
);

assert(MATCH_CALLBACK.hub === "m:hub", "canonical hub callback must exist");
assert(MATCH_CALLBACK.search === "m:search", "canonical search callback must exist");
assert(
  suggestionHubSource.includes("export const renderSuggestionHub"),
  "canonical suggestion hub renderer must exist"
);

assert(
  profileScriptSource.includes("BOT_COMMAND_DEFINITIONS"),
  "BotFather tooling must use central command definitions"
);
assert(
  !profileScriptSource.includes("match_system"),
  "BotFather tooling must not publish /match_system"
);

const srcFiles = await listSourceFiles();
for (const relativePath of srcFiles) {
  const source = await readSource(`../src/${relativePath}`);
  for (const token of FORBIDDEN_SOURCE_TOKENS) {
    assert(
      !source.includes(token),
      `forbidden legacy token "${token}" found in src/${relativePath}`
    );
  }
}

console.log("verify-bot-flow: ok");
