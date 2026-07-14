#!/usr/bin/env bash
# Read-only source/schema audit for sealed-ticket storage rules.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=(src migrations wrangler.jsonc package.json)
PATTERNS=(
  'recipient_id.*ticket'
  'sender_id.*ticket'
  'ticket_ref'
  'message_body'
  'anonymous_messages'
  'report.*sender_id'
  'report.*recipient_id'
  'callback_data.*user'
  'encryptMatchIntro'
  'InboxNotificationCycle'
  'claimUnreadBatch'
  'markTicketBlocked'
  'REPORT_LEDGER'
)

echo "Nekonymous sealed ticket storage audit"
echo

failed=0
for pattern in "${PATTERNS[@]}"; do
  if rg -n -i "$pattern" "${TARGETS[@]}" >/tmp/nekonymous-ticket-audit.txt; then
    echo "FAIL pattern: $pattern"
    cat /tmp/nekonymous-ticket-audit.txt
    echo
    failed=1
  fi
done

rm -f /tmp/nekonymous-ticket-audit.txt

if [[ "$failed" -ne 0 ]]; then
  echo "AUDIT RESULT: FAIL"
  exit 1
fi

echo "AUDIT RESULT: OK"
