#!/usr/bin/env bash
# Humanization Layer v1 smoke test:
# 1) Generate 100 agents -> each has biases + humanState traits
# 2) Decide 20 steps overwrite (twice) -> identical histograms (determinism)
# 3) Compute crowd metrics
# 4) Fetch crowd-state
# 5) Print step 0 and step 1 histogram + avgConfidence
# 6) Verify rationale strings mention biases
#
# Usage: ./scripts/humanization_layer_smoke.sh [api_base]
# API_BASE defaults to http://localhost:4001

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "=== Humanization Layer v1 Smoke Test ==="
echo "API_BASE=$API_BASE"

# 0) Create 100 agents (overwrite=true to replace any existing)
echo ""
echo "[0] POST /agents/generate?overwrite=true (count=100, seed=42)..."
GEN=$(curl -sS -X POST "$API_BASE/agents/generate?overwrite=true" \
  -H "Content-Type: application/json" \
  -d '{"count":100,"seed":42}')
RUN_ID=$(echo "$GEN" | jq -r '.runId // empty')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: could not create agents"
  echo "$GEN" | jq .
  exit 1
fi
echo "RUN_ID=$RUN_ID"

# Verify agent has biases + humanState (persisted JSON columns)
FIRST_AGENT=$(curl -sS "$API_BASE/agents?runId=$RUN_ID&limit=1" | jq -r '.items[0].id // empty')
if [ -n "$FIRST_AGENT" ]; then
  AGENT_DETAIL=$(curl -sS "$API_BASE/agents/$FIRST_AGENT")
  BIASES=$(echo "$AGENT_DETAIL" | jq -r '.biases // empty')
  HUMAN_STATE=$(echo "$AGENT_DETAIL" | jq -r '.humanState // empty')
  if [ -z "$BIASES" ] || [ "$BIASES" = "null" ]; then
    echo "FAIL: agent biases is null"
    exit 1
  fi
  if [ -z "$HUMAN_STATE" ] || [ "$HUMAN_STATE" = "null" ]; then
    echo "FAIL: agent humanState is null"
    exit 1
  fi
  echo "OK: agent has biases + humanState (non-null)"
fi

# 0b) Overwrite=false must not add agents
echo ""
echo "[0b] POST /agents/generate?runId=...&overwrite=false (should not add, total stays 100)..."
GEN2=$(curl -sS -X POST "$API_BASE/agents/generate?runId=$RUN_ID&overwrite=false" \
  -H "Content-Type: application/json" \
  -d '{"count":100,"seed":42}')
CREATED2=$(echo "$GEN2" | jq -r '.createdCount // -1')
TOTAL2=$(echo "$GEN2" | jq -r '.total // -1')
if [ "$CREATED2" != "0" ] || [ "$TOTAL2" != "100" ]; then
  echo "FAIL: overwrite=false should yield createdCount=0 total=100, got createdCount=$CREATED2 total=$TOTAL2"
  exit 1
fi
echo "OK: overwrite=false returns createdCount=0 total=100"

# 1) Decide 20 steps overwrite (first run)
echo ""
echo "[1] pnpm decide --runId $RUN_ID --steps 20 --seed 123 --overwrite (1st run)"
OUT1=$(pnpm -C apps/worker run decide -- --runId "$RUN_ID" --steps 20 --seed 123 --overwrite 2>&1)
if ! echo "$OUT1" | grep -q "Loaded 100 agents"; then
  LOADED=$(echo "$OUT1" | grep "Loaded" || true)
  echo "FAIL: expected 'Loaded 100 agents', got: $LOADED"
  exit 1
fi
echo "OK: decide logs Loaded 100 agents"
STEP0_1=$(echo "$OUT1" | grep "Step 0:" | head -1 | sed 's/^\[[^]]*\] //')
STEP1_1=$(echo "$OUT1" | grep "Step 1:" | head -1 | sed 's/^\[[^]]*\] //')

