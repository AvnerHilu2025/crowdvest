# CrowdVest Results Data Model

Minimal, explicit data model for the simulation pipeline (run → summary → verify → CI). All metrics are **numeric**; no derived text.

---

## Separation: Raw vs Aggregated

| Layer | Purpose | Entities |
|-------|---------|----------|
| **Raw results** | Per-run and per-agent outputs from the pipeline; one row per run, one row per (run, agent). | `SimulationRunResult`, `AgentResult` |
| **Aggregated results** | Rollups for reporting: by run, by archetype, and global. All fields are numeric. | `RunAggregate`, `ArchetypeAggregate`, `GlobalAggregate` |

---

## 1. Raw results

### SimulationRunResult

Run-level identity and config; maps to one `SimulationRun` in the DB.

| Field | Type | Description |
|-------|------|--------------|
| `id` | string (UUID) | Run identifier. |
| `timestamp` | number | Run creation time (ms since epoch or ISO numeric). |
| `configHash` | string | Hash of run config (seed, steps, modelVersion, datasetVersion) for reproducibility. |
| `name` | string (optional) | Display name (e.g. `ci-20260131-120000`). |
| `status` | number | Status code: 0=PENDING, 1=RUNNING, 2=COMPLETED, 3=FAILED. |
| `steps` | number | Number of simulation steps executed. |

### AgentResult

Per-agent rolled-up result for a single run; one record per (run, agent).

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string (UUID) | Agent identifier. |
| `archetypeId` | string (UUID) | Archetype the agent belongs to. |
| `runId` | string (UUID) | Run this result belongs to. |
| `steps` | number | Number of steps this agent participated in. |
| `durationMs` | number | Wall-clock or simulated duration in milliseconds. |
| `pnl` | number | Total PnL over the run (sum of step deltas). |
| `risk` | number | Risk metric: max fractional drawdown 0..1 over the run. |
| `totalReward` | number | Sum of step rewards. |
| `actionCounts` | ActionCounts | Counts of buy, sell, hold actions (all numeric). |

### ActionCounts

| Field | Type | Description |
|-------|------|-------------|
| `buy` | number | Count of buy actions. |
| `sell` | number | Count of sell actions. |
| `hold` | number | Count of hold actions. |

---

## 2. Aggregated results

All aggregate types use the same **AggregateMetrics** shape so rollups are consistent and numeric-only.

### AggregateMetrics (shared)

| Field | Type | Description |
|-------|------|-------------|
| `agentCount` | number | Number of agents in this aggregate. |
| `totalPnl` | number | Sum of agent PnLs. |
| `avgPnl` | number | Mean PnL per agent. |
| `avgRisk` | number | Mean of agent max drawdowns (0..1). |
| `totalSteps` | number | Total steps across agents. |
| `avgStepsPerAgent` | number | Mean steps per agent. |
| `totalBuy` | number | Sum of buy actions. |
| `totalSell` | number | Sum of sell actions. |
| `totalHold` | number | Sum of hold actions. |
| `totalReward` | number | Sum of rewards. |
| `avgReward` | number | Mean reward per agent. |

### RunAggregate (by run)

One record per run; all agents in that run.

| Field | Type | Description |
|-------|------|-------------|
| `scope` | 1 | Literal 1 = run scope. |
| `runId` | string (UUID) | Run identifier. |
| `metrics` | AggregateMetrics | Numeric metrics for the run. |
| `durationMs` | number (optional) | Run wall-clock duration in ms. |

### ArchetypeAggregate (by archetype)

One record per archetype, optionally scoped to a run.

| Field | Type | Description |
|-------|------|-------------|
| `scope` | 2 | Literal 2 = archetype scope. |
| `archetypeId` | string (UUID) | Archetype identifier. |
| `runId` | string (optional) | If set, aggregate is for this run only; if absent, global across runs. |
| `metrics` | AggregateMetrics | Numeric metrics for the archetype. |

### GlobalAggregate

Single record for all runs and agents.

| Field | Type | Description |
|-------|------|-------------|
| `scope` | 0 | Literal 0 = global scope. |
| `runCount` | number | Number of runs included. |
| `metrics` | AggregateMetrics | Numeric metrics across all agents/runs. |

---

## 3. Payloads (export/API)

- **RawResultsPayload**: `{ run: SimulationRunResult, agents: AgentResult[] }` — one run and its agent results.
- **AggregatedResultsPayload**: `{ global?: GlobalAggregate, byRun: RunAggregate[], byArchetype: ArchetypeAggregate[] }` — all rollups in one response.

---

## 4. TypeScript / JSON

- **TypeScript**: `packages/shared/src/schemas/results-model.ts` — interfaces and types.
- **Usage**: Import from `@crowdvest/shared` (after exporting from the package).
- **JSON**: Use these interfaces as the contract for JSON export (e.g. sim:export, sim:ci); no separate JSON Schema file is required if TypeScript types are the source of truth.

Metrics are explicit and numeric throughout; no “high/medium/low” or other derived text in the model.
