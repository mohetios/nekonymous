#!/usr/bin/env bash
# Append the V2 DO delete migration to wrangler.jsonc (phase-2 deploy only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/wrangler.jsonc"

if grep -q 'v7-delete-durable-objects-v2' "$FILE"; then
  echo "v7 migration already present in wrangler.jsonc"
  exit 0
fi

python3 - <<'PY'
from pathlib import Path

path = Path("wrangler.jsonc")
text = path.read_text()
needle = '      ]\n    }\n  ],\n  "ai":'
insert = '''      ]
    },
    {
      // Destructive reset phase 4: delete V2 DO storage after V3 is live.
      "tag": "v7-delete-durable-objects-v2",
      "deleted_classes": [
        "UserStateDurableObjectV2",
        "TelegramOutboxDurableObjectV2",
        "TicketVaultDurableObjectV2",
        "ReportLedgerDurableObjectV2"
      ]
    }
  ],
  "ai":'''
if needle not in text:
    raise SystemExit("Could not find wrangler.jsonc insertion point for v7 migration")
path.write_text(text.replace(needle, insert, 1))
print("Added v7-delete-durable-objects-v2 to wrangler.jsonc")
PY
