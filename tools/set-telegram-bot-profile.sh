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
نِکونیموس یک ربات پیام ناشناس فارسی‌محور است؛ برای ساخت لینک شخصی، دریافت پیام ناشناس، پاسخ ناشناس، ارزیابی سبک گفت‌وگو و پیشنهاد گفت‌وگوی اختیاری. پیام‌ها از طریق تلگرام و سرور ربات پردازش می‌شوند؛ داده‌های ذخیره‌شده تا حد ممکن کمینه و در حالت ذخیره رمزنگاری می‌شوند.
EOF
tg_post setMyDescription \
  --data-urlencode "description=${DESCRIPTION}" \
  --data-urlencode "language_code=fa" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyShortDescription (fa)"
read -r -d '' SHORT_DESCRIPTION <<'EOF' || true
پیام ناشناس، لینک شخصی، پاسخ ناشناس و پیشنهاد گفت‌وگوی اختیاری؛ فارسی‌محور و شفاف درباره مرزهای حریم خصوصی.
EOF
tg_post setMyShortDescription \
  --data-urlencode "short_description=${SHORT_DESCRIPTION}" \
  --data-urlencode "language_code=fa" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyDescription (en)"
read -r -d '' DESCRIPTION_EN <<'EOF' || true
Nekonymous is a Persian-first anonymous messaging bot for creating a personal link, receiving anonymous messages, replying anonymously, exploring conversation-style assessment, and optional conversation suggestions. Messages are processed through Telegram and the bot server; stored data is minimized where possible and encrypted at rest.
EOF
tg_post setMyDescription \
  --data-urlencode "description=${DESCRIPTION_EN}" \
  --data-urlencode "language_code=en" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyShortDescription (en)"
read -r -d '' SHORT_DESCRIPTION_EN <<'EOF' || true
Anonymous messages, personal links, anonymous replies, and optional conversation suggestions with clear privacy boundaries.
EOF
tg_post setMyShortDescription \
  --data-urlencode "short_description=${SHORT_DESCRIPTION_EN}" \
  --data-urlencode "language_code=en" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyCommands"
COMMANDS_JSON='[
  {"command":"start","description":"شروع و دریافت لینک شخصی"},
  {"command":"inbox","description":"صندوق پیام‌ها"},
  {"command":"settings","description":"تنظیمات و حریم خصوصی"},
  {"command":"assessment","description":"ارزیابی سبک گفت‌وگو"},
  {"command":"match","description":"پیشنهاد گفت‌وگو"},
  {"command":"match_system","description":"پیشنهادهای گفت‌وگو"}
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
