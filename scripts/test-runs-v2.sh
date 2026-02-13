#!/usr/bin/env bash
set -e

API="${API_URL:-http://localhost:4001}"
RESP=$(curl -s "${API}/results/runs-v2?limit=3")

ITEMS_LEN=$(echo "$RESP" | jq -r '.items | length')
STATUS=$(echo "$RESP" | jq -r '.items[0].status // empty')

VALID_STATUS=0
case "$STATUS" in
  PENDING|RUNNING|COMPLETED|FAILED) VALID_STATUS=1 ;;
esac

if [[ "$ITEMS_LEN" -gt 0 && "$VALID_STATUS" -eq 1 ]]; then
  echo -e "\033[0;32mPASS\033[0m"
  exit 0
else
  echo -e "\033[0;31mFAIL\033[0m"
  echo "items length: $ITEMS_LEN (expected > 0)"
  echo "items[0].status: '$STATUS' (expected PENDING|RUNNING|COMPLETED|FAILED)"
  exit 1
fi
