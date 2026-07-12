#!/usr/bin/env bash
# Idempotent Cloudflare resource setup for Conversation Suggestions V2.
#
# Creates Vectorize index and profile-index queues when missing. Safe to re-run.
# Requires: wrangler auth, project wrangler.jsonc bindings.
#
# Usage:
#   ./tools/setup-conversation-v2-resources.sh
#   ./tools/setup-conversation-v2-resources.sh --remote-only

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WRANGLER=(pnpm exec wrangler)
VECTOR_INDEX="nekonymous-conversation-v2"
VECTOR_DIM=32
VECTOR_METRIC="euclidean"
PROFILE_INDEX_QUEUE="neko-profile-index"
PROFILE_INDEX_DLQ="neko-profile-index-dlq"

queue_exists() {
  local name="$1"
  "${WRANGLER[@]}" queues list 2>/dev/null | rg -q "\"${name}\""
}

vector_exists() {
  "${WRANGLER[@]}" vectorize get "$VECTOR_INDEX" >/dev/null 2>&1
}

echo "Nekonymous Conversation V2 resource setup"
echo

if vector_exists; then
  echo "==> Vectorize ${VECTOR_INDEX}: already exists"
else
  echo "==> Vectorize create ${VECTOR_INDEX}"
  "${WRANGLER[@]}" vectorize create "$VECTOR_INDEX" \
    --dimensions="$VECTOR_DIM" \
    --metric="$VECTOR_METRIC" \
    --description="Nekonymous conversation profile retrieval (8-d coarse vectors)"
fi

for queue in "$PROFILE_INDEX_QUEUE" "$PROFILE_INDEX_DLQ"; do
  if queue_exists "$queue"; then
    echo "==> Queue ${queue}: already exists"
  else
    echo "==> Queue create ${queue}"
    "${WRANGLER[@]}" queues create "$queue"
  fi
done

echo
echo "Setup complete."
echo "Bindings expected in wrangler.jsonc:"
echo "  CONVERSATION_VECTORS -> ${VECTOR_INDEX}"
echo "  NEKO_PROFILE_INDEX_QUEUE -> ${PROFILE_INDEX_QUEUE}"
echo "  dead_letter_queue for profile index -> ${PROFILE_INDEX_DLQ}"
echo "  PROFILE_VAULT_DO / CONVERSATION_VAULT_DO / PAIR_LEDGER_DO"
echo
echo "For all Worker queues, also run: ./tools/setup-queues.sh"
echo
echo "Deploy DO migration tag v8-conversation-v2-vault-shards before using vault shards."
