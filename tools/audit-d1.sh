#!/usr/bin/env bash
# Read-only D1 privacy audit for Nekonymous V2 (identity + aggregate stats only).
#
# Usage:
#   ./tools/audit-d1.sh            # remote (production D1)
#   ./tools/audit-d1.sh --local    # local wrangler dev D1
#
# Fails if forbidden V1 conversation/matching tables exist in schema.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="--remote"
if [[ "${1:-}" == "--local" ]]; then
  TARGET="--local"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--local|--remote]" >&2
  exit 1
fi

WRANGLER=(wrangler)
DB_BINDING="DB"
KV_BINDING="NEKO_KV"

FORBIDDEN_TABLES=(
  assessment_profiles
  assessment_attempts
  assessment_answers
  profile_vector_index_events
  match_requests
  match_suggestions
  match_blocks
  match_events
)

ALLOWED_TABLES=(
  users
  public_links
  platform_daily_stats
  platform_daily_stats_by_key
  platform_daily_unique_stats
)

print_json_table() {
  node -e "
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf8');
    let data;
    for (let index = raw.indexOf('['); index >= 0; index = raw.indexOf('[', index + 1)) {
      try {
        data = JSON.parse(raw.slice(index));
        break;
      } catch {
        // Wrangler may print ANSI warnings before JSON.
      }
    }
    if (!data) {
      process.stdout.write(raw);
      process.exit(0);
    }
    const rows = data[0]?.results ?? [];
    if (!rows.length) {
      console.log('(no rows)');
      process.exit(0);
    }
    console.table(rows);
  "
}

run_query() {
  local title="$1"
  local sql="$2"
  echo ""
  echo "==> ${title}"
  "${WRANGLER[@]}" d1 execute "$DB_BINDING" "$TARGET" --command "$sql" 2>&1 | print_json_table
}

count_failures() {
  local sql="$1"
  "${WRANGLER[@]}" d1 execute "$DB_BINDING" "$TARGET" --command "$sql" 2>&1 | node -e "
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf8');
    let data;
    for (let index = raw.indexOf('['); index >= 0; index = raw.indexOf('[', index + 1)) {
      try {
        data = JSON.parse(raw.slice(index));
        break;
      } catch {}
    }
    if (!data) throw new Error('No Wrangler JSON payload found');
    const rows = data[0]?.results ?? [];
    const n = rows[0]?.fail_count ?? 0;
    process.stdout.write(String(n));
  "
}

table_exists() {
  local table="$1"
  local n
  n="$("${WRANGLER[@]}" d1 execute "$DB_BINDING" "$TARGET" --command \
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '${table}';" 2>&1 | node -e "
      const fs = require('fs');
      const raw = fs.readFileSync(0, 'utf8');
      let data;
      for (let index = raw.indexOf('['); index >= 0; index = raw.indexOf('[', index + 1)) {
        try {
          data = JSON.parse(raw.slice(index));
          break;
        } catch {}
      }
      if (!data) throw new Error('No Wrangler JSON payload found');
      process.stdout.write(String(data[0]?.results?.[0]?.n ?? 0));
    ")"
  [[ "$n" != "0" ]]
}

echo "Nekonymous D1 privacy audit (${TARGET#--})"
echo "Database binding: ${DB_BINDING}"
echo

run_query "Migration status" \
  "SELECT name FROM d1_migrations ORDER BY applied_at;"

echo ""
echo "==> Forbidden V1 table check"
SCHEMA_FAILS=0
for table in "${FORBIDDEN_TABLES[@]}"; do
  if table_exists "$table"; then
    echo "  FAIL forbidden table present: ${table}"
    SCHEMA_FAILS=$((SCHEMA_FAILS + 1))
  else
    echo "  ok  ${table} absent"
  fi
done

echo ""
echo "==> Allowed table row counts"
for table in "${ALLOWED_TABLES[@]}"; do
  if ! table_exists "$table"; then
    printf "  %-32s MISSING\n" "$table"
    SCHEMA_FAILS=$((SCHEMA_FAILS + 1))
    continue
  fi
  count="$("${WRANGLER[@]}" d1 execute "$DB_BINDING" "$TARGET" --command "SELECT COUNT(*) AS n FROM ${table};" 2>&1 | node -e "
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf8');
    let data;
    for (let index = raw.indexOf('['); index >= 0; index = raw.indexOf('[', index + 1)) {
      try {
        data = JSON.parse(raw.slice(index));
        break;
      } catch {}
    }
    if (!data) throw new Error('No Wrangler JSON payload found');
    process.stdout.write(String(data[0]?.results?.[0]?.n ?? '?'));
  ")"
  printf "  %-32s %s\n" "$table" "$count"
done

run_query "Users (hash + encrypted chat id)" \
  "SELECT id, LENGTH(telegram_user_hash) AS hash_len, CASE WHEN telegram_user_hash != '' AND telegram_user_hash NOT GLOB '*[^0-9]*' THEN 'FAIL_numeric_hash' ELSE 'ok' END AS hash_check, CASE WHEN telegram_chat_ciphertext LIKE '{%' THEN 'ok_encrypted' ELSE 'FAIL_plain_chat' END AS chat_check, locale, status FROM users ORDER BY created_at LIMIT 20;"

run_query "Daily aggregate stats" \
  "SELECT event_name, SUM(count) AS total FROM platform_daily_stats GROUP BY event_name ORDER BY event_name;"

echo ""
echo "==> Privacy failure counts"
USER_FAILS="$(count_failures "SELECT COUNT(*) AS fail_count FROM users WHERE (telegram_user_hash != '' AND telegram_user_hash NOT GLOB '*[^0-9]*') OR telegram_chat_ciphertext NOT LIKE '{%';")"
printf "  users privacy failures:              %s\n" "$USER_FAILS"

if [[ "$TARGET" == "--remote" ]]; then
  echo ""
  echo "==> KV routing keys (binding ${KV_BINDING})"
  KV_JSON="$("${WRANGLER[@]}" kv key list --binding "$KV_BINDING" --remote 2>/dev/null || echo '[]')"
  KV_COUNT="$(node -e "const k=JSON.parse(process.argv[1]); console.log(Array.isArray(k)?k.length:0)" "$KV_JSON")"
  echo "  key count: ${KV_COUNT}"
fi

TOTAL_FAILS=$((USER_FAILS + SCHEMA_FAILS))
echo ""
if [[ "$TOTAL_FAILS" -gt 0 ]]; then
  echo "AUDIT RESULT: FAIL (${TOTAL_FAILS} privacy/schema check failures)"
  exit 1
fi

echo "AUDIT RESULT: OK (V2 D1 schema; no forbidden tables)"
echo "Note: profiles, suggestions, and sealed tickets live in Durable Objects, not D1."
