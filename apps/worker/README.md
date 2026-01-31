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
