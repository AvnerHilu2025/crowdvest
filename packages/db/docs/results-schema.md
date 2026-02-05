# Results schema: design and scale

Database schema for storing the **Results Data Model** (run → agent results → aggregates). Append-only; indexed for `run_id` and `archetype_id`.

---

## Tables

| Table | Purpose | Rows (order of magnitude) |
|-------|---------|---------------------------|
| **ResultRun** | One row per simulation run (id, timestamp, config hash, status, steps). | 1 per run |
| **ResultAgent** | One row per (run, agent): rolled-up pnl, risk, reward, action counts. | runs × agents |
| **ResultAggregate** | One row per aggregate: scope 0=global, 1=run, 2=archetype; shared numeric metrics. | 1 global + 1 per run + (runs × archetypes) or (archetypes) for global archetype |

---

## Indexing strategy

- **ResultRun**
  - `id` (PK).
  - `timestamp` — time-range queries (e.g. “runs in last 24h”).
  - `configHash` — find runs by config (reproducibility).
  - `createdAt` — append order / “latest N runs”.

- **ResultAgent**
  - `(runId, agentId)` UNIQUE — one result per (run, agent); append-only insert, no update.
  - `runId` — “all agent results for run X” (main query).
  - `archetypeId` — “all results for archetype Y” (across runs).
  - `(runId, archetypeId)` — “agent results for run X and archetype Y”.
  - `createdAt` — ordering / pruning by age.

- **ResultAggregate**
  - `runId` — “aggregates for run X” (scope=1).
  - `archetypeId` — “aggregates for archetype Y” (scope=2).
  - `scope` — filter by global / run / archetype.
  - `(scope, runId)` — run-level aggregate (scope=1, runId set).
  - `(scope, archetypeId)` — archetype aggregates (scope=2).
  - `createdAt` — “latest global snapshot” or pruning.

No overwrites: only `INSERT`. Use `ON CONFLICT DO NOTHING` or application checks where uniqueness applies (e.g. one agent result per (run_id, agent_id)).

---

## Scale implications

- **ResultRun**  
  Grows with number of runs. Indexes on `timestamp` and `configHash` stay small (one row per run). No hot updates.

- **ResultAgent**  
  Dominant size: `O(runs × agents)` (e.g. 10k runs × 500 agents = 5M rows).  
  - Indexes on `run_id` and `archetype_id` support the main filters; composite `(run_id, archetype_id)` helps “run + archetype” queries.  
  - Append-only and no updates keep write path simple and avoid row churn.  
  - For very large histories, partition by `run_id` or time (e.g. `createdAt`) and archive old partitions.

- **ResultAggregate**  
  Much smaller: one row per run (scope=1), one per (run, archetype) or per archetype (scope=2), plus global (scope=0).  
  - Indexes on `run_id` and `archetype_id` (and scope) keep “by run” and “by archetype” queries fast.  
  - If global/archetype snapshots are written repeatedly, consider retaining only the latest (e.g. by `createdAt`) or pruning old snapshots in a batch job.

- **Append-only**  
  No `UPDATE`/`DELETE` on result rows reduces locking and keeps history immutable. Retention/archival can be done by dropping or moving partitions, or by soft-delete columns if needed later.

---

## SQL file

- **Schema + indexes:** `packages/db/prisma/sql/results_schema.sql`  
  Run against the same DB as the main Prisma schema (or a dedicated results DB if you split later).  
  Does not modify existing `SimulationRun` / `AgentExperience` / `CrowdSnapshot` tables; these remain the operational pipeline; the results schema is for stored Results Data Model outputs.
