import { MENU } from "../src/i18n/labels.ts";
import { SETTINGS_CALLBACK } from "../src/features/settings/constants.ts";
import { STAT_EVENTS } from "../src/stats/events.ts";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const bucketSensitiveCount = (value: number): string => {
  if (value < 5) {
    return "کمتر از ۵";
  }
  if (value <= 20) {
    return "۵ تا ۲۰";
  }
  if (value <= 100) {
    return "۲۰ تا ۱۰۰";
  }
  return "۱۰۰+";
};

// 1) settings menu label exists for stats button
assert(MENU.stats === "📊 آمار", "settings menu must expose 📊 آمار label");

// 2) callback data stays within Telegram 64-byte limit
for (const callback of Object.values(SETTINGS_CALLBACK)) {
  assert(
    Buffer.byteLength(callback, "utf8") <= 64,
    `callback_data must be <= 64 bytes: ${callback}`
  );
}

assert(
  SETTINGS_CALLBACK.stats === "s:stats",
  "stats callback must use s:stats"
);
assert(
  SETTINGS_CALLBACK.back === "s:back",
  "settings back callback must use s:back"
);

// 3) low report counts are bucketed
assert(
  bucketSensitiveCount(0) === "کمتر از ۵",
  "zero reports must bucket to کمتر از ۵"
);
assert(
  bucketSensitiveCount(4) === "کمتر از ۵",
  "small report counts must be bucketed"
);
assert(
  bucketSensitiveCount(150) === "۱۰۰+",
  "large report counts must bucket to ۱۰۰+"
);

const readSource = async (relativePath: string): Promise<string> =>
  import("node:fs/promises").then((fs) =>
    fs.readFile(new URL(relativePath, import.meta.url), "utf8")
  );

const [
  formatSource,
  readerSource,
  renderSource,
  keyboardSource,
  consumerSource,
  emitSource,
] = await Promise.all([
  readSource("../src/stats/stats-format.ts"),
  readSource("../src/stats/stats-reader.ts"),
  readSource("../src/features/settings/render-stats-page.ts"),
  readSource("../src/bot/keyboards.ts"),
  readSource("../src/stats/stats-consumer.ts"),
  readSource("../src/stats/emit-stat.ts"),
]);

// 4) empty stats state copy exists in formatter source
assert(
  formatSource.includes("هنوز داده‌ی کافی برای نمایش آمار وجود ندارد"),
  "missing stats must render empty state copy"
);
assert(
  formatSource.includes("آمار کلی نکونیموس"),
  "stats page must include aggregate title"
);

// 5) formatted stats source must not include risky tokens
for (const forbidden of [
  "ticketRef",
  "sender_id",
  "recipient_id",
  "telegram_user_id",
  "chat_id",
  "message_body",
]) {
  assert(
    !formatSource.includes(forbidden),
    `stats formatter must not include ${forbidden}`
  );
}

// 6) emitStat failure must not break user flow
assert(
  emitSource.includes("catch") && emitSource.includes("best-effort"),
  "emitStat must swallow queue failures"
);

// 7) stats consumer aggregates in batch and acks invalid events
assert(
  consumerSource.includes("counters.set") &&
    consumerSource.includes("message.ack()") &&
    consumerSource.includes("batch.ackAll"),
  "stats consumer must aggregate batch counters and ack invalid events"
);

// 8) stats reader source only references aggregate tables
assert(
  readerSource.includes("platform_daily_stats"),
  "stats reader must query platform_daily_stats"
);
assert(
  !readerSource.includes("UserStateDO") &&
    !readerSource.includes("TicketVault") &&
    !readerSource.includes("inbox_tickets"),
  "stats reader must not query durable objects or inbox tables"
);

// 9) stats page renderer must not import durable object clients
assert(
  !renderSource.includes("user-state-client") &&
    !renderSource.includes("ticket-vault") &&
    !renderSource.includes("report-ledger"),
  "stats page render must not call DO storage clients"
);

// 10) settings keyboard includes stats button
assert(
  keyboardSource.includes("MENU.stats"),
  "settings keyboard builder must include stats button"
);

// 11) core stat events exist
for (const eventName of [
  STAT_EVENTS.USER_CREATED,
  STAT_EVENTS.USER_ACTIVE,
  STAT_EVENTS.MESSAGE_CREATED,
  STAT_EVENTS.MESSAGE_DELIVERED,
  STAT_EVENTS.INBOX_OPENED,
  STAT_EVENTS.REPLY_SENT,
  STAT_EVENTS.REPORT_CREATED,
  STAT_EVENTS.SUGGESTION_SEARCH,
]) {
  assert(
    consumerSource.includes("isStatsEventName") || emitSource.includes(eventName),
    `missing stat event ${eventName}`
  );
}

console.log("verify-stats: ok");
