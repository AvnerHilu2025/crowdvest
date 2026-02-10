#!/usr/bin/env bash
# Decision Engine v1 + Crowd Wisdom smoke test:
# 1) Generate decisions via worker
# 2) Fetch step decision summary
# 3) Fetch crowd summary (histogram totals == agent count per step)
#
# Usage: ./scripts/decision_engine_smoke.sh [api_base]
# API_BASE defaults to http://localhost:4001
# Prereq: Run with agents (POST /agents/generate) to get RUN_ID.
#         Or pass RUN_ID env var from a prior agents run.

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "=== Decision Engine v1 Smoke Test ==="
echo "API_BASE=$API_BASE"

# Get RUN_ID: from env or create agents first
if [ -z "${RUN_ID:-}" ]; then
  echo ""
  echo "[0] Creating 100 agents (no runId) to get RUN_ID..."
  GEN=$(curl -sS -X POST "$API_BASE/agents/generate" \
    -H "Content-Type: application/json" \
    -d '{"count":100,"seed":42}')
  RUN_ID=$(echo "$GEN" | jq -r '.runId // empty')
  if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
    echo "FAIL: Could not create agents"
    echo "$GEN" | jq .
    exit 1
  fi
  echo "RUN_ID=$RUN_ID"
fi

# 1) Generate decisions via worker
echo ""
echo "[1] pnpm -C apps/worker run decide -- --runId $RUN_ID --steps 20 --seed 123"
pnpm -C apps/worker run decide -- --runId "$RUN_ID" --steps 20 --seed 123
echo "OK: decide completed"

# 2) Fetch step decision summary
echo ""
echo "[2] GET /results/decisions?run_id=$RUN_ID&step=0&assetSymbol=RUN"
DEC_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/decisions?run_id=$RUN_ID&step=0&assetSymbol=RUN")
DEC_BODY=$(echo "$DEC_RESP" | head -n -1)
DEC_CODE=$(echo "$DEC_RESP" | tail -n 1)
if [ "$DEC_CODE" != "200" ]; then
  echo "FAIL: decisions returned HTTP $DEC_CODE"
  echo "$DEC_BODY" | jq . 2>/dev/null || echo "$DEC_BODY"
  exit 1
fi
BUY=$(echo "$DEC_BODY" | jq -r '.histogram.BUY // 0')
SELL=$(echo "$DEC_BODY" | jq -r '.histogram.SELL // 0')
HOLD=$(echo "$DEC_BODY" | jq -r '.histogram.HOLD // 0')
TOTAL=$((BUY + SELL + HOLD))
if [ "$TOTAL" != "100" ]; then
  echo "FAIL: step 0 histogram total=$TOTAL, expected 100"
  exit 1
fi
echo "OK: step 0 histogram BUY=$BUY SELL=$SELL HOLD=$HOLD (total=100)"

# 3) Fetch crowd summary
echo ""
echo "[3] GET /results/crowd-summary?run_id=$RUN_ID&assetSymbol=RUN"
CROWD_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/crowd-summary?run_id=$RUN_ID&assetSymbol=RUN")
CROWD_BODY=$(echo "$CROWD_RESP" | head -n -1)
CROWD_CODE=$(echo "$CROWD_RESP" | tail -n 1)
if [ "$CROWD_CODE" != "200" ]; then
  echo "FAIL: crowd-summary returned HTTP $CROWD_CODE"
  echo "$CROWD_BODY" | jq . 2>/dev/null || echo "$CROWD_BODY"
  exit 1
fi
PER_STEP_COUNT=$(echo "$CROWD_BODY" | jq '.perStep | length')
REC_ACTION=$(echo "$CROWD_BODY" | jq -r '.recommendation.action // empty')
if [ -z "$REC_ACTION" ]; then
  echo "FAIL: crowd-summary missing recommendation.action"
  exit 1
fi
# Verify each perStep has BUY+SELL+HOLD=100
ALL_OK=true
for i in $(seq 0 $((PER_STEP_COUNT - 1))); do
  B=$(echo "$CROWD_BODY" | jq -r ".perStep[$i].BUY // 0")
  S=$(echo "$CROWD_BODY" | jq -r ".perStep[$i].SELL // 0")
  H=$(echo "$CROWD_BODY" | jq -r ".perStep[$i].HOLD // 0")
  SUM=$((B + S + H))
  if [ "$SUM" != "100" ]; then
    echo "FAIL: perStep[$i] total=$SUM, expected 100"
    ALL_OK=false
  fi
done
if [ "$ALL_OK" != "true" ]; then
  exit 1
fi
echo "OK: crowd-summary perStep count=$PER_STEP_COUNT, recommendation=$REC_ACTION, totals match 100/step"

echo ""
echo "=== Decision Engine smoke test PASSED ==="
