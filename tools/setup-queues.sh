#!/usr/bin/env bash
# Idempotent Cloudflare Queue setup for Nekonymous.
#
# Creates primary queues and per-consumer dead-letter queues when missing.
# Safe to re-run. Requires wrangler auth.
#
# Usage:
#   ./tools/setup-queues.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WRANGLER=(wrangler)

QUEUES=(
  neko-outbox
  neko-outbox-dlq
  neko-stats
  neko-stats-dlq
  neko-profile-index
  neko-profile-index-dlq
)

queue_exists() {
  local name="$1"
  wrangler queues list 2>/dev/null | rg -q "│ ${name} "
}

echo "Nekonymous queue setup"
echo

for queue in "${QUEUES[@]}"; do
  if queue_exists "$queue"; then
    echo "==> Queue ${queue}: already exists"
  else
    echo "==> Queue create ${queue}"
    "${WRANGLER[@]}" queues create "$queue"
  fi
done

echo
echo "Setup complete."
echo "Producer bindings in wrangler.jsonc:"
echo "  NEKO_OUTBOX_QUEUE        -> neko-outbox"
echo "  NEKO_STATS_QUEUE         -> neko-stats"
echo "  NEKO_PROFILE_INDEX_QUEUE -> neko-profile-index"
echo
echo "Dead-letter targets:"
echo "  neko-outbox        -> neko-outbox-dlq"
echo "  neko-stats         -> neko-stats-dlq"
echo "  neko-profile-index -> neko-profile-index-dlq"
echo
echo "Removed shared queue neko-dlq is no longer used."
