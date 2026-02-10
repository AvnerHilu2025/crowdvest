#!/usr/bin/env bash
# Run Summary endpoint smoke: create run, import CSV, generate agents, decide, metrics, rewards; then GET /runs/:runId/summary and assert.
#
# Asserts: marketDataPresent=true, counts.agents=50, counts.steps=29 (from sample CSV), and endpoint 200.
#
# Usage: ./scripts/run_summary_smoke.sh [api_base]
# Prereq: API running, DB with archetypes; CSV at apps/worker/data/market/spy.us.daily.sample.csv

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"
STEPS=29
AGENTS=50
ASSET=SPY
CSV_PATH="apps/worker/data/market/spy.us.daily.sample.csv"

echo "=== Run Summary Smoke ==="
echo "API_BASE=$API_BASE STEPS=$STEPS AGENTS=$AGENTS"

echo "[1] POST /runs..."
RUN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/runs" -H "Content-Type: application/json" -d "{}")
RUN_BODY=$(echo "$RUN_RESP" | head -n -1)
RUN_CODE=$(echo "$RUN_RESP" | tail -n 1)
[ "$RUN_CODE" = "201" ] || [ "$RUN_CODE" = "200" ] || { echo "FAIL: POST /runs $RUN_CODE"; echo "$RUN_BODY" | jq . 2>/dev/null || echo "$RUN_BODY"; exit 1; }
RUN_ID=$(echo "$RUN_BODY" | jq -r '.id // empty')
[ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ] || { echo "FAIL: no run id"; exit 1; }
echo "OK: RUN_ID=$RUN_ID"

echo "[2] Import CSV..."
pnpm -C apps/worker run import-market-csv -- --runId "$RUN_ID" --assetSymbol "$ASSET" --csv "$CSV_PATH" --priceField close
echo "OK: import done"

echo "[3] POST /agents/generate count=$AGENTS..."
curl -sS -X POST "$API_BASE/agents/generate?runId=$RUN_ID&overwrite=true" \
  -H "Content-Type: application/json" \
  -d "{\"count\":$AGENTS,\"seed\":123,\"preset\":\"default\"}" | jq -e '.createdCount >= 0' >/dev/null
echo "OK: agents generated"

echo "[4] decide steps=$STEPS..."
pnpm -C apps/worker run decide -- --runId "$RUN_ID" --assetSymbol "$ASSET" --steps "$STEPS" --seed 123 --overwrite=true --allowSmallCrowd
echo "OK: decide done"

echo "[5] compute-crowd-metrics..."
pnpm -C apps/worker run compute-crowd-metrics -- --runId "$RUN_ID" --assetSymbol "$ASSET"
echo "OK: crowd metrics done"

echo "[6] compute-rewards..."
pnpm -C apps/worker run compute-rewards -- --runId "$RUN_ID" --assetSymbol "$ASSET" --steps "$STEPS" --seed 123 --overwrite false
echo "OK: rewards done"

echo "[7] GET /runs/$RUN_ID/summary?assetSymbol=$ASSET..."
SUMMARY_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/runs/$RUN_ID/summary?assetSymbol=$ASSET")
SUMMARY_BODY=$(echo "$SUMMARY_RESP" | head -n -1)
SUMMARY_CODE=$(echo "$SUMMARY_RESP" | tail -n 1)
if [ "$SUMMARY_CODE" != "200" ]; then
  echo "FAIL: summary returned HTTP $SUMMARY_CODE"
  echo "$SUMMARY_BODY" | jq . 2>/dev/null || echo "$SUMMARY_BODY"
  exit 1
fi
echo "OK: summary 200"

echo "[8] Assert marketDataPresent=true..."
MARKET=$(echo "$SUMMARY_BODY" | jq -r '.health.marketDataPresent')
[ "$MARKET" = "true" ] || { echo "FAIL: health.marketDataPresent=$MARKET expected true"; exit 1; }
echo "OK: marketDataPresent=true"

echo "[9] Assert counts.steps=29..."
STEPS_COUNT=$(echo "$SUMMARY_BODY" | jq -r '.counts.steps')
[ "$STEPS_COUNT" = "29" ] || { echo "FAIL: counts.steps=$STEPS_COUNT expected 29"; exit 1; }
echo "OK: counts.steps=29"

echo "[10] Assert counts.agents=50..."
AGENTS_COUNT=$(echo "$SUMMARY_BODY" | jq -r '.counts.agents')
[ "$AGENTS_COUNT" = "50" ] || { echo "FAIL: counts.agents=$AGENTS_COUNT expected 50"; exit 1; }
echo "OK: counts.agents=50"

echo ""
echo "=== Run Summary smoke passed ==="
exit 0
