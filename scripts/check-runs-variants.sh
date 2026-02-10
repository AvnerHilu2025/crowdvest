#!/usr/bin/env bash
# Smoke test for GET /runs/:runId/variants: create run, call endpoint, assert 200 + JSON shape.
# Usage: ./scripts/check-runs-variants.sh [api_base]
# API_BASE defaults to http://localhost:4001

set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "Checking GET /runs/:runId/variants at $API_BASE"

# 1) Create a run
CREATE_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/runs" -H "Content-Type: application/json" -d "{}")
CREATE_BODY=$(echo "$CREATE_RESP" | head -n -1)
CREATE_CODE=$(echo "$CREATE_RESP" | tail -n 1)
if [ "$CREATE_CODE" != "201" ]; then
  echo "FAIL: POST /runs returned HTTP $CREATE_CODE"
  echo "$CREATE_BODY" | jq . 2>/dev/null || echo "$CREATE_BODY"
  exit 1
fi
RUN_ID=$(echo "$CREATE_BODY" | jq -r '.id // empty')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: POST /runs response missing id"
  exit 1
fi
echo "OK: Created run id=$RUN_ID"

# 2) GET /runs/:runId/variants returns 200 with items and total
VARIANTS_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/runs/$RUN_ID/variants?limit=5")
VARIANTS_BODY=$(echo "$VARIANTS_RESP" | head -n -1)
VARIANTS_CODE=$(echo "$VARIANTS_RESP" | tail -n 1)
if [ "$VARIANTS_CODE" != "200" ]; then
  echo "FAIL: GET /runs/$RUN_ID/variants returned HTTP $VARIANTS_CODE"
  echo "$VARIANTS_BODY" | jq . 2>/dev/null || echo "$VARIANTS_BODY"
  exit 1
fi
if ! echo "$VARIANTS_BODY" | jq -e '.items != null' >/dev/null 2>&1; then
  echo "FAIL: response missing .items"
  echo "$VARIANTS_BODY" | jq .
  exit 1
fi
if ! echo "$VARIANTS_BODY" | jq -e '.total != null' >/dev/null 2>&1; then
  echo "FAIL: response missing .total"
  echo "$VARIANTS_BODY" | jq .
  exit 1
fi
echo "OK: GET /runs/:runId/variants returns 200 with items and total"

# 3) Invalid runId -> 400 with error.code BAD_REQUEST
BAD_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/runs/not-a-uuid/variants")
BAD_BODY=$(echo "$BAD_RESP" | head -n -1)
BAD_CODE=$(echo "$BAD_RESP" | tail -n 1)
if [ "$BAD_CODE" != "400" ]; then
  echo "FAIL: GET /runs/not-a-uuid/variants expected 400, got $BAD_CODE"
  echo "$BAD_BODY" | jq . 2>/dev/null || echo "$BAD_BODY"
  exit 1
fi
if ! echo "$BAD_BODY" | jq -e '.error.code == "BAD_REQUEST"' >/dev/null 2>&1; then
  echo "FAIL: 400 response missing error.code BAD_REQUEST"
  echo "$BAD_BODY" | jq .
  exit 1
fi
echo "OK: invalid runId returns 400 with error.code BAD_REQUEST"

# 4) Non-existent run (valid UUID) -> 404 with error.code NOT_FOUND
NOTFOUND_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/runs/00000000-0000-0000-0000-000000000000/variants")
NOTFOUND_BODY=$(echo "$NOTFOUND_RESP" | head -n -1)
NOTFOUND_CODE=$(echo "$NOTFOUND_RESP" | tail -n 1)
if [ "$NOTFOUND_CODE" != "404" ]; then
  echo "FAIL: GET /runs/00000000-.../variants expected 404, got $NOTFOUND_CODE"
  echo "$NOTFOUND_BODY" | jq . 2>/dev/null || echo "$NOTFOUND_BODY"
  exit 1
fi
if ! echo "$NOTFOUND_BODY" | jq -e '.error.code == "NOT_FOUND"' >/dev/null 2>&1; then
  echo "FAIL: 404 response missing error.code NOT_FOUND"
  echo "$NOTFOUND_BODY" | jq .
  exit 1
fi
echo "OK: non-existent run returns 404 with error.code NOT_FOUND"

echo "All GET /runs/:runId/variants checks passed."
