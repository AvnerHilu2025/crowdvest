#!/usr/bin/env bash
# Agents v1 smoke test:
# - Create 100 agents for a run
# - Fetch list, fetch a single agent, verify traits count > 0
#
# Usage: ./scripts/agents_v1_smoke.sh [api_base]
# API_BASE defaults to http://localhost:4001

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "=== Agents v1 Smoke Test ==="
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

# 2) Create 100 agents (runId optional - will create run if needed)
echo ""
echo "[2] POST /agents/generate (count=100)..."
GEN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/agents/generate" \
  -H "Content-Type: application/json" \
  -d '{"count":100,"seed":42}')
GEN_BODY=$(echo "$GEN_RESP" | head -n -1)
GEN_CODE=$(echo "$GEN_RESP" | tail -n 1)
if [ "$GEN_CODE" != "200" ] && [ "$GEN_CODE" != "201" ]; then
  echo "FAIL: POST /agents/generate returned HTTP $GEN_CODE"
  echo "$GEN_BODY" | jq . 2>/dev/null || echo "$GEN_BODY"
  exit 1
fi
RUN_ID=$(echo "$GEN_BODY" | jq -r '.runId // empty')
CREATED=$(echo "$GEN_BODY" | jq -r '.createdCount // 0')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: response missing runId"
  echo "$GEN_BODY" | jq .
  exit 1
fi
if [ "$CREATED" != "100" ]; then
  echo "FAIL: expected createdCount=100, got $CREATED"
  exit 1
fi
echo "OK: runId=$RUN_ID createdCount=100"

# 3) GET /agents?runId= — list
echo ""
echo "[3] GET /agents?runId=$RUN_ID..."
LIST_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/agents?runId=$RUN_ID&limit=10")
LIST_BODY=$(echo "$LIST_RESP" | head -n -1)
LIST_CODE=$(echo "$LIST_RESP" | tail -n 1)
if [ "$LIST_CODE" != "200" ]; then
  echo "FAIL: GET /agents returned HTTP $LIST_CODE"
  echo "$LIST_BODY" | jq . 2>/dev/null || echo "$LIST_BODY"
  exit 1
fi
TOTAL=$(echo "$LIST_BODY" | jq -r '.total // 0')
if [ "$TOTAL" != "100" ]; then
  echo "FAIL: expected total=100, got $TOTAL"
  exit 1
fi
echo "OK: list total=100"

# 4) GET /agents/:id — single agent with traits
echo ""
echo "[4] GET /agents/:id (single agent with traits)..."
FIRST_ID=$(echo "$LIST_BODY" | jq -r '.items[0].id // empty')
if [ -z "$FIRST_ID" ] || [ "$FIRST_ID" = "null" ]; then
  echo "FAIL: no agent id in list"
  exit 1
fi
SINGLE_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/agents/$FIRST_ID")
SINGLE_BODY=$(echo "$SINGLE_RESP" | head -n -1)
SINGLE_CODE=$(echo "$SINGLE_RESP" | tail -n 1)
if [ "$SINGLE_CODE" != "200" ]; then
  echo "FAIL: GET /agents/:id returned HTTP $SINGLE_CODE"
  echo "$SINGLE_BODY" | jq . 2>/dev/null || echo "$SINGLE_BODY"
  exit 1
fi
TRAITS_COUNT=$(echo "$SINGLE_BODY" | jq -r '.traits | length')
if [ "$TRAITS_COUNT" -le 0 ]; then
  echo "FAIL: expected traits count > 0, got $TRAITS_COUNT"
  echo "$SINGLE_BODY" | jq .
  exit 1
fi
echo "OK: agent has $TRAITS_COUNT traits"

# 5) GET /agents?run_id= (alias)
echo ""
echo "[5] GET /agents?run_id= (alias)..."
ALIAS_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/agents?run_id=$RUN_ID&limit=5")
ALIAS_CODE=$(echo "$ALIAS_RESP" | tail -n 1)
if [ "$ALIAS_CODE" != "200" ]; then
  echo "FAIL: GET /agents?run_id= returned HTTP $ALIAS_CODE"
  exit 1
fi
echo "OK: run_id alias works"

echo ""
echo "=== Agents v1 smoke test PASSED ==="
