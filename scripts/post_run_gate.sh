#!/usr/bin/env bash
# Post-run quality gate: health, latest run from /results/runs, invariants on summary-compact.
# Exits 1 if any invariant fails. Prints RUN_ID and warnings.
# Usage: ./scripts/post_run_gate.sh   or   pnpm verify:run
# API_BASE defaults to http://localhost:4001

set -euo pipefail
API_BASE="${API_BASE:-http://localhost:4001}"

echo "Post-run gate: API_BASE=$API_BASE"

# 1) Health
HEALTH_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/health")
if [ "$HEALTH_CODE" != "200" ]; then
  echo "FAIL: health returned HTTP $HEALTH_CODE"
  exit 1
fi
echo "OK: health"

# 2) Latest run id from /results/runs
RUNS_JSON=$(curl -sS "$API_BASE/results/runs?limit=1")
RUN_ID=$(echo "$RUNS_JSON" | jq -r '.items[0].id // empty')
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "FAIL: no runs in /results/runs"
  exit 1
fi
echo "OK: latest run_id=$RUN_ID"

# 3) Fetch summary-compact
COMPACT_RESP=$(curl -sS -w "\n%{http_code}" "$API_BASE/results/summary-compact?run_id=$RUN_ID")
BODY=$(echo "$COMPACT_RESP" | head -n -1)
CODE=$(echo "$COMPACT_RESP" | tail -n 1)

if [ "$CODE" = "400" ]; then
  echo "FAIL: summary-compact returned 400 Bad Request"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
if [ "$CODE" = "404" ]; then
  echo "FAIL: summary-compact returned 404 Not Found (run_id=$RUN_ID)"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
if [ "$CODE" != "200" ]; then
  echo "FAIL: summary-compact returned HTTP $CODE"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi

# 4) Invariant: agentCount > 0
AGENT_COUNT=$(echo "$BODY" | jq -r '.metrics.agentCount // 0')
if [ "$AGENT_COUNT" -le 0 ]; then
  echo "FAIL: agentCount must be > 0 (got $AGENT_COUNT)"
  exit 1
fi
echo "OK: agentCount > 0"

