#!/usr/bin/env bash
# Lightweight web smoke check: verify /runs and /runs/[id] return 200.
# Usage: ./scripts/web_smoke_check.sh   or   pnpm verify:web
# WEB_BASE defaults to http://localhost:4000, API_BASE to http://localhost:4001

set -euo pipefail
WEB_BASE="${WEB_BASE:-http://localhost:4000}"
API_BASE="${API_BASE:-http://localhost:4001}"

echo "Web smoke check: WEB_BASE=$WEB_BASE API_BASE=$API_BASE"

# 1) /runs returns 200
CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_BASE/runs")
if [ "$CODE" != "200" ]; then
  echo "FAIL: $WEB_BASE/runs returned HTTP $CODE"
  exit 1
fi
echo "PASS: $WEB_BASE/runs returns 200"

# 2) Fetch latest run id from API
RUNS_JSON=$(curl -sS "$API_BASE/results/runs?limit=1")
RUN_ID=$(echo "$RUNS_JSON" | jq -r '.items[0].id // empty')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: no runs in $API_BASE/results/runs"
  exit 1
fi
echo "PASS: latest run_id=$RUN_ID"

# 3) /runs/<RUN_ID> returns 200
CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_BASE/runs/$RUN_ID")
if [ "$CODE" != "200" ]; then
  echo "FAIL: $WEB_BASE/runs/$RUN_ID returned HTTP $CODE"
  exit 1
fi
echo "PASS: $WEB_BASE/runs/$RUN_ID returns 200"

echo "---"
echo "All checks PASSED"
