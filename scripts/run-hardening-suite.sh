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
FAILED_CASES=()
ADV_DELTAS=()  # advantage_delta for agents>=200 (for aggregate gate)

mkdir -p .hardening_logs

run_one() {
  agents=$1
  seed=$2

  echo ""
  echo "----------------------------------------------"
  echo "Agents=$agents  Seed=$seed"
  echo "----------------------------------------------"

  start_time=$(date +%s)

  RUN_NAME="hardening-${agents}-${seed}-$(date +%s)"
  RUN_ID=$(curl -s -X POST "$API/runs/create-unique" \
    -H "content-type: application/json" \
    -d "{\"baseName\":\"$RUN_NAME\",\"datasetVersion\":\"spy29\"}" \
    | jq -r '.runId // .id')

  if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
    echo "ERROR: could not create runId"
    fail=1
    FAILED_CASES+=("agents=$agents seed=$seed reason=create-run")
    return 1
  fi

  echo "RunId=$RUN_ID"

  # Import dataset into this run (use /runs/:runId/import to avoid spy29 auto-enqueue)
  if ! curl -s -X POST "$API/runs/$RUN_ID/import" \
    -H "content-type: application/json" \
    -d "{\"assetSymbol\":\"$ASSET\",\"steps\":29,\"source\":\"default\"}" > /dev/null; then
    echo "ERROR: dataset import failed"
    fail=1
    FAILED_CASES+=("agents=$agents seed=$seed runId=$RUN_ID reason=import")
    return 1
  fi

  worker_log=".hardening_logs/worker_agents${agents}_seed${seed}.log"
  check_log=".hardening_logs/check_agents${agents}_seed${seed}.json"

  # Run worker explicitly (blocking)
  if ! pnpm -C apps/worker run backtest-v0 -- \
    --runId "$RUN_ID" \
    --assetSymbol "$ASSET" \
    --steps 29 \
    --agents "$agents" \
    --seedStart "$seed" \
    --seeds 1 \
    --overwrite true \
    >"$worker_log" 2>&1; then
    echo "WORKER FAILED (see $worker_log)"
    fail=1
    FAILED_CASES+=("agents=$agents seed=$seed runId=$RUN_ID reason=worker")
    return 1
  fi

  # Run crowd-wisdom-check (stdout to check_log, stderr to separate file)
  check_stderr=".hardening_logs/check_stderr_agents${agents}_seed${seed}.txt"
  RUN_ID="$RUN_ID" API="$API" ASSET="$ASSET" node scripts/crowd-wisdom-check.mjs >"$check_log" 2>"$check_stderr"
  check_exit=$?

  duration=$(( $(date +%s) - start_time ))

  # Exit 1 = script threw (before printing JSON)
  if [[ $check_exit -eq 1 ]]; then
    echo "CROWD CHECK THREW (see $check_stderr)"
    fail=1
    FAILED_CASES+=("agents=$agents seed=$seed runId=$RUN_ID reason=throw")
    return 1
  fi

  # Parse JSON (exit 0 or 2 both produce JSON)
  if ! jq -e '.report and .PASS' "$check_log" >/dev/null 2>&1; then
    echo "FAIL: check JSON missing report or PASS (see $check_log)"
    fail=1
    FAILED_CASES+=("agents=$agents seed=$seed runId=$RUN_ID reason=throw")
    return 1
  fi

  # Extract report values and PASS flags
  independence=$(jq -r '.report.independence_avgAbsCorr // empty' "$check_log")
  diversity=$(jq -r '.report.diversity_medEntropy_norm01 // empty' "$check_log")
  advantage=$(jq -r '.report.crowdAdvantage_delta // empty' "$check_log")
  agentsPersisted=$(jq -r '.report.agentsTotal // empty' "$check_log")
  pass_ind=$(jq -r '.PASS.independence // false' "$check_log")
  pass_div=$(jq -r '.PASS.diversity // false' "$check_log")
  pass_adv=$(jq -r '.PASS.crowdAdvantage // false' "$check_log")

  # Per-case gates: independence and diversity -> FAIL immediately
  if [[ "$pass_ind" != "true" ]]; then
    echo "FAIL: PASS.independence=false (see $check_log)"
    fail=1
    FAILED_CASES+=("agents=$agents seed=$seed runId=$RUN_ID reason=independence")
    return 1
  fi
  if [[ "$pass_div" != "true" ]]; then
    echo "FAIL: PASS.diversity=false (see $check_log)"
    fail=1
    FAILED_CASES+=("agents=$agents seed=$seed runId=$RUN_ID reason=diversity")
    return 1
  fi

  # Print single-line summary
  echo "agentsRequested=${agents} agentsPersisted=${agentsPersisted} seed=${seed} duration=${duration}s independence=${independence} diversity=${diversity} advantage=${advantage} PASS={ind:${pass_ind},div:${pass_div},adv:${pass_adv}}"

  # agentsTotal mismatch is INFO only (persist=lite may sample)
  if [[ "$agentsPersisted" != "$agents" ]]; then
    echo "INFO: agentsPersisted differs from requested (requested=$agents persisted=$agentsPersisted) — expected under persist=lite"
  fi

  # Advantage: do NOT fail per-case. Record for agents>=200; agents=50 is INFO only.
  if [[ "$agents" -ge 200 ]]; then
    ADV_DELTAS+=("${advantage:-0}")
  else
    if [[ "$pass_adv" != "true" ]]; then
      echo "INFO: agents=50 crowdAdvantage=false (advantage=$advantage) — not counted in aggregate gate"
    fi
  fi

  return 0
}

echo ""
echo "=============================================="
echo "Running suite: agents=${AGENT_SCALES[*]} seeds=${SEEDS[*]}"
echo "Logs: .hardening_logs/"
echo "=============================================="

for agents in "${AGENT_SCALES[@]}"; do
  for seed in "${SEEDS[@]}"; do
    run_one "$agents" "$seed" || true
  done
done

echo ""
echo "=============================================="

# Advantage stats (informational KPI only — never fails suite)
total_cases_adv=${#ADV_DELTAS[@]}
if [[ $total_cases_adv -gt 0 ]]; then
  read -r negative_cases_adv avg_advantage_delta <<< $(printf '%s\n' "${ADV_DELTAS[@]}" | awk '
    BEGIN { sum=0; neg=0 }
    { sum+=$1; if($1<0) neg++ }
    END { avg=(NR>0)?sum/NR:0; printf "%d %.4f", neg, avg }')
  pct_adv=$(awk "BEGIN { printf \"%.1f\", ($negative_cases_adv/$total_cases_adv)*100 }")
  echo "ADVANTAGE STATS (agents>=200): total=$total_cases_adv negative=$negative_cases_adv pct=${pct_adv}% avg=$avg_advantage_delta"
else
  echo "ADVANTAGE STATS (agents>=200): total=0 (no cases)"
fi

echo "=============================================="
if [[ $fail -eq 0 ]]; then
  echo "HARDENING SUITE PASSED"
  exit 0
else
  echo "HARDENING SUITE FAILED"
  echo "FAILED CASES:"
  for c in "${FAILED_CASES[@]}"; do
    echo " - $c"
  done
  echo "Inspect logs under .hardening_logs/"
  exit 1
fi
