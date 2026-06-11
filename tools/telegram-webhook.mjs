/**
 * Manage Telegram webhook for local vs production testing.
 *
 * Usage:
 *   node tools/telegram-webhook.mjs info
 *   node tools/telegram-webhook.mjs set https://your-tunnel.example.com/bot
 *   node tools/telegram-webhook.mjs local https://your-tunnel.example.com
 *   node tools/telegram-webhook.mjs restore
 *   node tools/telegram-webhook.mjs delete
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const loadDevVars = () => {
  const vars = {};
  for (const file of [".dev.vars", ".env"]) {
    try {
      const content = readFileSync(resolve(ROOT, file), "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!(key in vars)) vars[key] = value;
      }
    } catch {
      // optional file
    }
  }
  return vars;
};

const api = async (token, method, body) => {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined
  );
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram API error: ${method}`);
  }
  return data.result;
};

const normalizeBotUrl = (baseUrl) => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/bot") ? trimmed : `${trimmed}/bot`;
};

const vars = loadDevVars();
const token = vars.SECRET_TELEGRAM_API_TOKEN;
const secret = vars.BOT_SECRET_KEY;
const productionUrl = vars.PRODUCTION_WEBHOOK_URL;

const [command, arg] = process.argv.slice(2);

if (!token) {
  console.error("Missing SECRET_TELEGRAM_API_TOKEN in .dev.vars or .env");
  process.exit(1);
}

if (!command || command === "help" || command === "--help") {
  console.log(`Commands:
  info                         Show current Telegram webhook
  set <public-url>             Set webhook to <public-url>/bot
  local <tunnel-base-url>      Same as set; uses BOT_SECRET_KEY from .dev.vars
  restore                      Set webhook back to PRODUCTION_WEBHOOK_URL
  delete                       Remove webhook (bot stops receiving updates)

Local dev flow:
  1. pnpm dev
  2. cloudflared tunnel --url http://127.0.0.1:8787
  3. pnpm webhook:local https://<tunnel-host>
  4. pnpm webhook:restore   when finished`);
  process.exit(0);
}

try {
  if (command === "info") {
    const info = await api(token, "getWebhookInfo");
    console.log(JSON.stringify(info, null, 2));
    process.exit(0);
  }

  if (command === "delete") {
    await api(token, "deleteWebhook", { drop_pending_updates: true });
    console.log("Webhook deleted. Telegram will not deliver updates until set again.");
    process.exit(0);
  }

  if (command === "restore") {
    if (!productionUrl) {
      console.error("Set PRODUCTION_WEBHOOK_URL in .dev.vars or .env first.");
      process.exit(1);
    }
    if (!secret) {
      console.error("Missing BOT_SECRET_KEY in .dev.vars or .env");
      process.exit(1);
    }
    const url = normalizeBotUrl(productionUrl);
    await api(token, "setWebhook", {
      url,
      secret_token: secret,
      drop_pending_updates: false,
    });
    console.log(`Webhook restored to ${url}`);
    process.exit(0);
  }

  if (command === "set" || command === "local") {
    if (!arg) {
      console.error(`Usage: node tools/telegram-webhook.mjs ${command} <public-base-url>`);
      process.exit(1);
    }
    if (!secret) {
      console.error("Missing BOT_SECRET_KEY in .dev.vars or .env");
      process.exit(1);
    }
    const url = normalizeBotUrl(arg);
    await api(token, "setWebhook", {
      url,
      secret_token: secret,
      drop_pending_updates: true,
    });
    console.log(`Webhook set to ${url}`);
    console.log(
      "Telegram now sends updates here only. Production worker will not receive bot traffic."
    );
    if (productionUrl) {
      console.log(`Run "pnpm webhook:restore" to point back to production.`);
    } else {
      console.log(`Save your production URL as PRODUCTION_WEBHOOK_URL for easy restore.`);
    }
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
