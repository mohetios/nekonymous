#!/usr/bin/env bash
# Destructive remote reset: Durable Object generation deploy + D1 + KV + Vectorize.
#
# Usage:
#   ./tools/flush-remote.sh          # remote only
#   ./tools/flush-remote.sh --local  # also flush local D1/KV (vectorize is remote-only)
#
# Requires: wrangler auth and V4/V2 reset migrations (v9 + v10) in wrangler.jsonc.
# D1 schema is a single squashed migration: migrations/0001_init.sql

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCAL_TOO=false
if [[ "${1:-}" == "--local" ]]; then
  LOCAL_TOO=true
fi

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
    "v10-delete-durable-objects-v3-and-vault-v1" "$config"
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
echo "    Durable Objects: two deploys (V4/V2 vault create, then V3/V1 delete)"
echo "    D1: all tables dropped + single migration (0001_init.sql) reapplied"
echo "    KV: all keys deleted"
echo "    Vectorize: index recreated empty"
echo

require_do_reset_migrations
run_vectorize_recreate
run_phase1_deploy
run_d1_flush --remote
run_kv_flush --remote
run_worker_deploy "phase 2 — delete V3 core + V1 vault durable object storage"

if $LOCAL_TOO; then
  run_d1_flush --local
  run_kv_flush --local
fi

echo
echo "Remote flush complete."
echo "Users must /start again."
echo "Note: future DO wipes require a new class generation and delete migration pair."