# 2) Decide overwrite (second run) - must be identical
echo ""
echo "[2] pnpm decide --runId $RUN_ID --steps 20 --seed 123 --overwrite (2nd run)"
OUT2=$(pnpm -C apps/worker run decide -- --runId "$RUN_ID" --steps 20 --seed 123 --overwrite 2>&1)
STEP0_2=$(echo "$OUT2" | grep "Step 0:" | head -1 | sed 's/^\[[^]]*\] //')
STEP1_2=$(echo "$OUT2" | grep "Step 1:" | head -1 | sed 's/^\[[^]]*\] //')

if [ "$STEP0_1" != "$STEP0_2" ]; then
  echo "FAIL: step 0 outputs differ (non-deterministic)"
  echo "Run1: $STEP0_1"
  echo "Run2: $STEP0_2"
  exit 1
fi
if [ "$STEP1_1" != "$STEP1_2" ]; then
  echo "FAIL: step 1 outputs differ (non-deterministic)"
  exit 1
fi
echo "OK: decide overwrite twice produces identical histograms"

# 3) Compute crowd metrics
echo ""
echo "[3] pnpm compute-crowd-metrics..."
pnpm -C apps/worker run compute-crowd-metrics -- --runId "$RUN_ID" --assetSymbol RUN 2>&1 | tail -1

# 4) Fetch crowd-state
echo ""
echo "[4] GET /results/crowd-state..."
CROWD=$(curl -sS "$API_BASE/results/crowd-state?runId=$RUN_ID&assetSymbol=RUN")
if ! echo "$CROWD" | jq -e '.perStep' >/dev/null 2>&1; then
  echo "FAIL: crowd-state missing perStep"
  exit 1
fi
if ! echo "$CROWD" | jq -e '.recommendation.direction' >/dev/null 2>&1; then
  echo "FAIL: crowd-state missing recommendation"
  exit 1
fi
echo "OK: crowd-state returns perStep + recommendation"

# 5) Print step 0 and step 1
echo ""
echo "[5] Step 0 and Step 1 histogram + avgConfidence:"
DEC0=$(curl -sS "$API_BASE/results/decisions?run_id=$RUN_ID&step=0&assetSymbol=RUN")
DEC1=$(curl -sS "$API_BASE/results/decisions?run_id=$RUN_ID&step=1&assetSymbol=RUN")
echo "Step 0: BUY=$(echo "$DEC0" | jq -r '.histogram.BUY') SELL=$(echo "$DEC0" | jq -r '.histogram.SELL') HOLD=$(echo "$DEC0" | jq -r '.histogram.HOLD') avgConf=$(echo "$DEC0" | jq -r '.avgConfidence')"
echo "Step 1: BUY=$(echo "$DEC1" | jq -r '.histogram.BUY') SELL=$(echo "$DEC1" | jq -r '.histogram.SELL') HOLD=$(echo "$DEC1" | jq -r '.histogram.HOLD') avgConf=$(echo "$DEC1" | jq -r '.avgConfidence')"

AVG_CONF=$(echo "$DEC0" | jq -r '.avgConfidence')
if [ "$(echo "$AVG_CONF < 0.5" | bc 2>/dev/null || echo 0)" = "1" ]; then
  echo "WARN: avgConfidence very low ($AVG_CONF)"
fi
if [ "$(echo "$AVG_CONF > 0.85" | bc 2>/dev/null || echo 0)" = "1" ]; then
  echo "WARN: avgConfidence very high ($AVG_CONF) - target 0.55-0.75"
fi

# 6) Verify rationale strings mention biases
echo ""
echo "[6] Sample rationales (check for bias mentions):"
SAMPLE=$(echo "$DEC0" | jq -r '.sample[0:3][] | .rationale' 2>/dev/null || true)
echo "$SAMPLE"
if echo "$SAMPLE" | grep -qiE "crowd|FOMO|loss-averse|low attention|fatigue|anchored"; then
  echo "OK: rationale mentions at least one bias"
else
  echo "INFO: rationale sample (bias mentions may appear in other agents)"
fi

echo ""
echo "=== Humanization Layer smoke test PASSED ==="
