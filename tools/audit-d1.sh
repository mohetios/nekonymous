#!/usr/bin/env bash
# Read-only D1 privacy / soul audit for Nekonymous V1.
#
# Usage:
#   ./tools/audit-d1.sh            # remote (production D1)
#   ./tools/audit-d1.sh --local    # local wrangler dev D1
#
# Also checks KV key count and Vectorize index size when remote.
# Requires: wrangler auth, node

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

WRANGLER=(pnpm exec wrangler)
DB_BINDING="DB"
KV_BINDING="NEKO_KV"
VECTOR_INDEX="nekonymous-profile-vectors"

print_json_table() {
  node -e "
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf8');
    const marker = raw.indexOf('[');
    if (marker < 0) {
      process.stdout.write(raw);
      process.exit(0);
    }
    let data;
    try {
      data = JSON.parse(raw.slice(marker));
    } catch {
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
    const marker = raw.indexOf('[');
    const data = JSON.parse(raw.slice(marker));
    const rows = data[0]?.results ?? [];
    const n = rows[0]?.fail_count ?? 0;
    process.stdout.write(String(n));
  "
}

echo "Nekonymous D1 privacy audit (${TARGET#--})"
echo "Database binding: ${DB_BINDING}"
echo

run_query "Migration status" \
  "SELECT name FROM d1_migrations ORDER BY applied_at;"

TABLES=(
  users
  public_links
  reports
  assessment_profiles
  assessment_attempts
  assessment_answers
  profile_vector_index_events
  match_requests
  match_suggestions
  match_blocks
  match_events
  platform_stats
)

echo ""
echo "==> Table row counts"
for table in "${TABLES[@]}"; do
  count="$("${WRANGLER[@]}" d1 execute "$DB_BINDING" "$TARGET" --command "SELECT COUNT(*) AS n FROM ${table};" 2>&1 | node -e "
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf8');
    const marker = raw.indexOf('[');
    const data = JSON.parse(raw.slice(marker));
    process.stdout.write(String(data[0]?.results?.[0]?.n ?? '?'));
  ")"
  printf "  %-32s %s\n" "$table" "$count"
done

run_query "Users (hash + encrypted chat id)" \
  "SELECT id, LENGTH(telegram_user_hash) AS hash_len, CASE WHEN telegram_user_hash GLOB '[0-9]*' THEN 'FAIL_numeric_hash' ELSE 'ok' END AS hash_check, CASE WHEN telegram_chat_ciphertext LIKE '{%' THEN 'ok_encrypted' ELSE 'FAIL_plain_chat' END AS chat_check, locale, status FROM users ORDER BY created_at LIMIT 20;"

run_query "Match requests (intro ciphertext)" \
  "SELECT id, status, CASE WHEN intro_ciphertext LIKE '{%' THEN 'ok_encrypted' ELSE 'FAIL_plain_intro' END AS intro_check FROM match_requests ORDER BY created_at DESC LIMIT 20;"

run_query "Reports (details ciphertext)" \
  "SELECT id, reason_code, CASE WHEN details_ciphertext IS NULL THEN 'none' WHEN details_ciphertext LIKE '{%' THEN 'ok_encrypted' ELSE 'FAIL_plain_details' END AS details_check FROM reports ORDER BY created_at DESC LIMIT 20;"

run_query "Assessment answers (Likert 1-5)" \
  "SELECT question_id, answer_value, CASE WHEN answer_value BETWEEN 1 AND 5 THEN 'ok' ELSE 'FAIL_invalid_likert' END AS answer_check FROM assessment_answers ORDER BY answered_at DESC LIMIT 10;"

run_query "Assessment profile summaries" \
  "SELECT user_id, discoverable, vector_status, LENGTH(profile_summary_text) AS summary_len, substr(profile_summary_text, 1, 80) AS summary_preview FROM assessment_profiles ORDER BY updated_at DESC LIMIT 10;"

run_query "Platform stats" \
  "SELECT * FROM platform_stats WHERE id = 1;"

run_query "Match events metadata preview" \
  "SELECT type, user_id, target_user_id, substr(metadata_json, 1, 160) AS metadata_preview FROM match_events ORDER BY created_at DESC LIMIT 20;"

echo ""
echo "==> Privacy failure counts"
USER_FAILS="$(count_failures "SELECT COUNT(*) AS fail_count FROM users WHERE telegram_user_hash GLOB '[0-9]*' OR telegram_chat_ciphertext NOT LIKE '{%';")"
INTRO_FAILS="$(count_failures "SELECT COUNT(*) AS fail_count FROM match_requests WHERE intro_ciphertext NOT LIKE '{%';")"
DETAIL_FAILS="$(count_failures "SELECT COUNT(*) AS fail_count FROM reports WHERE details_ciphertext IS NOT NULL AND details_ciphertext NOT LIKE '{%';")"
ANSWER_FAILS="$(count_failures "SELECT COUNT(*) AS fail_count FROM assessment_answers WHERE answer_value NOT BETWEEN 1 AND 5;")"
printf "  users privacy failures:              %s\n" "$USER_FAILS"
printf "  match intro plaintext failures:      %s\n" "$INTRO_FAILS"
printf "  report details plaintext failures:   %s\n" "$DETAIL_FAILS"
printf "  invalid assessment answers:          %s\n" "$ANSWER_FAILS"

if [[ "$TARGET" == "--remote" ]]; then
  echo ""
  echo "==> KV routing keys (binding ${KV_BINDING})"
  KV_JSON="$("${WRANGLER[@]}" kv key list --binding "$KV_BINDING" --remote 2>/dev/null || echo '[]')"
  KV_COUNT="$(node -e "const k=JSON.parse(process.argv[1]); console.log(Array.isArray(k)?k.length:0)" "$KV_JSON")"
  echo "  key count: ${KV_COUNT}"
  if [[ "$KV_COUNT" -gt 0 && "$KV_COUNT" -le 20 ]]; then
    echo "$KV_JSON" | node -e "
      const keys = JSON.parse(require('fs').readFileSync(0,'utf8'));
      for (const item of keys) console.log('  -', item.name);
    "
  fi

  echo ""
  echo "==> Vectorize index ${VECTOR_INDEX}"
  "${WRANGLER[@]}" vectorize info "$VECTOR_INDEX" 2>&1 | print_json_table || echo "  (vectorize info unavailable)"
fi

TOTAL_FAILS=$((USER_FAILS + INTRO_FAILS + DETAIL_FAILS + ANSWER_FAILS))
echo ""
if [[ "$TOTAL_FAILS" -gt 0 ]]; then
  echo "AUDIT RESULT: FAIL (${TOTAL_FAILS} privacy check failures)"
  exit 1
fi

echo "AUDIT RESULT: OK (no D1 privacy check failures)"
echo "Note: inbox ticket payloads live in UserStateDO and are not covered by this D1 audit."
