#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

API="${API:-http://localhost:4001}"
ASSET="${ASSET:-SPY}"

if [[ -z "${RUN_ID:-}" ]]; then
  echo "ERROR: RUN_ID is required. Example:"
  echo '  RUN_ID="..." ./scripts/test-crowd-wisdom-check.sh'
  exit 2
fi

echo "Running CrowdWisdom sanity check..."
echo "API=$API  ASSET=$ASSET  RUN_ID=$RUN_ID"

API="$API" ASSET="$ASSET" RUN_ID="$RUN_ID" node scripts/crowd-wisdom-check.mjs
echo "PASS: crowd-wisdom-check"
