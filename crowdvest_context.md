# CrowdVest (VINVESTOR / VICWS) — Project Context

> Paste at start of every new chat.

---

## Role / Behavior Contract

- **ChatGPT:** CTO + System Architect
- **Cursor:** Lead Developer
- **Execution style:** Every answer must include: (a) exact file(s) to edit, (b) exact code to paste, (c) exact WSL command(s), (d) verification check(s).
- **No theory** unless explicitly asked.
- **IMPORTANT:** When UI/UX phase begins, add a second role: **Product Designer (Modern Fintech)**. Before starting any UI/UX task, ChatGPT must explicitly say: "Switching to Designer role now" and ask for UI guidelines if not already provided. CTO role remains active always.

---

## Project Overview

- **Product name:** CrowdVest (VINVESTOR / VICWS) — Virtual Investor Crowd Wisdom System.
- **Purpose:** Simulate many autonomous investor agents (archetypes + behavioral traits) to produce crowd signals, run backtests, and show metrics + decisions deterministically.
- **Monorepo:** pnpm workspace.
- **Stack:** NestJS API + Prisma + PostgreSQL, Next.js web, TypeScript worker scripts.

---

## Simulation Model Contract

- **SimulationRun** represents:
  - One datasetVersion
  - One asset universe (currently SPY)
  - One deterministic experiment container

- **RunVariant** represents:
  - One (assetSymbol, seed, agents, steps, label) configuration
  - Variants under same run share datasetVersion
  - Variants are independent compute units
  - Run completes when expectedVariants == completedVariants

- **expectedVariants** = seeds count
- **overwrite=true** recomputes decisions and metrics for variant only
- **SKIP behavior:**
  - If variant exists and overwrite=false → no delete, no recompute
  - decisionsHash must remain unchanged

---

## Agent Generation Model

- Agents are generated per `runVariant` using `(seed, agents)` parameters.
- Agent population must be deterministic for identical `(seed, agents)` inputs.
- `agentIdsHash` must match across identical configurations.
- Agents are NOT shared across different runs.
- Changing `agents` count or `seed` changes agent population deterministically.
- Agent generation must not depend on runtime randomness outside seeded RNG.

---

## Concurrency & Job Model

- Single Node worker process (current)
- Job queue: in-memory (non-durable)
- Only one run executes at a time (queueLen reflects backlog)
- If process crashes → queue lost (acceptable in dev phase)
- **Concurrency target:**
  - Determinism preserved under concurrent run submissions
  - Worker must not run two backtests simultaneously

---

## Canonical Data Ownership

- **RunVariantSummary** = canonical performance metrics (corr, directionalAccuracy)
- **CrowdMetrics** = derived per-step analytics
- **AgentDecision** = immutable once persisted
- **AssetStepReturn** = canonical dataset
- Hashes computed from canonical sources only
- No endpoint may recompute corr dynamically

---

## Results Integrity Rule

- `/results/latest` MUST read from `RunVariantSummary`.
- `/results/summary-compact` MUST read from `RunVariantSummary` and persisted histograms only.
- No endpoint may recompute `corr`, `directionalAccuracy`, or hashes dynamically.
- `AgentDecision` table is immutable once persisted (except overwrite=true explicitly).
- All performance metrics must be persisted before exposure via API.
- Production-grade rule: Results endpoints are read-only projections over persisted state.

---

## Production-Grade Run Definition

A run is considered production-valid only if:

- status == COMPLETED
- completedAt != null
- failedAt == null
- All expectedVariants exist
- decisionsHash != null
- returnsHash != null

**FAILED runs must:**
- Not appear in /results/latest
- Not appear in leaderboard
- Not appear in runs-v2 default list (unless explicitly requested)

---

## Repo Structure

- **Root:** ~/crowdvest
- **apps/api** — NestJS, port 4001
- **apps/web** — Next.js, port 4000
- **apps/worker** — TS scripts (backtest-v0, decide, compute-crowd-metrics, etc.)
- **packages/db** — Prisma schema + generated client
- **packages/shared** — shared types
- **packages/sim-core** — simulation core

---

## Environment

- **WSL Ubuntu** — all commands must run in WSL.
- **Ports:** 4000 (web), 4001 (API).
- **Package manager:** pnpm workspace.
- **Database:** PostgreSQL via `DATABASE_URL` in `.env`.
- **No Docker** in current phase.

---

## Bootstrap Procedure (Fresh Dev Machine)

1. `cd ~/crowdvest`
2. `pnpm install`
3. Ensure Postgres running
4. `pnpm -C apps/api dev`
5. `pnpm -C apps/worker dev`
6. `curl -X POST http://localhost:4001/runs/import/spy29`
7. Verify COMPLETED via `GET /runs/:runId`
8. `chmod +x scripts/test-summary-compact.sh && ./scripts/test-summary-compact.sh`

