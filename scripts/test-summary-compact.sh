#!/usr/bin/env bash
# Test GET /results/summary-compact for a completed run (persist=lite flow).
# Usage: ./scripts/test-summary-compact.sh [API_BASE]
# API_BASE defaults to http://localhost:4001

set -e
API="${1:-http://localhost:4001}"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Creating run via POST $API/runs/import/spy29 ..."
RUN_ID=$(curl -s -X POST "$API/runs/import/spy29" | jq -r '.runId')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo -e "${RED}❌ FAIL: Could not create run${NC}"
  exit 1
fi
echo "RUN_ID=$RUN_ID"

echo "Waiting for COMPLETED..."
for i in $(seq 1 120); do
  S=$(curl -s "$API/runs/$RUN_ID" | jq -r '.status')
  echo "  $(date -Is) status=$S"
  [ "$S" = "COMPLETED" ] && break
  [ "$S" = "FAILED" ] && { echo -e "${RED}❌ FAIL: Run failed${NC}"; exit 1; }
  sleep 1
done

S=$(curl -s "$API/runs/$RUN_ID" | jq -r '.status')
if [ "$S" != "COMPLETED" ]; then
  echo -e "${RED}❌ FAIL: Run did not complete (status=$S)${NC}"
  exit 1
fi

echo "Calling /results/summary-compact?run_id=$RUN_ID ..."
RES=$(curl -s "$API/results/summary-compact?run_id=$RUN_ID")
BUY=$(echo "$RES" | jq -r '.debug.persistedHistogram.BUY // 0')
SELL=$(echo "$RES" | jq -r '.debug.persistedHistogram.SELL // 0')
HOLD=$(echo "$RES" | jq -r '.debug.persistedHistogram.HOLD // 0')
OTHER=$(echo "$RES" | jq -r '.debug.persistedHistogram.OTHER // 0')
TOTAL=$((BUY + SELL + HOLD + OTHER))

echo "Histogram: BUY=$BUY SELL=$SELL HOLD=$HOLD OTHER=$OTHER total=$TOTAL"

if [ "$TOTAL" -gt 0 ]; then
  echo -e "${GREEN}✅ PASS: histogram BUY+SELL+HOLD=$TOTAL > 0${NC}"
  exit 0
else
  echo -e "${RED}❌ FAIL: histogram BUY+SELL+HOLD=0 (expected > 0 for completed run)${NC}"
  exit 1
fi
