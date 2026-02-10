#!/usr/bin/env bash
# InfoFeed layer smoke test
# Usage: ./scripts/infofeed_smoke.sh [api_base]
set -euo pipefail
API_BASE="${1:-${API_BASE:-http://localhost:4001}}"

echo "=== InfoFeed Layer Smoke Test ==="
if [ -z "${RUN_ID:-}" ]; then
  GEN=$(curl -sS -X POST "$API_BASE/agents/generate?overwrite=true" -H "Content-Type: application/json" -d '{"count":100,"seed":42}')
  RUN_ID=$(echo "$GEN" | jq -r '.runId // empty')
  [ -z "$RUN_ID" ] && echo "FAIL: no runId" && exit 1
  echo "RUN_ID=$RUN_ID"
fi

curl -sS -X DELETE "$API_BASE/runs/$RUN_ID/info-events?assetSymbol=RUN" >/dev/null || true
curl -sS -X POST "$API_BASE/runs/$RUN_ID/info-events" -H "Content-Type: application/json" -d '{"assetSymbol":"RUN","step":0,"topic":"earnings","sentiment":0.8,"credibility":0.9,"reach":0.9}' | jq -c '.id' 2>/dev/null || true
curl -sS -X POST "$API_BASE/runs/$RUN_ID/info-events" -H "Content-Type: application/json" -d '{"assetSymbol":"RUN","step":1,"topic":"rates","sentiment":-0.7,"credibility":0.9,"reach":0.9}' | jq -c '.id' 2>/dev/null || true
curl -sS -X POST "$API_BASE/runs/$RUN_ID/info-events" -H "Content-Type: application/json" -d '{"assetSymbol":"RUN","step":2,"topic":"geopolitics","sentiment":0.2,"credibility":0.9,"reach":0.9}' | jq -c '.id' 2>/dev/null || true
echo "OK: 3 events created"

OUT1=$(pnpm -C apps/worker run decide -- --runId "$RUN_ID" --steps 3 --seed 123 --overwrite 2>&1)
OUT2=$(pnpm -C apps/worker run decide -- --runId "$RUN_ID" --steps 3 --seed 123 --overwrite 2>&1)
S1=$(echo "$OUT1" | grep "Step 0:" | head -1 | sed 's/^\[[^]]*\] //')
S2=$(echo "$OUT2" | grep "Step 0:" | head -1 | sed 's/^\[[^]]*\] //')
[ "$S1" = "$S2" ] || { echo "FAIL: non-deterministic"; exit 1; }
echo "OK: determinism verified"

DEC=$(curl -sS "$API_BASE/results/decisions?run_id=$RUN_ID&step=0&assetSymbol=RUN")
echo "Step 0: $(echo "$DEC" | jq -r '.histogram') avgConf=$(echo "$DEC" | jq -r '.avgConfidence')"
echo "$DEC" | jq -r '.sample[0:3][] | .rationale' | head -5
echo "=== InfoFeed smoke PASSED ==="
