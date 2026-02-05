#!/usr/bin/env bash
# Lightweight curl checks for GET /runs/latest, GET /runs/:id, GET /runs.
# Usage: ./scripts/check-runs-api.sh [api_base]
# API_BASE defaults to http://localhost:4001

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "Checking runs API at $API_BASE"

# 1) GET /runs/latest returns 200, includes runId, prePersistHistogram, persistedHistogram (objects with BUY/SELL/HOLD/OTHER)
LATEST_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/runs/latest")
LATEST_BODY=$(echo "$LATEST_RESP" | head -n -1)
LATEST_CODE=$(echo "$LATEST_RESP" | tail -n 1)
if [ "$LATEST_CODE" != "200" ]; then
  echo "FAIL: GET /runs/latest returned HTTP $LATEST_CODE"
  echo "$LATEST_BODY" | jq . 2>/dev/null || echo "$LATEST_BODY"
  exit 1
fi
RUN_ID=$(echo "$LATEST_BODY" | jq -r '.runId // empty')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: GET /runs/latest response missing runId"
  echo "$LATEST_BODY" | jq .
  exit 1
fi
for key in prePersistHistogram persistedHistogram; do
  VAL=$(echo "$LATEST_BODY" | jq -r ".$key // empty")
  if [ -z "$VAL" ] || [ "$VAL" = "null" ]; then
    echo "FAIL: GET /runs/latest response missing $key"
    exit 1
  fi
  for hkey in BUY SELL HOLD OTHER; do
    if ! echo "$LATEST_BODY" | jq -e ".$key.$hkey != null" >/dev/null 2>&1; then
      echo "FAIL: GET /runs/latest $key missing $hkey"
      exit 1
    fi
  done
done
echo "OK: GET /runs/latest returns 200 with runId, prePersistHistogram, persistedHistogram"

# 2) GET /runs/latest?debug=1 includes debug
DEBUG_BODY=$(curl -sS "$API_BASE/runs/latest?debug=1")
if ! echo "$DEBUG_BODY" | jq -e '.debug != null' >/dev/null 2>&1; then
  echo "FAIL: GET /runs/latest?debug=1 missing debug"
  exit 1
fi
echo "OK: GET /runs/latest?debug=1 includes debug"

# 3) GET /runs/<runId> returns 200
BY_ID_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/runs/$RUN_ID")
BY_ID_CODE=$(echo "$BY_ID_RESP" | tail -n 1)
if [ "$BY_ID_CODE" != "200" ]; then
  echo "FAIL: GET /runs/$RUN_ID returned HTTP $BY_ID_CODE"
  echo "$BY_ID_RESP" | head -n -1 | jq . 2>/dev/null || echo "$BY_ID_RESP"
  exit 1
fi
echo "OK: GET /runs/$RUN_ID returns 200"

# 4) GET /runs?limit=5 does NOT include configJson
LIST_BODY=$(curl -sS "$API_BASE/runs?limit=5")
if echo "$LIST_BODY" | jq -e '(.items[0] // {}) | has("configJson")' >/dev/null 2>&1; then
  echo "FAIL: GET /runs?limit=5 items include configJson (should not)"
  exit 1
fi
echo "OK: GET /runs?limit=5 does not include configJson"

echo "---"
echo "PASS: runs API checks"
