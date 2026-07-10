import { BOT_COMMAND_DESCRIPTIONS } from "../i18n/labels.ts";

/** Slash commands registered in register-handlers and recognized as valid. */
export const BOT_COMMANDS = [
  "start",
  "inbox",
  "settings",
  "assessment",
  "match",
] as const;

export const BOT_COMMAND_DEFINITIONS = [
  { command: "start", description: BOT_COMMAND_DESCRIPTIONS.start },
  { command: "inbox", description: BOT_COMMAND_DESCRIPTIONS.inbox },
  { command: "settings", description: BOT_COMMAND_DESCRIPTIONS.settings },
  { command: "assessment", description: BOT_COMMAND_DESCRIPTIONS.assessment },
  { command: "match", description: BOT_COMMAND_DESCRIPTIONS.match },
] as const satisfies ReadonlyArray<{
  command: (typeof BOT_COMMANDS)[number];
  description: string;
}>;

export const isBotCommand = (value: string): value is (typeof BOT_COMMANDS)[number] =>
  (BOT_COMMANDS as readonly string[]).includes(value);
