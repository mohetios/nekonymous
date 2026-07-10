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
نِکونیموس یک ربات فارسی‌محور برای پیام ناشناس روی تلگرام است.

باهاش می‌تونی لینک پیام ناشناس بسازی، پیام بگیری، پاسخ ناشناس بدی، دریافت پیام رو متوقف یا فعال کنی، و اگه خواستی از ارزیابی سبک گفت‌وگو و پیشنهاد گفت‌وگو استفاده کنی.

نِکونیموس ناشناسی کامل یا رمزنگاری سرتاسری ادعا نمی‌کند. تلگرام و زیرساخت پردازش بات هنگام ارسال و دریافت پیام، متن پیام را می‌بینند. هدف محصول این است که کاربران در جریان معمول از هم پنهان بمانند و داده‌های ذخیره‌شده تا حد ممکن محدود باشند.
EOF
tg_post setMyDescription \
  --data-urlencode "description=${DESCRIPTION}" \
  --data-urlencode "language_code=fa" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> setMyShortDescription (fa)"
read -r -d '' SHORT_DESCRIPTION <<'EOF' || true
لینک پیام ناشناس، پاسخ ناشناس و پیشنهاد گفت‌وگو با مرزهای روشن حریم خصوصی.
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
COMMANDS_JSON="$(node --experimental-strip-types -e "
import { BOT_COMMAND_DEFINITIONS } from './src/bot/commands.ts';
console.log(JSON.stringify(BOT_COMMAND_DEFINITIONS));
")"
tg_post setMyCommands \
  --data-urlencode "commands=${COMMANDS_JSON}" \
  --data-urlencode "language_code=fa" | node -e "
const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)} console.log('ok');
"

echo "==> getMyCommands (verify)"
GET_COMMANDS="$(curl -sS "${API}/getMyCommands?language_code=fa")"
echo "$GET_COMMANDS" | node -e "
const fs=require('fs');
const expected=JSON.parse(process.argv[1]);
const j=JSON.parse(fs.readFileSync(0,'utf8'));
if(!j.ok){console.error(j);process.exit(1)}
const actual=j.result.map((c)=>({command:c.command,description:c.description}));
const same=actual.length===expected.length && expected.every((item,idx)=>
  actual[idx]?.command===item.command && actual[idx]?.description===item.description
);
if(!same){
  console.error('getMyCommands mismatch');
  console.error('expected', expected);
  console.error('actual', actual);
  process.exit(1);
}
console.log('ok: five commands verified');
" "$COMMANDS_JSON"

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
