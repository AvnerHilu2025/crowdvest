#!/usr/bin/env bash
# SPY E2E smoke: deterministic run — create NEW run, import SPY CSV, 200 agents, decide, metrics, rewards, assertions.
#
# - POST /runs -> new RUN_ID
# - Import SPY CSV to AssetStepReturn (29 steps)
# - POST /agents/generate overwrite=true count=200 seed=123
# - Verify agent count via GET /results/agents-count
# - decide steps=29 assetSymbol=SPY overwrite=true
# - compute-crowd-metrics, compute-rewards overwrite=false
# - Asserts: agent-rewards total == 200*29, crowd-state perStep[28].wisdomScore numeric, agent-state latest.step == 28
#
# Usage: ./scripts/spy_e2e_smoke.sh [api_base]
# Prereq: API running, DB with archetypes, worker scripts; SPY CSV at apps/worker/data/market/spy.us.daily.sample.csv

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"
STEPS=29
AGENT_COUNT=200
EXPECTED_REWARDS=$((AGENT_COUNT * STEPS))
ASSET=SPY
CSV_PATH="apps/worker/data/market/spy.us.daily.sample.csv"

echo "=== SPY E2E Smoke ==="
echo "API_BASE=$API_BASE STEPS=$STEPS AGENT_COUNT=$AGENT_COUNT ASSET=$ASSET EXPECTED_REWARDS=$EXPECTED_REWARDS"

# 0) Create a NEW run (deterministic; no reuse of latest)
echo ""
echo "[0] POST /runs — create new run..."
RUN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/runs" -H "Content-Type: application/json" -d "{}")
RUN_BODY=$(echo "$RUN_RESP" | head -n -1)
RUN_CODE=$(echo "$RUN_RESP" | tail -n 1)
if [ "$RUN_CODE" != "201" ] && [ "$RUN_CODE" != "200" ]; then
  echo "FAIL: POST /runs returned HTTP $RUN_CODE"
  echo "$RUN_BODY" | jq . 2>/dev/null || echo "$RUN_BODY"
  exit 1
fi
RUN_ID=$(echo "$RUN_BODY" | jq -r '.id // empty')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: POST /runs did not return id"
  echo "$RUN_BODY" | jq . 2>/dev/null || echo "$RUN_BODY"
  exit 1
fi
echo "OK: created run RUN_ID=$RUN_ID"

# 1) Import SPY CSV to AssetStepReturn (29 steps)
echo ""
echo "[1] Import SPY CSV to AssetStepReturn..."
pnpm -C apps/worker run import-market-csv -- --runId "$RUN_ID" --assetSymbol "$ASSET" --csv "$CSV_PATH" --priceField close
echo "OK: import-market-csv completed"

# 2) Generate agents overwrite=true count=200 seed=123 preset=default
echo ""
echo "[2] POST /agents/generate runId=$RUN_ID overwrite=true count=$AGENT_COUNT seed=123 preset=default..."
GEN=$(curl -sS -X POST "$API_BASE/agents/generate?runId=$RUN_ID&overwrite=true" \
  -H "Content-Type: application/json" \
  -d "{\"count\":$AGENT_COUNT,\"seed\":123,\"preset\":\"default\"}")
CREATED=$(echo "$GEN" | jq -r '.createdCount // 0')
echo "OK: agents createdCount=$CREATED"

# 3) Verify agent count == AGENT_COUNT
echo ""
echo "[3] GET /results/agents-count — assert count == $AGENT_COUNT..."
COUNT_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/agents-count?runId=$RUN_ID")
COUNT_BODY=$(echo "$COUNT_RESP" | head -n -1)
COUNT_CODE=$(echo "$COUNT_RESP" | tail -n 1)
if [ "$COUNT_CODE" != "200" ]; then
  echo "FAIL: GET /results/agents-count returned HTTP $COUNT_CODE"
  echo "$COUNT_BODY" | jq . 2>/dev/null || echo "$COUNT_BODY"
  exit 1
fi
AGENT_COUNT_ACTUAL=$(echo "$COUNT_BODY" | jq -r '.count // 0')
if [ "$AGENT_COUNT_ACTUAL" != "$AGENT_COUNT" ]; then
  echo "FAIL: agents count=$AGENT_COUNT_ACTUAL, expected $AGENT_COUNT"
  exit 1
fi
echo "OK: agents count=$AGENT_COUNT_ACTUAL"

# 4) decide steps=29 assetSymbol=SPY overwrite=true
echo ""
echo "[4] decide --overwrite=true steps=$STEPS assetSymbol=$ASSET..."
pnpm -C apps/worker run decide -- --runId "$RUN_ID" --assetSymbol "$ASSET" --steps "$STEPS" --seed 123 --overwrite=true --allowSmallCrowd
echo "OK: decide completed"

