#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:4001"
ASSET="SPY"

AGENT_SCALES=(50 200 1000 2000)
SEEDS=(1 2 3)

echo "=============================================="
echo "CrowdVest Hardening Suite"
echo "=============================================="

fail=0

run_one() {
  agents=$1
  seed=$2

  echo ""
  echo "----------------------------------------------"
  echo "Agents=$agents  Seed=$seed"
  echo "----------------------------------------------"

  start_time=$(date +%s)

  # create unique run
  RUN_NAME="hardening-${agents}-${seed}-$(date +%s)"
  RUN_ID=$(curl -s -X POST "$API/runs/create-unique" \
    -H "content-type: application/json" \
    -d "{\"baseName\":\"$RUN_NAME\",\"datasetVersion\":\"spy29\"}" \
    | jq -r '.runId // .id')

  if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
    echo "Failed to create run"
    fail=1
    return
  fi

  echo "RunId=$RUN_ID"

  # import dataset (use /runs/:runId/import to avoid spy29 auto-enqueue with default 50 agents)
  curl -s -X POST "$API/runs/$RUN_ID/import" \
    -H "content-type: application/json" \
    -d "{\"assetSymbol\":\"$ASSET\",\"steps\":29,\"source\":\"default\"}" > /dev/null

  # run worker explicitly with scale (blocks until completion)
  if ! pnpm -C apps/worker run backtest-v0 -- \
    --runId "$RUN_ID" \
    --assetSymbol "$ASSET" \
    --steps 29 \
    --agents "$agents" \
    --seedStart "$seed" \
    --seeds 1 \
    --overwrite true; then
    echo "Worker FAILED"
    fail=1
    return
  fi

  # run crowd wisdom check
  if RUN_ID="$RUN_ID" API="$API" ASSET="$ASSET" node scripts/crowd-wisdom-check.mjs > tmp.json 2>&1; then
    duration=$(( $(date +%s) - start_time ))
    independence=$(jq -r '.report.independence_avgAbsCorr' tmp.json)
    diversity=$(jq -r '.report.diversity_medEntropy_norm01' tmp.json)
    advantage=$(jq -r '.report.crowdAdvantage_delta' tmp.json)
    echo "agents=$agents seed=$seed duration=${duration}s independence=$independence diversity=$diversity advantage=$advantage"
  else
    echo "Crowd wisdom check FAILED"
    cat tmp.json
    fail=1
  fi
}

for agents in "${AGENT_SCALES[@]}"; do
  for seed in "${SEEDS[@]}"; do
    run_one "$agents" "$seed"
  done
done

echo ""
echo "=============================================="
if [[ $fail -eq 0 ]]; then
  echo "HARDENING SUITE PASSED"
  exit 0
else
  echo "HARDENING SUITE FAILED"
  exit 1
fi
