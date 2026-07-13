#!/usr/bin/env bash
# Read-only D1 privacy audit for Nekonymous.
#
# Usage:
#   ./tools/audit-d1.sh                  # local migration/schema audit only
#   ./tools/audit-d1.sh --remote         # opt-in remote D1 data audit
#   NEKO_AUDIT_D1_REMOTE=1 ./tools/audit-d1.sh
#
# The default check is deterministic and never queries production.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="local"
if [[ "${1:-}" == "--remote" || "${NEKO_AUDIT_D1_REMOTE:-}" == "1" ]]; then
  MODE="remote"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--remote]" >&2
  exit 1
fi

DB_BINDING="DB"
KV_BINDING="NEKO_KV"
MIGRATIONS_DIR="migrations"
REMOTE_TIMEOUT_SECONDS="${NEKO_AUDIT_D1_TIMEOUT_SECONDS:-20}"

FORBIDDEN_TABLES=(
  assessment_profiles
  assessment_attempts
  assessment_answers
  profile_vector_index_events
  match_requests
  match_suggestions
  match_blocks
  match_events
  requester_user_id
  candidate_user_id
  profile_summary_text
  dimension_scores_json
)

ALLOWED_TABLES=(
  users
  public_links
  platform_daily_stats
  platform_daily_stats_by_key
  platform_daily_unique_stats
)

schema_source() {
  find "$MIGRATIONS_DIR" -type f -name "*.sql" -print0 |
    sort -z |
    xargs -0 cat
}

run_local_audit() {
  echo "Nekonymous D1 privacy audit (local migrations)"
  echo "Migrations dir: ${MIGRATIONS_DIR}"
  echo

  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    echo "AUDIT RESULT: FAIL (${MIGRATIONS_DIR} missing)"
    exit 1
  fi

  local schema
  schema="$(schema_source)"
  local failures=0

  echo "==> Forbidden D1 schema token check"
  for token in "${FORBIDDEN_TABLES[@]}"; do
    if grep -Eiq "(^|[^a-zA-Z0-9_])${token}([^a-zA-Z0-9_]|$)" <<<"$schema"; then
      echo "  FAIL forbidden D1 token present: ${token}"
      failures=$((failures + 1))
    else
      echo "  ok  ${token} absent"
    fi
  done

  echo
  echo "==> Required D1 table check"
  for table in "${ALLOWED_TABLES[@]}"; do
    if grep -Eiq "CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?${table}([^a-zA-Z0-9_]|$)" <<<"$schema"; then
      echo "  ok  ${table} declared"
    else
      echo "  FAIL required table missing: ${table}"
      failures=$((failures + 1))
    fi
  done

  echo
  if [[ "$failures" -gt 0 ]]; then
    echo "AUDIT RESULT: FAIL (${failures} schema check failures)"
    exit 1
  fi

  echo "AUDIT RESULT: OK (local D1 migrations only; no forbidden tables)"
  echo "Note: profiles, suggestions, and sealed tickets live in Durable Objects, not D1."
}

json_results_table() {
  node -e "
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf8');
    let data;
    for (let index = raw.indexOf('['); index >= 0; index = raw.indexOf('[', index + 1)) {
      try {
        data = JSON.parse(raw.slice(index));
        break;
      } catch {}
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

run_remote_wranger() {
  timeout "$REMOTE_TIMEOUT_SECONDS" wrangler "$@"
}

run_remote_query() {
  local title="$1"
  local sql="$2"
  echo
  echo "==> ${title}"
  if ! run_remote_wranger d1 execute "$DB_BINDING" --remote --command "$sql" 2>&1 | json_results_table; then
    echo "AUDIT RESULT: FAIL (remote query failed or timed out: ${title})"
    exit 1
  fi
}

remote_count() {
  local sql="$1"
  run_remote_wranger d1 execute "$DB_BINDING" --remote --command "$sql" 2>&1 | node -e "
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
  "
}

run_remote_audit() {
  echo "Nekonymous D1 privacy audit (remote opt-in)"
  echo "Database binding: ${DB_BINDING}"
  echo "Remote timeout: ${REMOTE_TIMEOUT_SECONDS}s per command"

  run_remote_query "Migration status" \
    "SELECT name FROM d1_migrations ORDER BY applied_at;"

  local failures=0
  echo
  echo "==> Forbidden D1 table check"
  for table in "${FORBIDDEN_TABLES[@]}"; do
    local exists
    if ! exists="$(remote_count "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '${table}';")"; then
      echo "AUDIT RESULT: FAIL (remote table check failed or timed out)"
      exit 1
    fi
    if [[ "$exists" != "0" ]]; then
      echo "  FAIL forbidden table present: ${table}"
      failures=$((failures + 1))
    else
      echo "  ok  ${table} absent"
    fi
  done

  run_remote_query "Users privacy sample" \
    "SELECT id, LENGTH(telegram_user_hash) AS hash_len, CASE WHEN telegram_chat_ciphertext LIKE '{%' THEN 'ok_encrypted' ELSE 'FAIL_plain_chat' END AS chat_check, locale, status FROM users ORDER BY created_at LIMIT 20;"

  echo
  echo "==> KV routing keys (binding ${KV_BINDING})"
  if ! timeout "$REMOTE_TIMEOUT_SECONDS" wrangler kv key list --binding "$KV_BINDING" --remote >/dev/null; then
    echo "  skipped/failed: KV remote list failed or timed out"
  else
    echo "  ok remote KV list completed"
  fi

  echo
  if [[ "$failures" -gt 0 ]]; then
    echo "AUDIT RESULT: FAIL (${failures} remote schema failures)"
    exit 1
  fi

  echo "AUDIT RESULT: OK (remote opt-in)"
}

if [[ "$MODE" == "remote" ]]; then
  run_remote_audit
else
  run_local_audit
fi