# 5) totalSteps == agentCount * avgStepsPerAgent (tolerance 1e-6)
TOTAL_STEPS=$(echo "$BODY" | jq -r '.metrics.totalSteps // 0')
AVG_STEPS=$(echo "$BODY" | jq -r '.metrics.avgStepsPerAgent // 0')
STEPS_OK=$(echo "$BODY" | jq '
  (.metrics.totalSteps // 0) as $ts
  | (.metrics.agentCount // 0) as $n
  | (.metrics.avgStepsPerAgent // 0) as $avg
  | (($ts - ($n * $avg)) | if . < 0 then -. else . end) < 1e-6
')
if [ "$STEPS_OK" != "true" ]; then
  echo "FAIL: totalSteps != agentCount * avgStepsPerAgent (totalSteps=$TOTAL_STEPS agentCount=$AGENT_COUNT avgStepsPerAgent=$AVG_STEPS)"
  exit 1
fi
echo "OK: totalSteps == agentCount * avgStepsPerAgent"

# 6) totalBuy + totalSell + totalHold == totalSteps
ACTIONS_SUM=$(echo "$BODY" | jq '
  (.metrics.totalBuy // 0) + (.metrics.totalSell // 0) + (.metrics.totalHold // 0)
')
if [ "$ACTIONS_SUM" != "$TOTAL_STEPS" ]; then
  echo "FAIL: totalBuy+totalSell+totalHold ($ACTIONS_SUM) != totalSteps ($TOTAL_STEPS)"
  exit 1
fi
echo "OK: totalBuy+totalSell+totalHold == totalSteps"

# 7) validation.totalPnlSum == metrics.totalPnl (tolerance 1e-9)
PNL_VAL_OK=$(echo "$BODY" | jq '
  def approx(a; b): (a - b) | if . < 0 then -. else . end | . < 1e-9;
  (.metrics.totalPnl // 0) as $m
  | (.validation.totalPnlSum // 0) as $v
  | approx($m; $v)
')
if [ "$PNL_VAL_OK" != "true" ]; then
  echo "FAIL: validation.totalPnlSum != metrics.totalPnl"
  echo "$BODY" | jq '{ metrics_totalPnl: .metrics.totalPnl, validation_totalPnlSum: .validation.totalPnlSum }'
  exit 1
fi
echo "OK: validation.totalPnlSum == metrics.totalPnl"

# 8) archetypeTotals.agentCountSum == metrics.agentCount
AGENT_COUNT_SUM=$(echo "$BODY" | jq -r '.archetypeTotals.agentCountSum // 0')
if [ "$AGENT_COUNT_SUM" != "$AGENT_COUNT" ]; then
  echo "FAIL: archetypeTotals.agentCountSum ($AGENT_COUNT_SUM) != metrics.agentCount ($AGENT_COUNT)"
  exit 1
fi
echo "OK: archetypeTotals.agentCountSum == metrics.agentCount"

# 9) abs(archetypeTotals.totalPnlSum - metrics.totalPnl) < 1e-9
PNL_ARCH_OK=$(echo "$BODY" | jq '
  def approx(a; b): (a - b) | if . < 0 then -. else . end | . < 1e-9;
  (.metrics.totalPnl // 0) as $m
  | (.archetypeTotals.totalPnlSum // 0) as $a
  | approx($m; $a)
')
if [ "$PNL_ARCH_OK" != "true" ]; then
  echo "FAIL: abs(archetypeTotals.totalPnlSum - metrics.totalPnl) >= 1e-9"
  echo "$BODY" | jq '{ metrics_totalPnl: .metrics.totalPnl, archetypeTotals_totalPnlSum: .archetypeTotals.totalPnlSum }'
  exit 1
fi
echo "OK: archetypeTotals.totalPnlSum ~ metrics.totalPnl"

# 10) Rates: metrics.tradeRate, metrics.buyRate, metrics.sellRate, metrics.holdRate are numbers; tradeRate == buyRate+sellRate; buyRate+sellRate+holdRate ~ 1
RATES_OK=$(echo "$BODY" | jq '
  (.metrics.tradeRate | type == "number") and
  (.metrics.buyRate | type == "number") and
  (.metrics.sellRate | type == "number") and
  (.metrics.holdRate | type == "number") and
  (((.metrics.tradeRate // 0) - ((.metrics.buyRate // 0) + (.metrics.sellRate // 0))) | if . < 0 then -. else . end | . < 1e-9) and
  ((((.metrics.buyRate // 0) + (.metrics.sellRate // 0) + (.metrics.holdRate // 0)) - 1) | if . < 0 then -. else . end | . < 1e-9)
')
if [ "$RATES_OK" != "true" ]; then
  echo "FAIL: rates invariant (metrics.tradeRate/buyRate/sellRate/holdRate must be numbers, tradeRate==buyRate+sellRate, buyRate+sellRate+holdRate~1)"
  echo "$BODY" | jq '.metrics | { tradeRate, buyRate, sellRate, holdRate }'
  exit 1
fi
echo "OK: rates invariant (tradeRate==buyRate+sellRate, buyRate+sellRate+holdRate~1)"

# 11) prePersistHistogram must exist and match persistedHistogram (debug correctness)
PRE_PERSIST=$(echo "$BODY" | jq -c '.debug.prePersistHistogram // empty')
if [ -z "$PRE_PERSIST" ] || [ "$PRE_PERSIST" = "null" ]; then
  echo "FAIL: prePersistHistogram must exist (not null) for a run created by the worker"
  echo ""
  echo "ACTIONABLE FIX:"
  echo "  1. Check migration integrity: pnpm verify:db"
  echo "  2. Ensure every folder under packages/db/prisma/migrations/ has migration.sql (fix P3015 if broken)"
  echo "  3. Apply migrations: pnpm --filter @crowdvest/db migrate:deploy"
  echo "  4. Re-run simulation: pnpm --filter worker sim:smoke"
  echo ""
  echo "DEBUG: prePersistHistogram is null or missing (RunDebug table may not exist)"
  exit 1
fi
PRE_BUY=$(echo "$BODY" | jq -r '.debug.prePersistHistogram.BUY // -1')
PRE_SELL=$(echo "$BODY" | jq -r '.debug.prePersistHistogram.SELL // -1')
PRE_HOLD=$(echo "$BODY" | jq -r '.debug.prePersistHistogram.HOLD // -1')
PERS_BUY=$(echo "$BODY" | jq -r '.debug.persistedHistogram.BUY // -1')
PERS_SELL=$(echo "$BODY" | jq -r '.debug.persistedHistogram.SELL // -1')
PERS_HOLD=$(echo "$BODY" | jq -r '.debug.persistedHistogram.HOLD // -1')
if [ "$PRE_BUY" != "$PERS_BUY" ] || [ "$PRE_SELL" != "$PERS_SELL" ] || [ "$PRE_HOLD" != "$PERS_HOLD" ]; then
  echo "FAIL: prePersistHistogram must equal persistedHistogram (BUY=$PRE_BUY vs $PERS_BUY, SELL=$PRE_SELL vs $PERS_SELL, HOLD=$PRE_HOLD vs $PERS_HOLD)"
  echo "DEBUG: prePersistHistogram:"
  echo "$BODY" | jq '.debug.prePersistHistogram'
  echo "DEBUG: persistedHistogram:"
  echo "$BODY" | jq '.debug.persistedHistogram'
  exit 1
fi
echo "OK: prePersistHistogram exists and matches persistedHistogram"

# 12) totalSell >= 1 (expected sells in standard run)
TOTAL_SELL=$(echo "$BODY" | jq -r '.metrics.totalSell // 0')
if [ "$TOTAL_SELL" -lt 1 ]; then
  echo "FAIL: Expected sells in standard run (metrics.totalSell=$TOTAL_SELL)"
  echo "DEBUG: decisionHistogram (sim-core output):"
  echo "$BODY" | jq '.debug.decisionHistogram // {}'
  echo "DEBUG: prePersistHistogram (in-memory before DB write):"
  echo "$BODY" | jq '.debug.prePersistHistogram // {}'
  echo "DEBUG: persistedHistogram (from DB):"
  echo "$BODY" | jq '.debug.persistedHistogram // {}'
  echo "DEBUG: sampleDecisions (first 10):"
  echo "$BODY" | jq '.debug.sampleDecisions // []'
  echo "DEBUG: samplePrePersistActions (first 10):"
  echo "$BODY" | jq '.debug.samplePrePersistActions // []'
  echo "DEBUG: sampleActions (first 10):"
  echo "$BODY" | jq '.debug.sampleActions // []'
  if [ "$(echo "$BODY" | jq -r '.debug.mappingNotes // empty')" != "" ]; then
    echo "DEBUG: mappingNotes: $(echo "$BODY" | jq -r '.debug.mappingNotes')"
  fi
  exit 1
fi
echo "OK: totalSell >= 1 ($TOTAL_SELL)"

# 13) Warnings must NOT contain NO_SELL_ACTIONS or EXTREME_BUY_BIAS
WARNINGS_JSON=$(echo "$BODY" | jq -r '.warnings // []')
if echo "$WARNINGS_JSON" | jq -e 'index("NO_SELL_ACTIONS") != null' >/dev/null 2>&1; then
  echo "FAIL: warnings must NOT contain NO_SELL_ACTIONS"
  echo "$BODY" | jq '.warnings'
  exit 1
fi
if echo "$WARNINGS_JSON" | jq -e 'index("EXTREME_BUY_BIAS") != null' >/dev/null 2>&1; then
  echo "FAIL: warnings must NOT contain EXTREME_BUY_BIAS"
  echo "$BODY" | jq '.warnings'
  exit 1
fi
echo "OK: no NO_SELL_ACTIONS or EXTREME_BUY_BIAS in warnings"

# 14) Print RUN_ID and warnings (warnings do not fail the script)
RESULT_RUN_ID=$(echo "$BODY" | jq -r '.runId // empty')
WARNINGS=$(echo "$BODY" | jq -r '.warnings // [] | .[]' 2>/dev/null || true)
echo "---"
echo "RUN_ID=$RESULT_RUN_ID"
if [ -n "$WARNINGS" ]; then
  echo "WARNINGS:"
  echo "$WARNINGS" | while read -r w; do echo "  - $w"; done
else
  echo "WARNINGS: (none)"
fi
echo "---"
echo "Gate PASSED"
