#!/usr/bin/env bash
# Idempotent Cloudflare Vectorize setup for Conversation Suggestions V2.
#
# Creates the conversation profile Vectorize index when missing. Safe to re-run.
# Requires: wrangler auth, project wrangler.jsonc bindings.
#
# Usage:
#   ./tools/setup-conversation-v2-resources.sh
#
# Queue setup lives in ./tools/setup-queues.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WRANGLER=(pnpm exec wrangler)
VECTOR_INDEX="nekonymous-conversation-v2"
VECTOR_DIM=32
VECTOR_METRIC="euclidean"

vector_exists() {
  "${WRANGLER[@]}" vectorize get "$VECTOR_INDEX" >/dev/null 2>&1
}

echo "Nekonymous Conversation V2 vector setup"
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

echo
echo "Setup complete."
echo "Bindings expected in wrangler.jsonc:"
echo "  CONVERSATION_VECTORS -> ${VECTOR_INDEX}"
echo "  NEKO_PROFILE_INDEX_QUEUE -> neko-profile-index"
echo "  PROFILE_VAULT_DO / CONVERSATION_VAULT_DO / PAIR_LEDGER_DO"
echo
echo "For all Worker queues, run: ./tools/setup-queues.sh"
