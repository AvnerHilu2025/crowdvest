# Results Quality Gate — verification steps

Base URL: `http://localhost:4001` (or set `API_BASE`).

## 1. Health

```bash
curl -sS http://localhost:4001/health
# Expect: 200 and healthy response
```

## 2. List runs (get latest run id)

```bash
curl -sS "http://localhost:4001/results/runs?limit=1" | jq .
# From response: items[0].id is the latest run_id
```

## 3. Summary compact (by run_id)

Replace `<run_id>` with a UUID from step 2.

```bash
RUN_ID="<run_id>"
curl -sS "http://localhost:4001/results/summary-compact?run_id=$RUN_ID" | jq .
```

Expected shape: `runId`, `metrics` (agentCount, totalPnl, avgPnl, avgRisk, totalSteps, avgStepsPerAgent, totalBuy, totalSell, totalHold, totalReward, avgReward), `validation`, `archetypeTotals`, `warnings` (array of strings).

## 4. Cross-check with full summary

Metrics and validation in summary-compact must match `/results/summary` for the same run:

```bash
curl -sS "http://localhost:4001/results/summary?run_id=$RUN_ID" | jq '{ run: .run, byArchetype: .byArchetype | length }'
# run.metrics and run.validation should match summary-compact metrics/validation
```

## 5. Run the gate script

The script fetches the latest run from `/results/runs`, calls `/health` and `/results/summary-compact`, then checks invariants. Warnings are printed but do not fail the script.

```bash
# From repo root
pnpm verify:run

# Or with custom API base
API_BASE=http://localhost:4001 pnpm verify:run
```

Invariants checked:

1. Health returns 200  
2. `metrics.agentCount` > 0  
3. `totalSteps` ≈ `agentCount * avgStepsPerAgent` (tolerance 1e-6)  
4. `totalBuy + totalSell + totalHold` == `totalSteps`  
5. `validation.totalPnlSum` == `metrics.totalPnl` (tolerance 1e-9)  
6. `archetypeTotals.agentCountSum` == `metrics.agentCount`  
7. `|archetypeTotals.totalPnlSum - metrics.totalPnl|` < 1e-9  

## Warnings (informational)

| Code | Condition |
|------|------------|
| NO_SELL_ACTIONS | totalSell == 0 |
| LOW_TRADE_RATE | (totalBuy+totalSell)/totalSteps < 0.05 |
| HIGH_HOLD_RATIO | totalHold/totalSteps > 0.90 |
| ALL_AGENTS_LOSING | pctProfitableAgents == 0 |
| RISK_TOO_LOW | avgRisk < 1e-8 |
