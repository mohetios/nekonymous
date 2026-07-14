#!/usr/bin/env bash
# Destructive remote reset: D1 + KV + Vectorize, with optional DO generation deploy.
#
# Usage:
#   ./tools/flush-remote.sh                 # data wipe only (safe to repeat)
#   ./tools/flush-remote.sh --full-do-reset # one-shot DO generation reset (v9/v10/v11)
#   ./tools/flush-remote.sh --local         # also flush local D1/KV
#
# Data-only mode drops D1 tables, reapplies migrations/0001_init.sql, clears KV,
# and recreates the Vectorize index. Durable Object storage is NOT wiped unless
# --full-do-reset is used and a fresh create/delete migration pair is pending.
#
# DO generation reset is one-shot per migration pair. After v9/v10/v11 are applied,
# repeat DO wipes require a new vN-create / vN-delete pair in wrangler.jsonc.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCAL_TOO=false
FULL_DO_RESET=false
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL_TOO=true ;;
    --full-do-reset) FULL_DO_RESET=true ;;
    *)
      echo "Usage: $0 [--local] [--full-do-reset]" >&2
      exit 1
      ;;
  esac
done

WRANGLER=(wrangler)
DB_BINDING="DB"
KV_BINDING="NEKO_KV"
VECTOR_INDEX="nekonymous-conversation-v2"
VECTOR_DIM=32

require_do_reset_migrations() {
  if ! rg -q '"tag": "v9-create-reset-durable-objects-v4"' wrangler.jsonc; then
    echo "Missing v9 migration tag in wrangler.jsonc" >&2
    exit 1
  fi
  if ! rg -q '"tag": "v10-delete-durable-objects-v3-and-vault-v1"' wrangler.jsonc; then
    echo "Missing v10 migration tag in wrangler.jsonc" >&2
    exit 1
  fi
}

run_worker_deploy() {
  local label="$1"
  local config="${2:-wrangler.jsonc}"
  echo "==> Worker deploy (${label})"
  "${WRANGLER[@]}" deploy --minify --config "$config"
}

run_phase1_deploy() {
  local config="${ROOT}/.wrangler-flush-phase1.json"
  node --experimental-strip-types tools/wrangler-config-without-migration.ts \
    "$config" \
    "v10-delete-durable-objects-v3-and-vault-v1" \
    "v11-safety-state-replace-report-ledger-v4"
  run_worker_deploy "phase 1 — bind V4 core + V2 vault durable objects" "$config"
  rm -f "$config"
}

run_d1_flush() {
  local target="$1" # --remote or --local
  echo "==> D1 flush ${target}"
  "${WRANGLER[@]}" d1 execute "$DB_BINDING" "$target" --file=tools/flush-remote-d1.sql
  echo "==> D1 migrations apply ${target}"
  "${WRANGLER[@]}" d1 migrations apply "$DB_BINDING" "$target"
}

run_kv_flush() {
  local target="$1" # --remote or --local
  echo "==> KV flush ${target}"
  local keys_file delete_file count
  keys_file="$(mktemp)"
  delete_file="$(mktemp)"
  "${WRANGLER[@]}" kv key list --binding "$KV_BINDING" "$target" > "$keys_file"
  count="$(node -e "
    const fs = require('fs');
    const keys = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const names = keys.map((k) => k.name).filter(Boolean);
    fs.writeFileSync(process.argv[2], JSON.stringify(names));
    process.stdout.write(String(names.length));
  " "$keys_file" "$delete_file")"
  if [[ "$count" -eq 0 ]]; then
    echo "    (no keys)"
    rm -f "$keys_file" "$delete_file"
    return
  fi
  "${WRANGLER[@]}" kv bulk delete "$delete_file" --binding "$KV_BINDING" "$target"
  rm -f "$keys_file" "$delete_file"
  echo "    deleted ${count} keys"
}

run_vectorize_recreate() {
  echo "==> Vectorize delete ${VECTOR_INDEX} (if exists)"
  if "${WRANGLER[@]}" vectorize get "$VECTOR_INDEX" >/dev/null 2>&1; then
    "${WRANGLER[@]}" vectorize delete "$VECTOR_INDEX"
  else
    echo "    (index not found, skipping delete)"
  fi

  echo "==> Vectorize create ${VECTOR_INDEX}"
  "${WRANGLER[@]}" vectorize create "$VECTOR_INDEX" \
    --dimensions="$VECTOR_DIM" \
    --metric=euclidean \
    --description="Nekonymous conversation profile retrieval (8-d coarse vectors)"
}

echo "!!! DESTRUCTIVE REMOTE RESET for Nekonymous !!!"
if $FULL_DO_RESET; then
  echo "    Mode: full DO generation reset + data wipe"
  echo "    Durable Objects: two deploys (V4/V2 create, then V3/V1 delete)"
else
  echo "    Mode: data wipe only (D1 + KV + Vectorize)"
  echo "    Durable Objects: skipped (use --full-do-reset only with a new migration pair)"
fi
echo "    D1: all tables dropped + single migration (0001_init.sql) reapplied"
echo "    KV: all keys deleted"
echo "    Vectorize: index recreated empty"
echo

run_vectorize_recreate
run_d1_flush --remote
run_kv_flush --remote

if $FULL_DO_RESET; then
  require_do_reset_migrations
  run_phase1_deploy
  run_worker_deploy "phase 2 — delete V3 core + V1 vault durable object storage"
fi

if $LOCAL_TOO; then
  run_d1_flush --local
  run_kv_flush --local
fi

echo
echo "Remote flush complete."
echo "Users must /start again."
if ! $FULL_DO_RESET; then
  echo "Note: Durable Object data was not reset. Add a new create/delete migration pair for another DO wipe."
fi