Purpose: Allow new chat to instantly resume product work.

---

## DB Models / Tables (Prisma)

- **SimulationRun:** id, name, status (PENDING|RUNNING|COMPLETED|FAILED), startedAt, completedAt, failedAt, lastError, seed, modelVersion, datasetVersion, createdAt
- **RunVariant:** id, runId, assetSymbol, seed, agents, steps, label, createdAt
- **RunVariantSummary:** runVariantId, corr, directionalAccuracy, pairsCount; debugDecisionsHash, debugReturnsHash (in summary)
- **AgentDecision:** runId, runVariantId, step, agentId, assetSymbol, action (BUY|SELL|HOLD), confidence
- **CrowdMetrics:** runId, runVariantId, assetSymbol, step, signal, consensus, polarization, etc.
- **AssetStepReturn:** runId, assetSymbol, step, stepReturn
- **RunAgent:** runId, name, archetype, biases
- **AgentState, AgentInfoState, AgentExperience, AgentReward:** per-step agent state and rewards
- **Archetype, TraitDefinition:** reference data

**Important constraints:**
- SimulationRun: `@@unique([name, datasetVersion])`
- RunVariant: `@@unique([runId, assetSymbol, seed, label])` — reusing runId with same label+seed fails; must SKIP or upsert.

---

## Run Lifecycle (Implemented)

PENDING → RUNNING → COMPLETED  
PENDING → RUNNING → FAILED  

**Rules:**
- Worker sets RUNNING when backtest starts.
- Worker finalizes COMPLETED on success, FAILED on error.
- PATCH /runs/:runId/status enforces:
  - COMPLETED → FAILED blocked (409)
  - FAILED → COMPLETED allowed (recovery)
  - completedAt stable (idempotent)
  - failedAt cleared on recovery
  - lastError cleared on recovery

---

## API Surface (Authoritative)

**Runs**
- POST /runs — create run
- POST /runs/import/spy29 — create 29 AssetStepReturn rows, returns { runId }, triggers job when count=29
- POST /runs/create-unique — create run with unique name
- GET /runs?limit=N&offset=N — list runs
- GET /runs/:id — one run (status, startedAt, completedAt, failedAt, lastError)
- GET /runs/:runId/variants?assetSymbol=SPY — list variants with hashes
- PATCH /runs/:runId/status — body: { status, lastError? }

**Jobs**
- GET /jobs/queue — queueLen, runningRunId, lastEvents
- POST /jobs/enqueue — body: { runId }; dev-only or X-Admin-Token

**Results**
- GET /results/latest?assetSymbol=SPY — { run, defaultVariant, summary }
- GET /results/summary-compact?run_id=RUN_ID — histogram + warnings (CI-friendly)
- GET /results/runs-v2?limit=N&offset=N — UI-ready runs list; status matches /runs/:id
- GET /results/summary, /results/decisions, /results/crowd-state, /results/crowd-summary
- GET /results/agent-state, /results/agent-rewards, /results/backtests
- GET /results/run-debug-counts — NODE_ENV !== production or X-Debug: true

**Health**
- GET /health (API)
- GET /api/health (Web proxy)

