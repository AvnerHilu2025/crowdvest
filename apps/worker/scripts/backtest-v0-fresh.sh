#!/usr/bin/env bash
# backtest-v0-fresh: Create a new run, import CSV, run backtest-v0, mark FAILED on error.
# Usage: ./scripts/backtest-v0-fresh.sh [--steps 29] [--agents 200] [--seeds 3] [--assetSymbol SPY] [--csv path]
# Defaults: steps=29, agents=200, seeds=3, assetSymbol=SPY, csv=apps/worker/data/market/spy.us.daily.sample.csv

set -e
API="${API_BASE:-http://localhost:4001}"
WORKER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$WORKER_ROOT/../.." && pwd)"
cd "$REPO_ROOT"
CSV="${CSV:-$WORKER_ROOT/data/market/spy.us.daily.sample.csv}"
STEPS="${STEPS:-29}"
AGENTS="${AGENTS:-200}"
SEEDS="${SEEDS:-3}"
SEED_START="${SEED_START:-1}"
ASSET="${ASSET_SYMBOL:-SPY}"

# Parse optional overrides from args
while [[ $# -gt 0 ]]; do
  case $1 in
    --steps) STEPS="$2"; shift 2 ;;
    --agents) AGENTS="$2"; shift 2 ;;
    --seeds) SEEDS="$2"; shift 2 ;;
    --seedStart) SEED_START="$2"; shift 2 ;;
    --assetSymbol) ASSET="$2"; shift 2 ;;
    --csv) CSV="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "[backtest-v0-fresh] Creating new run..."
RUN_JSON=$(curl -fsS -X POST "$API/runs" -H "Content-Type: application/json" -d "{\"name\":\"backtest-fresh-$(date +%s)\"}")
RUN_ID=$(echo "$RUN_JSON" | jq -r '.id')
if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "[backtest-v0-fresh] POST /runs did not return id"
  exit 1
fi
echo "[backtest-v0-fresh] runId=$RUN_ID"

echo "[backtest-v0-fresh] Importing market CSV..."
pnpm -C apps/worker run import-market-csv -- \
  --runId "$RUN_ID" \
  --assetSymbol "$ASSET" \
  --csv "$CSV" \
  --priceField close

echo "[backtest-v0-fresh] Running backtest-v0..."
if pnpm -C apps/worker run backtest-v0 -- \
  --runId "$RUN_ID" \
  --assetSymbol "$ASSET" \
  --steps "$STEPS" \
  --agents "$AGENTS" \
  --seedStart "$SEED_START" \
  --seeds "$SEEDS" \
  --csv "$CSV" \
  --priceField close; then
  echo "[backtest-v0-fresh] Done. Run $RUN_ID finalized."
else
  echo "[backtest-v0-fresh] backtest-v0 failed. Marking run FAILED..."
  curl -fsS -X PATCH "$API/runs/$RUN_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"FAILED"}' || true
  exit 1
fi

echo "[backtest-v0-fresh] Verify: curl -sS $API/runs/$RUN_ID | jq '{ status, finishedAt }'"
