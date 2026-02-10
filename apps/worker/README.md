# Worker (CrowdVest)

NestJS worker app. Simulation is run via a CLI command (no queue for now).

## Environment

- **DATABASE_URL** (required): PostgreSQL connection URL. Loaded from repo root `.env` or `apps/worker/.env`. If missing, `sim:run` throws a clear error with `process.cwd()`.

## Simulation CLI

Run a simulation that creates a `SimulationRun`, N `Agent`s, `AgentExperience` per step, and `CrowdSnapshot` per step.

```bash
pnpm --filter worker sim:run -- --name "test-run" --agents 200 --steps 30 [--datasetVersion <hash>]
```

- **--name** (default: `test-run`): Run name (unique per datasetVersion).
- **--agents** (default: 200): Number of agents.
- **--steps** (default: 30): Number of steps.
- **--datasetVersion** (optional): Dataset version to use; if omitted, resolved automatically (see below).

### datasetVersion resolution

1. If `--datasetVersion` is provided, it is used.
2. Else: **latest `SimulationRun.datasetVersion`** (by `createdAt` desc) — canonical "current dataset" for runs.
3. Else: latest archetype **`ImportRun.sourceHash`** (by `startedAt` desc).

This matches the API notion of "latest" dataset. Run seed first so archetypes and a `SimulationRun` (or `ImportRun`) exist.

### Flow

1. Resolve datasetVersion (see above).
2. Load archetypes and archetype trait profiles from DB.
3. Create `SimulationRun` (status PENDING, startedAt set).
4. Create N agents: uniform archetype assignment, `stateJson = { wallet: 10000 }` (batch: `createManyAndReturn`).
5. For each step:
   - Sample market return (normal mean 0.0005, stdev 0.01) from `@crowdvest/sim-core`.
   - Run step: per-agent action (buy/sell/hold) from traits (`risk_appetite`, `patience`, `trading_frequency`, `news_sensitivity`), reward, wallet update.
   - Batch insert `AgentExperience` (`createMany`).
   - Insert `CrowdSnapshot` (one row per step).
6. Update run: status COMPLETED, finishedAt set.

Simulation logic lives in **packages/sim-core** (market return, action, reward, `runStep`); worker handles DB and CLI.

## How to run

From repo root (with Postgres up and `DATABASE_URL` in `.env`):

```bash
pnpm --filter worker sim:run -- --name "my-run" --agents 50 --steps 10
```

From `apps/worker`:

```bash
pnpm sim:run -- --name "my-run" --agents 50 --steps 10
```

## How to validate

- **API**: After a run, `GET /runs` and `GET /runs?limit=1` to see the latest run; `GET /datasets` for dataset versions.
- **SQL** (Postgres):

```sql
-- Latest run
SELECT id, name, status, "datasetVersion", "startedAt", "finishedAt"
FROM "SimulationRun"
ORDER BY "createdAt" DESC
LIMIT 1;

-- Experience count per run
SELECT "runId", COUNT(*) AS experiences
FROM "AgentExperience"
GROUP BY "runId"
ORDER BY "runId" DESC
LIMIT 5;

-- Snapshot count per run
SELECT "runId", COUNT(*) AS snapshots
FROM "CrowdSnapshot"
GROUP BY "runId"
ORDER BY "runId" DESC
LIMIT 5;
```

Expect: one `SimulationRun` per `sim:run`, N agents, `steps × N` `AgentExperience` rows, `steps` `CrowdSnapshot` rows.

---

## Settlement CLI (v1)

Settle OPEN bets for a run at a given close step using the same market truth as simulation results (RunTimeSeries / AgentExperience + CrowdSnapshot).

```bash
pnpm -C apps/worker run settle -- --runId <uuid> --closeStep <int> [--force]
```