# 5) compute-crowd-metrics
echo ""
echo "[5] compute-crowd-metrics..."
pnpm -C apps/worker run compute-crowd-metrics -- --runId "$RUN_ID" --assetSymbol "$ASSET"
echo "OK: compute-crowd-metrics completed"

# 6) compute-rewards overwrite=false
echo ""
echo "[6] compute-rewards overwrite=false..."
pnpm -C apps/worker run compute-rewards -- --runId "$RUN_ID" --assetSymbol "$ASSET" --steps "$STEPS" --seed 123 --overwrite false
echo "OK: compute-rewards completed"

# 7) Assert agent-rewards total == AGENT_COUNT * STEPS
echo ""
echo "[7] Assert agent-rewards total == $EXPECTED_REWARDS..."
REWARDS_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/agent-rewards?runId=$RUN_ID&assetSymbol=$ASSET&fromStep=0&toStep=$((STEPS - 1))")
REWARDS_BODY=$(echo "$REWARDS_RESP" | head -n -1)
REWARDS_CODE=$(echo "$REWARDS_RESP" | tail -n 1)
if [ "$REWARDS_CODE" != "200" ]; then
  echo "FAIL: GET /results/agent-rewards returned HTTP $REWARDS_CODE"
  echo "$REWARDS_BODY" | jq . 2>/dev/null || echo "$REWARDS_BODY"
  exit 1
fi
REWARDS_TOTAL=$(echo "$REWARDS_BODY" | jq -r '.total // 0')
if [ "$REWARDS_TOTAL" != "$EXPECTED_REWARDS" ]; then
  echo "FAIL: agent-rewards total=$REWARDS_TOTAL, expected $EXPECTED_REWARDS (agents*steps)"
  exit 1
fi
echo "OK: agent-rewards total=$REWARDS_TOTAL"

# 8) Assert crowd-state perStep[28].wisdomScore is number
echo ""
echo "[8] Assert crowd-state perStep step=28 wisdomScore is number..."
CROWD_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/crowd-state?runId=$RUN_ID&assetSymbol=$ASSET")
CROWD_BODY=$(echo "$CROWD_RESP" | head -n -1)
CROWD_CODE=$(echo "$CROWD_RESP" | tail -n 1)
if [ "$CROWD_CODE" != "200" ]; then
  echo "FAIL: GET /results/crowd-state returned HTTP $CROWD_CODE"
  echo "$CROWD_BODY" | jq . 2>/dev/null || echo "$CROWD_BODY"
  exit 1
fi
STEP28_CROWD=$(echo "$CROWD_BODY" | jq '.perStep[] | select(.step == 28)')
if [ -z "$STEP28_CROWD" ] || [ "$STEP28_CROWD" = "null" ]; then
  echo "FAIL: crowd-state has no perStep step 28"
  exit 1
fi
WISDOM=$(echo "$STEP28_CROWD" | jq -r '.wisdomScore')
if [ "$WISDOM" = "null" ] || [ -z "$WISDOM" ]; then
  echo "FAIL: crowd-state perStep[28].wisdomScore is null or missing"
  exit 1
fi
if ! echo "$WISDOM" | grep -qE '^-?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?$'; then
  echo "FAIL: crowd-state perStep[28].wisdomScore is not numeric: $WISDOM"
  exit 1
fi
echo "OK: crowd-state step28 wisdomScore=$WISDOM"

# 9) Assert agent-state latest.step == 28
echo ""
echo "[9] Assert agent-state latest.step == 28..."
SAMPLE_AGENT_ID=$(echo "$REWARDS_BODY" | jq -r '.items[0].agentId // empty')
if [ -z "$SAMPLE_AGENT_ID" ] || [ "$SAMPLE_AGENT_ID" = "null" ]; then
  echo "FAIL: No sample agentId from agent-rewards"
  exit 1
fi
STATE_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/agent-state?runId=$RUN_ID&assetSymbol=$ASSET&agentId=$SAMPLE_AGENT_ID")
STATE_BODY=$(echo "$STATE_RESP" | head -n -1)
STATE_CODE=$(echo "$STATE_RESP" | tail -n 1)
if [ "$STATE_CODE" != "200" ]; then
  echo "FAIL: GET /results/agent-state returned HTTP $STATE_CODE"
  echo "$STATE_BODY" | jq . 2>/dev/null || echo "$STATE_BODY"
  exit 1
fi
LATEST_STEP=$(echo "$STATE_BODY" | jq -r '.latest.step // empty')
if [ "$LATEST_STEP" != "28" ]; then
  echo "FAIL: agent-state latest.step=$LATEST_STEP, expected 28"
  exit 1
fi
echo "OK: agent-state latest.step=$LATEST_STEP"

echo ""
echo "=== SPY E2E checks passed ==="
exit 0