**Web Proxy**
- 4000/api/* → 4001/*

---

## Worker Scripts & Key Files

- `apps/worker/src/scripts/backtest-v0.ts` — main backtest; SKIPs already-computed variants (no deletes)
- `apps/worker/src/scripts/decide.ts` — decision engine
- `apps/worker/src/scripts/compute-crowd-metrics.ts` — crowd metrics
- `apps/worker/src/scripts/compute-rewards.ts` — agent rewards
- `apps/worker/src/lib/assert-run-exists.ts` — validates run exists before worker runs
- `packages/db/src/set-run-status.ts` — central run status transitions

**Worker command:**
```bash
pnpm -C apps/worker run backtest-v0 -- \
  --runId <RUN_ID> \
  --assetSymbol SPY \
  --steps 29 \
  --agents 50 \
  --seedStart 1 \
  --seeds 2
```

---

## Dataset Rules

- AssetStepReturn rows linked to runId; must exist before backtest.
- steps parameter must equal AssetStepReturn count.
- Dataset import route populates AssetStepReturn.
- Failure to satisfy causes worker error.

---

## Determinism Protocol

1. Run identical backtest twice.
2. Compare decisionsHash, returnsHash, corr.
3. Accept float delta <= 1e-15; diff output must be empty.

**Invariants:**
- SKIP must not delete existing decisions.
- Rerun must preserve decisionsHash + returnsHash.
- No recompute unless overwrite=true.

---

## Hash Philosophy

- **decisionsHash:** ordered deterministic agent decisions (cryptographic hash).
- **returnsHash:** ordered AssetStepReturn rows (cryptographic hash).
- **Float tolerance:** <= 1e-15.
- Hashes are product integrity boundary; ensure reproducibility and audit trail.

---

## Observability Targets

**Future:**
- Persist perf timings per variant
- Store compute duration in RunVariant
- Add metrics table if needed
- Add structured logging contract

---

## Hardening & Verification (Completed)

1. **Determinism:** POST /runs/import/spy29 → wait COMPLETED → GET variants → diff hashes. Outcome: DETERMINISM_OK
2. **Queue:** POST 3 parallel imports → /jobs/queue shows queueLen>0, runningRunId. Outcome: queue works
3. **backtest-v0 rerun:** SKIPs already-computed variants (no deletes). Outcome: PASS_NO_DELETES, SKIP logs present
4. **Status patch:** FAILED→COMPLETED recovery; COMPLETED→FAILED blocked 409; completedAt stable. Outcome: all pass
5. **summary-compact:** `chmod +x scripts/test-summary-compact.sh && ./scripts/test-summary-compact.sh`. Outcome: histogram BUY+SELL+HOLD > 0
6. **runs-v2:** `chmod +x scripts/test-runs-v2.sh && ./scripts/test-runs-v2.sh`. Outcome: PASS
7. **High-scale (agents=2000):** runId=dba15bad-8dcb-48f5-9495-743a5772637d, variantId=271b20c9-af16-44ae-ac73-b62c1e5bcacc, seed=1, agents=2000, steps=29, label="bench-2000-1770980552". Verification:
```bash
API="http://localhost:4001"
RUN_ID="dba15bad-8dcb-48f5-9495-743a5772637d"
curl -s "$API/runs/$RUN_ID/variants?assetSymbol=SPY" | jq -r '.items[] | {id, seed, agents, steps, label}'
```

---

## Scaling Targets (Phase 2)

- 2000 agents per variant validated (~8s)
- 10 seeds per run
- Target <12s for 2000 agents
- Support concurrent submissions with deterministic execution order

---

## Known Pitfalls

- Worker backtest-v0 requires runId to exist; uuidgen without creating run fails "Run not found".
- RunVariant unique (runId, assetSymbol, seed, label): reusing runId with same label+seed causes create to fail; must SKIP or upsert.

---

## Critical Invariants

- SimulationRun must never mutate datasetVersion after creation.
- RunVariant must always reference valid runId.
- decisionsHash deterministic for identical seeds; returnsHash matches datasetVersion.
- Worker must fail fast if dataset invalid; no silent fallback to default dataset.

---

## Versioning Contract

- `datasetVersion` is immutable once SimulationRun is created.
- `modelVersion` must be stored on SimulationRun.
- `decisionsHash`, `corr`, `directionalAccuracy`, and all derived metrics are valid only for a specific `(datasetVersion, modelVersion)` pair.
- Any change in simulation logic requires incrementing `modelVersion`.
- Hashes are NOT comparable across different `modelVersion` values.
- Reproducibility guarantees apply only within identical `(datasetVersion, modelVersion)` scope.

---

## Long-Term Product Direction

CrowdVest is a Crowd Intelligence Engine, research platform, signal generation engine, and SaaS product candidate.

**Target users:** Quant researchers, hedge funds, retail analytics platforms, academic research groups.

**Future:** Cloud deployment, multi-asset support, real-time ingestion, sentiment ingestion pipeline, multi-run comparison dashboard.

---

## Future Analytics Roadmap

- Max drawdown
- Volatility clustering
- Regime classification
- Leaderboard: bets table, wallet tracking, ranking by correlation / directional accuracy / risk-adjusted return (deterministic and queryable)

---

## Current Status

System stable and fast. Determinism, queueing, rerun idempotency, results endpoints, status patch logic hardened. 2000-agent compute validated.

---

## Next Steps (Engineering)

1. Ensure /results/summary-compact uses canonical decision histogram source; never return zeros for completed runs.
2. Add standardized bench suite script (agents=50/200/1000/2000) with durations + PASS/FAIL in green.
3. Add scripts/run-hardening-suite.sh.
4. Improve observability: persist perf timings per runVariant (optional table).
5. Prep for UI/UX phase: define screens + API contracts for web dashboard (do not design yet).

---

## Phase Status

Phase 1: Core Engine Hardening — COMPLETE  
Phase 2: Observability + Bench Suite — IN PROGRESS  
Phase 3: Product Surface (UI Contracts) — NEXT  
Phase 4: Analytics Expansion  
Phase 5: SaaSization
