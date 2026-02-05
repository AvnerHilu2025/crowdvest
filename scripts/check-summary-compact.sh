#!/usr/bin/env bash
# Curl-based check for GET /results/summary-compact?run_id=...
# Usage: ./scripts/check-summary-compact.sh [run_id] [api_base]
# Default api_base: http://localhost:4001
# If run_id omitted, uses latest run from GET /results/runs?limit=1

set -e
API_BASE="${2:-http://localhost:4001}"
RUN_ID="$1"

if [ -z "$RUN_ID" ]; then
  echo "No run_id given; fetching latest run from $API_BASE/results/runs?limit=1"
  RUNS_JSON=$(curl -sS "$API_BASE/results/runs?limit=1")
  RUN_ID=$(echo "$RUNS_JSON" | jq -r '.items[0].id // empty')
  if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
    echo "No runs found. Run a simulation first (e.g. pnpm --filter worker sim:run -- --name ci --agents 10 --steps 5)."
    exit 1
  fi
  echo "Using run_id: $RUN_ID"
fi

URL="$API_BASE/results/summary-compact?run_id=$RUN_ID"
echo "GET $URL"
RESP=$(curl -sS -w "\n%{http_code}" "$URL")
HTTP_BODY=$(echo "$RESP" | head -n -1)
HTTP_CODE=$(echo "$RESP" | tail -n 1)

if [ "$HTTP_CODE" != "200" ]; then
  echo "HTTP $HTTP_CODE"
  echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"
  exit 1
fi

echo "$HTTP_BODY" | jq .
echo "---"
echo "Compact summary OK (run_id=$RUN_ID)"
