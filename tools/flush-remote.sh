#!/usr/bin/env bash
# Destructive reset for public-release data resources.
#
# Usage:
#   ./tools/flush-remote.sh
#   ./tools/flush-remote.sh --local
#
# This drops D1 tables, clears KV keys, and recreates the Vectorize index.
# Durable Object data is reset by deploying the unversioned public-release
# classes in wrangler.jsonc.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCAL_TOO=false
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL_TOO=true ;;
    *)
      echo "Usage: $0 [--local]" >&2
      exit 1
      ;;
  esac
done

WRANGLER=(pnpm exec wrangler)
DB_BINDING="DB"
KV_BINDING="NEKO_KV"
VECTOR_INDEX="nekonymous-conversation"
VECTOR_DIM=32

run_d1_flush() {
  local target="$1"
  echo "==> D1 flush ${target}"
  "${WRANGLER[@]}" d1 execute "$DB_BINDING" "$target" --yes --file=tools/flush-remote-d1.sql
  echo "==> D1 migrations apply ${target}"
  "${WRANGLER[@]}" d1 migrations apply "$DB_BINDING" "$target"
}

run_kv_flush() {
  local target="$1"
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
  "${WRANGLER[@]}" kv bulk delete "$delete_file" --force --binding "$KV_BINDING" "$target"
  rm -f "$keys_file" "$delete_file"
  echo "    deleted ${count} keys"
}

run_vectorize_recreate() {
  echo "==> Vectorize delete ${VECTOR_INDEX} (if exists)"
  if "${WRANGLER[@]}" vectorize get "$VECTOR_INDEX" >/dev/null 2>&1; then
    "${WRANGLER[@]}" vectorize delete "$VECTOR_INDEX" --force
  else
    echo "    (index not found, skipping delete)"
  fi

  echo "==> Vectorize create ${VECTOR_INDEX}"
  "${WRANGLER[@]}" vectorize create "$VECTOR_INDEX" \
    --dimensions="$VECTOR_DIM" \
    --metric=euclidean \
    --description="Nekonymous conversation profile retrieval (8-d coarse vectors)"
}

echo "!!! DESTRUCTIVE RESET for Nekonymous public-release resources !!!"
echo "    D1: all public-release tables dropped + migration reapplied"
echo "    KV: all keys deleted"
echo "    Vectorize: index recreated empty"
echo

run_vectorize_recreate
run_d1_flush --remote
run_kv_flush --remote

if $LOCAL_TOO; then
  run_d1_flush --local
  run_kv_flush --local
fi

echo
echo "Resource reset complete."
echo "Deploy the Worker after this so Durable Objects use the public-release classes."
