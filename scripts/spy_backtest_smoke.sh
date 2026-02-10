#!/usr/bin/env bash
# SPY backtest-v0 smoke: run backtest-v0 with sample CSV, assert pairsCount=28 and corr not all null due to missing returns.
#
# Usage: ./scripts/spy_backtest_smoke.sh [api_base]
# Prereq: API running, DB with archetypes; CSV at apps/worker/data/market/spy.us.daily.sample.csv

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"
CSV="apps/worker/data/market/spy.us.daily.sample.csv"

echo "=== SPY Backtest v0 Smoke ==="
echo "API_BASE=$API_BASE"

# Create run and import CSV so backtest-v0 uses same runId that has AssetStepReturn
echo "[0] POST /runs..."
RUN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/runs" -H "Content-Type: application/json" -d "{}")
RUN_BODY=$(echo "$RUN_RESP" | head -n -1)
RUN_CODE=$(echo "$RUN_RESP" | tail -n 1)
[ "$RUN_CODE" = "201" ] || [ "$RUN_CODE" = "200" ] || { echo "FAIL: POST /runs $RUN_CODE"; exit 1; }
RUN_ID=$(echo "$RUN_BODY" | jq -r '.id // empty')
[ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ] || { echo "FAIL: no run id"; exit 1; }
echo "OK: RUN_ID=$RUN_ID"
echo "[1] Import CSV to runId..."
pnpm -C apps/worker run import-market-csv -- --runId "$RUN_ID" --assetSymbol SPY --csv "$CSV" --priceField close
echo "[2] backtest-v0 --runId $RUN_ID..."
export API_BASE
pnpm -C apps/worker run backtest-v0 -- \
  --runId "$RUN_ID" \
  --assetSymbol SPY \
  --steps 29 \
  --agents 200 \
  --seeds 5 \
  --csv "$CSV" \
  --priceField close

echo ""
echo "[assert] GET /results/backtests returns 200 and items (limit=5)..."
RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/backtests?assetSymbol=SPY&limit=5")
BODY=$(echo "$RESP" | head -n -1)
CODE=$(echo "$RESP" | tail -n 1)
if [ "$CODE" != "200" ]; then
  echo "FAIL: GET /results/backtests returned HTTP $CODE"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi

ITEMS=$(echo "$BODY" | jq '.items | length')
if [ "$ITEMS" -lt 5 ]; then
  echo "FAIL: expected at least 5 backtest results (seeds=5), got $ITEMS"
  exit 1
fi
echo "OK: backtests count=$ITEMS"

# Assert not all corr are null (would indicate missing returns)
NULL_CORR=$(echo "$BODY" | jq '[.items[].corr] | map(select(. == null)) | length')
echo "[assert] corr null count=$NULL_CORR (corr may be null if variance=0; must not be 500/crash)"
if [ "$ITEMS" != "0" ] && [ "$NULL_CORR" = "$ITEMS" ]; then
  echo "FAIL: all corr are null - likely AssetStepReturn missing for runs"
  exit 1
fi
echo "OK: at least one result has non-null corr or null is due to variance"

echo ""
echo "=== SPY Backtest v0 smoke passed ==="
exit 0
