#!/usr/bin/env bash
# Smoke test for GET /leaderboard endpoints.
# Usage: ./scripts/check-leaderboard.sh [api_base]
# API_BASE defaults to http://localhost:4001

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "Checking leaderboard API at $API_BASE"

# GET /leaderboard?by=wallet returns 200, array
WALLET_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/leaderboard?by=wallet&limit=20")
WALLET_CODE=$(echo "$WALLET_RESP" | tail -n 1)
WALLET_BODY=$(echo "$WALLET_RESP" | head -n -1)
if [ "$WALLET_CODE" != "200" ]; then
  echo "FAIL: GET /leaderboard?by=wallet returned HTTP $WALLET_CODE"
  echo "$WALLET_BODY" | jq . 2>/dev/null || echo "$WALLET_BODY"
  exit 1
fi
if ! echo "$WALLET_BODY" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "FAIL: GET /leaderboard?by=wallet response is not an array"
  echo "$WALLET_BODY" | jq .
  exit 1
fi
echo "OK: GET /leaderboard?by=wallet returns 200 with array"

# GET /leaderboard?by=accuracy returns 200, array
ACC_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/leaderboard?by=accuracy&limit=20")
ACC_CODE=$(echo "$ACC_RESP" | tail -n 1)
ACC_BODY=$(echo "$ACC_RESP" | head -n -1)
if [ "$ACC_CODE" != "200" ]; then
  echo "FAIL: GET /leaderboard?by=accuracy returned HTTP $ACC_CODE"
  echo "$ACC_BODY" | jq . 2>/dev/null || echo "$ACC_BODY"
  exit 1
fi
if ! echo "$ACC_BODY" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "FAIL: GET /leaderboard?by=accuracy response is not an array"
  echo "$ACC_BODY" | jq .
  exit 1
fi
echo "OK: GET /leaderboard?by=accuracy returns 200 with array"

echo "---"
echo "PASS: leaderboard API checks"