- **--runId** (required): Run UUID. Run must exist and have market data (RunTimeSeries or crowd snapshots so the script can derive the curve).
- **--closeStep** (required): Non-negative integer. Only bets with `openStep <= closeStep` are considered.
- **--force** (optional): Re-settle already SETTLED bets (recompute pnl). CANCELLED bets are never changed.

Summary log (all counters unambiguous):

- **openFoundCount**: Eligible OPEN bets found (runId + openStep ≤ closeStep).
- **alreadySettledCount**: Bets already SETTLED and skipped (not updated unless `--force`).
- **settledCount**: Bets updated in this run (OPEN → SETTLED, or SETTLED re-settled with `--force`).
- **skippedCount**: Bets not touched (e.g. CANCELLED or unknown status).
- **forcedCount**: SETTLED bets re-settled this run (only when `--force`).
- **totalPnl**: Sum of pnl for bets updated this run.

Idempotent: without `--force`, only OPEN bets are processed; already SETTLED bets are skipped. Exit code 1 on invalid args, missing run, or missing market data.

---

## Product Checks (Settlement + API) — WSL

From repo root, with Postgres up, `DATABASE_URL` in `.env`, and API at `http://localhost:4001`.

**1) Create 1 OPEN bet (assetSymbol RUN)**

```bash
USER_ID="480117fb-d641-4afe-9d32-63310ff14511"
RUN_ID="<your-run-uuid>"

curl -s -X POST http://localhost:4001/bets \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"runId\":\"$RUN_ID\",\"assetSymbol\":\"RUN\",\"direction\":\"BUY\",\"amount\":10,\"openStep\":0}" | jq .
```

**2) Run settle (first time)**

```bash
pnpm -C apps/worker run settle -- --runId "$RUN_ID" --closeStep 10
```

Expect: `openFoundCount=1 alreadySettledCount=0 settledCount=1 skippedCount=0 forcedCount=0 totalPnl=...`. Non-zero exit if run not found or missing market data.

**3) Run settle again (second run — idempotency)**

```bash
pnpm -C apps/worker run settle -- --runId "$RUN_ID" --closeStep 10
```

Expect: **alreadySettledCount=1** (or N if you had N settled bets), **settledCount=0**, and no DB changes. Summary line should look like: `openFoundCount=0 alreadySettledCount=1 settledCount=0 skippedCount=0 forcedCount=0 totalPnl=0`.

**4) Verify via GET /bets (status SETTLED + pnl set)**

```bash
curl -s "http://localhost:4001/bets?userId=USER_UUID&limit=50" | jq '.items[] | {id, status, pnl, closePrice, closeStep}'
```

**5) Verify key /results endpoints still work**

```bash
curl -s "http://localhost:4001/results/runs?limit=1" | jq .
curl -s "http://localhost:4001/results/agents?run_id=RUN_UUID" | jq '.items | length'
```

---

## Crowd Wisdom Quality — smoke test

Generate agents, run decide, compute crowd metrics, then assert `perStep[0]` has `diversityIndex`, `independenceIndex`, `wisdomScore`:

```bash
API="${API:-http://localhost:4001}"
RUN_ID="$(curl -s "$API/runs?limit=1" | jq -r '.items[0].id')"
# Or create run + agents: POST /agents/generate?runId=...&overwrite=true

# Generate 200 agents, decide 5 steps, compute metrics
curl -s -X POST "$API/agents/generate?runId=$RUN_ID&overwrite=true"
pnpm -C apps/worker run decide -- --runId "$RUN_ID" --steps 5 --assetSymbol RUN --seed 123 --overwrite --allowSmallCrowd
pnpm -C apps/worker run compute-crowd-metrics -- --runId "$RUN_ID" --assetSymbol RUN

# Assert crowd-state perStep[0] has wisdom fields
curl -s "$API/results/crowd-state?runId=$RUN_ID&assetSymbol=RUN" | jq '.perStep[0] | {diversityIndex, independenceIndex, wisdomScore}'
# Expect: diversityIndex, independenceIndex, wisdomScore present (numbers or null)
```
