# Humanization Layer v1 — Smoke Test Commands

Run these commands from WSL (API and DB must be up).

## Prerequisites

```bash
# Start API + DB if needed
pnpm dev
# or: docker-compose up -d
```

## 1. Generate 100 agents (overwrite=true to replace existing)

```bash
curl -sS -X POST "http://localhost:4001/agents/generate?overwrite=true" \
  -H "Content-Type: application/json" \
  -d '{"count":100,"seed":42}' | jq .
# Save RUN_ID from .runId. Response: createdCount, existingCount, total, overwritten
```

## 1b. Verify biases/humanState on one agent

```bash
AGENT_ID=$(curl -sS "http://localhost:4001/agents?runId=<RUN_ID>&limit=1" | jq -r '.items[0].id')
curl -sS "http://localhost:4001/agents/$AGENT_ID" | jq '{biases, humanState}'
# Should show non-null biases (herding, lossAversion, etc.) and humanState (attentionLevel, fatigue, etc.)
```

## 1c. Overwrite=false does not add agents

```bash
curl -sS -X POST "http://localhost:4001/agents/generate?runId=<RUN_ID>&overwrite=false" \
  -H "Content-Type: application/json" \
  -d '{"count":100,"seed":42}' | jq .
# Expect: createdCount=0, total=100, overwritten=false
```

## 2. Decide 20 steps (overwrite)

```bash
pnpm -C apps/worker run decide -- --runId <RUN_ID> --steps 20 --seed 123 --overwrite
```

## 3. Compute crowd metrics

```bash
pnpm -C apps/worker run compute-crowd-metrics -- --runId <RUN_ID> --assetSymbol RUN
```

## 4. Fetch crowd-state

```bash
curl -sS "http://localhost:4001/results/crowd-state?runId=<RUN_ID>&assetSymbol=RUN" | jq .
```

## 5. Fetch step 0 and step 1 decisions (histogram + avgConfidence)

```bash
curl -sS "http://localhost:4001/results/decisions?run_id=<RUN_ID>&step=0&assetSymbol=RUN" | jq .
curl -sS "http://localhost:4001/results/decisions?run_id=<RUN_ID>&step=1&assetSymbol=RUN" | jq .
```

## 6. Determinism check — re-run decide with same seed

```bash
pnpm -C apps/worker run decide -- --runId <RUN_ID> --steps 20 --seed 123 --overwrite
# Compare histograms with step 5; should be identical.
```

## 7. Seed change — different behavior

```bash
pnpm -C apps/worker run decide -- --runId <RUN_ID> --steps 20 --seed 999 --overwrite
# Histograms should differ from step 5/6.
```

## Full smoke script

```bash
./scripts/humanization_layer_smoke.sh [http://localhost:4001]
```
