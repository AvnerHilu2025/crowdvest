#!/usr/bin/env bash
# CrowdVest v1 product smoke test:
# - Generate 100 agents via POST /agents/generate
# - Run simulation for 20 steps
# - Verify decisions exist for each step
# - Verify crowd summary returns metrics and totals match
# - Verify no breaking of existing wallet/bets endpoints
#
# Usage: ./scripts/crowdvest_v1_smoke.sh [api_base]
# API_BASE defaults to http://localhost:4001
# Prereq: API running, DB seeded with archetypes.

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "=== CrowdVest v1 Smoke Test ==="
echo "API_BASE=$API_BASE"

# 1) Health
echo ""
echo "[1] Health check..."
HEALTH_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/health")
if [ "$HEALTH_CODE" != "200" ]; then
  echo "FAIL: health returned HTTP $HEALTH_CODE"
  exit 1
fi
echo "OK: health"

# 2) Generate 100 agents, 20 steps
echo ""
echo "[2] POST /agents/generate (count=100, steps=20)..."
GEN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/agents/generate" \
  -H "Content-Type: application/json" \
  -d '{"count":100,"steps":20}')
GEN_BODY=$(echo "$GEN_RESP" | head -n -1)
GEN_CODE=$(echo "$GEN_RESP" | tail -n 1)
if [ "$GEN_CODE" != "200" ] && [ "$GEN_CODE" != "201" ]; then
  echo "FAIL: POST /agents/generate returned HTTP $GEN_CODE"
  echo "$GEN_BODY" | jq . 2>/dev/null || echo "$GEN_BODY"
  exit 1
fi
RUN_ID=$(echo "$GEN_BODY" | jq -r '.runId // empty')
AGENT_COUNT=$(echo "$GEN_BODY" | jq -r '.agentCount // 0')
STEP_COUNT=$(echo "$GEN_BODY" | jq -r '.stepCount // 0')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: response missing runId"
  echo "$GEN_BODY" | jq .
  exit 1
fi
if [ "$AGENT_COUNT" != "100" ]; then
  echo "FAIL: expected agentCount=100, got $AGENT_COUNT"
  exit 1
fi
if [ "$STEP_COUNT" != "20" ]; then
  echo "FAIL: expected stepCount=20, got $STEP_COUNT"
  exit 1
fi
echo "OK: runId=$RUN_ID agentCount=100 stepCount=20"

# 3) GET /results/agents?run_id= — verify 100 agents
echo ""
echo "[3] GET /results/agents?run_id=$RUN_ID..."
AGENTS_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/agents?run_id=$RUN_ID")
AGENTS_BODY=$(echo "$AGENTS_RESP" | head -n -1)
AGENTS_CODE=$(echo "$AGENTS_RESP" | tail -n 1)
if [ "$AGENTS_CODE" != "200" ]; then
  echo "FAIL: GET /results/agents returned HTTP $AGENTS_CODE"
  echo "$AGENTS_BODY" | jq . 2>/dev/null || echo "$AGENTS_BODY"
  exit 1
fi
ITEMS_TOTAL=$(echo "$AGENTS_BODY" | jq -r '.total // 0')
if [ "$ITEMS_TOTAL" != "100" ]; then
  echo "FAIL: expected agents total=100, got $ITEMS_TOTAL"
  exit 1
fi
echo "OK: 100 agents"

# 4) GET /results/crowd-summary — verify metrics and totals
echo ""
echo "[4] GET /results/crowd-summary?run_id=$RUN_ID..."
CROWD_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/crowd-summary?run_id=$RUN_ID")
CROWD_BODY=$(echo "$CROWD_RESP" | head -n -1)
CROWD_CODE=$(echo "$CROWD_RESP" | tail -n 1)
if [ "$CROWD_CODE" != "200" ]; then
  echo "FAIL: GET /results/crowd-summary returned HTTP $CROWD_CODE"
  echo "$CROWD_BODY" | jq . 2>/dev/null || echo "$CROWD_BODY"
  exit 1
fi
CROWD_STEPS=$(echo "$CROWD_BODY" | jq -r '.steps // 0')
CROWD_BUY=$(echo "$CROWD_BODY" | jq -r '.totals.buy // 0')
CROWD_SELL=$(echo "$CROWD_BODY" | jq -r '.totals.sell // 0')
CROWD_HOLD=$(echo "$CROWD_BODY" | jq -r '.totals.hold // 0')
if [ "$CROWD_STEPS" != "20" ]; then
  echo "FAIL: expected crowd steps=20, got $CROWD_STEPS"
  exit 1
fi
# total actions per step = 100 agents; 20 steps => 2000 total
TOTAL_ACTIONS=$((CROWD_BUY + CROWD_SELL + CROWD_HOLD))
EXPECTED_ACTIONS=2000
if [ "$TOTAL_ACTIONS" != "$EXPECTED_ACTIONS" ]; then
  echo "FAIL: crowd totals buy+sell+hold=$TOTAL_ACTIONS, expected $EXPECTED_ACTIONS"
  echo "$CROWD_BODY" | jq '.totals, .voteDistribution'
  exit 1
fi
echo "OK: crowd summary steps=20, totals match (buy+sell+hold=$TOTAL_ACTIONS)"

# 5) GET /results/agent/:id/decisions — verify 20 decisions per agent
echo ""
echo "[5] GET /results/agent/:id/decisions..."
FIRST_AGENT_ID=$(echo "$AGENTS_BODY" | jq -r '.items[0].agentId // empty')
if [ -z "$FIRST_AGENT_ID" ] || [ "$FIRST_AGENT_ID" = "null" ]; then
  echo "FAIL: no agent id in /results/agents"
  exit 1
fi
DEC_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/agent/$FIRST_AGENT_ID/decisions?run_id=$RUN_ID")
DEC_BODY=$(echo "$DEC_RESP" | head -n -1)
DEC_CODE=$(echo "$DEC_RESP" | tail -n 1)
if [ "$DEC_CODE" != "200" ]; then
  echo "FAIL: GET /results/agent/.../decisions returned HTTP $DEC_CODE"
  echo "$DEC_BODY" | jq . 2>/dev/null || echo "$DEC_BODY"
  exit 1
fi
DEC_COUNT=$(echo "$DEC_BODY" | jq -r '.decisions | length')
if [ "$DEC_COUNT" != "20" ]; then
  echo "FAIL: expected 20 decisions per agent, got $DEC_COUNT"
  echo "$DEC_BODY" | jq '.decisions | length'
  exit 1
fi
echo "OK: agent has 20 decisions"

# 6) Wallet endpoints (no breaking)
echo ""
echo "[6] Wallet endpoints..."
WALLET_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/wallet?userId=demo-user")
if [ "$WALLET_CODE" != "200" ]; then
  echo "FAIL: GET /wallet returned HTTP $WALLET_CODE"
  exit 1
fi
echo "OK: GET /wallet"

# 7) Bets endpoints (no breaking) — use a valid UUID format
echo ""
echo "[7] Bets endpoints..."
BETS_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/bets?userId=550e8400-e29b-41d4-a716-446655440000&limit=5")
if [ "$BETS_CODE" != "200" ]; then
  echo "FAIL: GET /bets returned HTTP $BETS_CODE"
  exit 1
fi
echo "OK: GET /bets"

echo ""
echo "=== Smoke test PASSED ==="
