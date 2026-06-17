#!/usr/bin/env bash
# Destructive remote reset: D1 + KV + Vectorize, then re-apply schema and vector index.
#
# Usage:
#   ./tools/flush-remote.sh          # remote only
#   ./tools/flush-remote.sh --local  # also flush local D1/KV (vectorize is remote-only)
#
# Requires: wrangler auth (jq optional; node used as fallback)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCAL_TOO=false
if [[ "${1:-}" == "--local" ]]; then
  LOCAL_TOO=true
fi

WRANGLER=(npx wrangler)
DB_BINDING="DB"
KV_BINDING="NEKO_KV"
VECTOR_INDEX="nekonymous-profile-vectors"
VECTOR_DIM=768

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
    --metric=cosine \
    --description="Nekonymous profile embeddings (embeddinggemma-300m)"

  echo "==> Vectorize metadata indexes"
  "${WRANGLER[@]}" vectorize create-metadata-index "$VECTOR_INDEX" --propertyName=locale --type=string
  "${WRANGLER[@]}" vectorize create-metadata-index "$VECTOR_INDEX" --propertyName=discoverable --type=boolean
  "${WRANGLER[@]}" vectorize create-metadata-index "$VECTOR_INDEX" --propertyName=safetyTier --type=string
  "${WRANGLER[@]}" vectorize create-metadata-index "$VECTOR_INDEX" --propertyName=profileVersion --type=string
  "${WRANGLER[@]}" vectorize create-metadata-index "$VECTOR_INDEX" --propertyName=intentPrimary --type=string
  "${WRANGLER[@]}" vectorize create-metadata-index "$VECTOR_INDEX" --propertyName=profileBucket --type=number
}

echo "!!! DESTRUCTIVE REMOTE RESET for Nekonymous !!!"
echo "    D1: all tables dropped + migrations reapplied"
echo "    KV: all keys deleted"
echo "    Vectorize: index recreated empty"
echo

run_d1_flush --remote
run_kv_flush --remote
run_vectorize_recreate

if $LOCAL_TOO; then
  run_d1_flush --local
  run_kv_flush --local
fi

echo
echo "Remote flush complete."
echo "Users must /start again; Durable Object inbox state is NOT cleared by this script."
