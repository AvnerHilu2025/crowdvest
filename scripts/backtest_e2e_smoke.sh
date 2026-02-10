#!/usr/bin/env bash
# Backtest E2E stability gate: create run, import CSV, run backtest-v0 with --runId; assert at least one BacktestResult
# for this runId+assetSymbol with pairsCount=steps-1, corr and directionalAccuracy non-null.
# On failure: print diagnostics (AssetStepReturn count, CrowdMetrics count, steps used vs derived, last steps).
#
# Usage: ./scripts/backtest_e2e_smoke.sh [api_base]
# Prereq: API running, DB with archetypes; CSV at apps/worker/data/market/spy.us.daily.sample.csv

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"
STEPS=29
ASSET=SPY
EXPECTED_PAIRS=$((STEPS - 1))  # 28
CSV_PATH="apps/worker/data/market/spy.us.daily.sample.csv"

echo "=== Backtest E2E Smoke (stability gate) ==="
echo "API_BASE=$API_BASE STEPS=$STEPS EXPECTED_PAIRS=$EXPECTED_PAIRS"

# 1) Create run
echo "[1] POST /runs..."
RUN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/runs" -H "Content-Type: application/json" -d "{}")
RUN_BODY=$(echo "$RUN_RESP" | head -n -1)
RUN_CODE=$(echo "$RUN_RESP" | tail -n 1)
[ "$RUN_CODE" = "201" ] || [ "$RUN_CODE" = "200" ] || { echo "FAIL: POST /runs $RUN_CODE"; exit 1; }
RUN_ID=$(echo "$RUN_BODY" | jq -r '.id // empty')
[ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ] || { echo "FAIL: no run id"; exit 1; }
echo "OK: RUN_ID=$RUN_ID"

# 2) Import CSV
echo "[2] Import CSV to runId=$RUN_ID..."
pnpm -C apps/worker run import-market-csv -- --runId "$RUN_ID" --assetSymbol "$ASSET" --csv "$CSV_PATH" --priceField close
echo "OK: import done"

# 3) Backtest with --runId
echo "[3] backtest-v0 --runId $RUN_ID ..."
export API_BASE
pnpm -C apps/worker run backtest-v0 -- \
  --runId "$RUN_ID" \
  --assetSymbol "$ASSET" \
  --steps "$STEPS" \
  --agents 200 \
  --seeds 5 \
  --csv "$CSV_PATH" \
  --priceField close
echo "OK: backtest-v0 done"

# 4) GET /results/backtests and find our run's results
echo "[4] GET /results/backtests?assetSymbol=$ASSET&limit=20..."
RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/backtests?assetSymbol=$ASSET&limit=20")
BODY=$(echo "$RESP" | head -n -1)
CODE=$(echo "$RESP" | tail -n 1)
[ "$CODE" = "200" ] || { echo "FAIL: backtests HTTP $CODE"; echo "$BODY" | jq . 2>/dev/null || echo "$BODY"; exit 1; }

# Filter items for this runId and assetSymbol
OUR_ITEMS=$(echo "$BODY" | jq --arg runId "$RUN_ID" --arg sym "$ASSET" '[.items[] | select(.runId == $runId and .assetSymbol == $sym)]')
NUM_OUR=$(echo "$OUR_ITEMS" | jq 'length')
if [ "$NUM_OUR" = "0" ]; then
  echo "FAIL: No BacktestResult with runId=$RUN_ID assetSymbol=$ASSET"
  echo "Diagnostics: GET /runs/$RUN_ID/summary?assetSymbol=$ASSET"
  SUMMARY=$(curl -sS "$API_BASE/runs/$RUN_ID/summary?assetSymbol=$ASSET" 2>/dev/null) || SUMMARY=""
  echo "$SUMMARY" | jq . 2>/dev/null || echo "$SUMMARY"
  exit 1
fi

# Find one with pairsCount == EXPECTED_PAIRS, corr != null, directionalAccuracy != null
VALID=$(echo "$OUR_ITEMS" | jq --argjson expected "$EXPECTED_PAIRS" '[.[] | select(.pairsCount == $expected and .corr != null and .directionalAccuracy != null)] | .[0]')
if [ "$VALID" = "null" ] || [ -z "$VALID" ]; then
  echo "FAIL: No BacktestResult for runId=$RUN_ID with pairsCount=$EXPECTED_PAIRS and corr/directionalAccuracy non-null"
  echo ""
  echo "--- Diagnostics ---"
  echo "Our BacktestResult(s) for runId=$RUN_ID assetSymbol=$ASSET:"
  echo "$OUR_ITEMS" | jq '.[] | {seed, steps, pairsCount, corr, directionalAccuracy}'
  echo ""
  SUMMARY=$(curl -sS "$API_BASE/runs/$RUN_ID/summary?assetSymbol=$ASSET" 2>/dev/null) || true
  if [ -n "$SUMMARY" ]; then
    echo "Run summary (counts and latest):"
    echo "$SUMMARY" | jq '{
      assetStepReturnRows: .counts.assetStepReturnRows,
      crowdMetricsRows: .counts.crowdMetricsRows,
      steps_derived_from_AssetStepReturn: .counts.steps,
      last_CrowdMetrics_step: .latest.step,
      last_AssetStepReturn_step: (if .counts.steps > 0 then .counts.steps - 1 else null end),
      latest_backtest: .latest.backtest
    }'
  else
    echo "Could not fetch run summary (endpoint failed or not implemented)"
  fi
  exit 1
fi

echo "OK: Found valid BacktestResult runId=$RUN_ID pairsCount=$EXPECTED_PAIRS corr and directionalAccuracy non-null"
echo ""
echo "=== Backtest E2E smoke passed ==="
exit 0
