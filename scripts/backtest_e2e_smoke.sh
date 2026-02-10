#!/usr/bin/env bash
# Backtest E2E smoke: run backtest-v0 with --csv, then assert /results/backtests returns 200.
# Delegates to spy_backtest_smoke.sh which runs backtest-v0 and asserts API and corr.
# Usage: ./scripts/backtest_e2e_smoke.sh [api_base]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"
STEPS=29
ASSET=SPY
CSV_PATH="apps/worker/data/market/spy.us.daily.sample.csv"
EXPECTED_PAIRS=$((STEPS - 1))
echo "=== Backtest E2E Smoke ==="
# 1) Create run
RUN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/runs" -H "Content-Type: application/json" -d "{}")
RUN_BODY=$(echo "$RUN_RESP" | head -n -1)
RUN_CODE=$(echo "$RUN_RESP" | tail -n 1)
[ "$RUN_CODE" = "201" ] || [ "$RUN_CODE" = "200" ] || { echo "FAIL: POST /runs $RUN_CODE"; exit 1; }
RUN_ID=$(echo "$RUN_BODY" | jq -r '.id // empty')
[ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ] || { echo "FAIL: no run id"; exit 1; }
echo "OK: RUN_ID=$RUN_ID"
# 2) Import CSV
pnpm -C apps/worker run import-market-csv -- --runId "$RUN_ID" --assetSymbol "$ASSET" --csv "$CSV_PATH" --priceField close
# 3) Backtest with --runId
export API_BASE
BT_OUTPUT=$(pnpm -C apps/worker run backtest-v0 -- --runId "$RUN_ID" --assetSymbol "$ASSET" --steps "$STEPS" --agents 200 --seeds "1,2,3,4,5" --csv "$CSV_PATH" --priceField close 2>&1)
echo "$BT_OUTPUT"
echo "$BT_OUTPUT" | grep -q "pairsCount=$EXPECTED_PAIRS" || { echo "FAIL: pairsCount=$EXPECTED_PAIRS not in output"; exit 1; }
# 4) API backtests
RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/backtests?assetSymbol=SPY&limit=5")
BODY=$(echo "$RESP" | head -n -1)
CODE=$(echo "$RESP" | tail -n 1)
[ "$CODE" = "200" ] || { echo "FAIL: backtests HTTP $CODE"; exit 1; }
NULL_CORR=$(echo "$BODY" | jq '[.items[].corr] | map(select(. == null)) | length')
ITEMS=$(echo "$BODY" | jq '.items | length')
[ "$ITEMS" = "0" ] || [ "$NULL_CORR" != "$ITEMS" ] || { echo "FAIL: all corr null"; exit 1; }
echo "=== Backtest E2E smoke passed ==="
exit 0
