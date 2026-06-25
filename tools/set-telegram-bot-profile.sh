#!/usr/bin/env bash
# Set Telegram bot profile metadata (name, descriptions, commands).
#
# Usage:
#   ./tools/set-telegram-bot-profile.sh
#
# Reads SECRET_TELEGRAM_API_TOKEN from .dev.vars in repo root.
# Does not print the token.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VARS_FILE="${ROOT}/.dev.vars"
if [[ ! -f "$VARS_FILE" ]]; then
  echo "Missing .dev.vars — copy from .env.example and fill secrets." >&2
  exit 1
fi

TOKEN="$(grep -m1 '^SECRET_TELEGRAM_API_TOKEN=' "$VARS_FILE" | cut -d= -f2- | tr -d '\r')"
if [[ -z "$TOKEN" ]]; then
  echo "SECRET_TELEGRAM_API_TOKEN not set in .dev.vars" >&2
  exit 1
fi

API="https://api.telegram.org/bot${TOKEN}"

tg_post() {
  local method="$1"
  shift
  curl -sS -X POST "${API}/${method}" "$@"
}

echo "==> setMyName"
tg_post setMyName --data-urlencode "name=نِکونیموس" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyDescription (fa)"
read -r -d '' DESCRIPTION <<'EOF' || true
نِکونیموس (Nekonymous) ربات پیام ناشناس در تلگرام است.

• لینک شخصی — دیگران بدون دیدن username شما پیام می‌فرستند
• /inbox — خواندن و پاسخ ناشناس، مسدودسازی و گزارش
• ارزیابی سبک گفت‌وگو — سیگنال محصولی، نه تشخیص بالینی
• مچ‌یابی opt-in — فقط با پذیرش طرف مقابل

صادقانه: E2EE نیست. تلگرام و سرور هنگام ارسال متن را می‌بینند. متن پیام پس از تحویل در /inbox از storage پاک می‌شود.

/start · /inbox · /settings · /assessment · /match
EOF
tg_post setMyDescription \
  --data-urlencode "description=${DESCRIPTION}" \
  --data-urlencode "language_code=fa" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyShortDescription (fa)"
SHORT="نِکونیموس — پیام ناشناس، ارزیابی سبک گفت‌وگو، مچ‌یابی opt-in. hosted relay؛ E2EE نیست."
tg_post setMyShortDescription \
  --data-urlencode "short_description=${SHORT}" \
  --data-urlencode "language_code=fa" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyDescription (en)"
read -r -d '' DESCRIPTION_EN <<'EOF' || true
Nekonymous — Persian-first anonymous Telegram bot.

Personal deep-link messaging, conversation-style assessment, and opt-in matching. Not E2EE: Telegram and the server see plaintext during delivery. Message bodies are cleared from storage after /inbox delivery.

/start · /inbox · /settings · /assessment · /match
EOF
tg_post setMyDescription \
  --data-urlencode "description=${DESCRIPTION_EN}" \
  --data-urlencode "language_code=en" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyShortDescription (en)"
SHORT_EN="Anonymous Telegram relay: deep-link inbox, assessment, opt-in matching. Encrypted at rest; not E2EE."
tg_post setMyShortDescription \
  --data-urlencode "short_description=${SHORT_EN}" \
  --data-urlencode "language_code=en" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyCommands"
COMMANDS_JSON='[
  {"command":"start","description":"شروع و دریافت لینک شخصی"},
  {"command":"inbox","description":"صندوق پیام‌های ناشناس"},
  {"command":"settings","description":"تنظیمات و حریم خصوصی"},
  {"command":"assessment","description":"ارزیابی سبک گفت‌وگو"},
  {"command":"match","description":"مچ‌یابی ناشناس"},
  {"command":"match_system","description":"منوی مچ‌یابی"}
]'
tg_post setMyCommands \
  --data-urlencode "commands=${COMMANDS_JSON}" \
  --data-urlencode "language_code=fa" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setChatMenuButton (commands)"
tg_post setChatMenuButton \
  -d "menu_button={\"type\":\"commands\"}" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> getMe (refresh BOT_INFO in .dev.vars manually if needed)"
ME="$(curl -sS "${API}/getMe")"
echo "$ME" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)}
const r=j.result;
console.log(JSON.stringify({id:r.id,first_name:r.first_name,username:r.username,is_bot:r.is_bot},null,2));
"

echo "Done."
