# CrowdVest — Product Master Context

CrowdVest (VINVESTOR / VICWS) is a Virtual Investor Crowd Wisdom System.

This is a real product under active development.
This is NOT a prototype.

The objective is to build a deterministic, scalable, multi-agent simulation engine
that generates crowd-based market forecasts and measures predictive power over time.

---

# 1️⃣ Product Vision

CrowdVest simulates thousands of autonomous investor agents,
each defined by archetype + behavioral traits.

The system:

- Aggregates decisions across agents
- Detects regime shifts
- Measures directional accuracy
- Tracks stability and drift
- Identifies emergent crowd intelligence
- Evaluates statistical signal quality
- Ultimately aims to detect alpha from crowd dynamics

Long-term goal:
A decision-support intelligence platform powered by simulated crowd behavior.

---

# 2️⃣ Core Hypothesis

A sufficiently diverse, deterministic population of investor archetypes,
operating on canonical datasets and controlled seeds,
will generate statistically meaningful directional signals
that can outperform naive baselines.

This hypothesis must be testable and measurable.

---

# 3️⃣ Current Product Phase

We are currently in:

## Phase 1 — Deterministic Simulation + Observability (≈80% complete)

What exists:

- Deterministic simulation engine
- Canonical dataset (AssetStepReturn)
- SimulationRun → RunVariant model
- expectedVariants contract
- overwrite / SKIP semantics
- AgentDecision persistence
- Multi-seed execution
- Drift metrics
- Dashboard (scaling, stability, drift)
- URL-driven drawer
- E2E tests
- Hardening scripts
- Worker orchestration via API spawn

What does NOT exist yet:

- Signal quality tracking
- Accuracy vs real returns
- Rolling evaluation windows
- Agent performance ranking
- Adaptive agent weighting
- Meta-model over agents
- Portfolio layer
- Real-time ingestion
- SaaS multi-tenant model

---

# 4️⃣ System Architecture

Monorepo (pnpm workspace)

Layer | Tech | Port
------|------|------
Web | Next.js 15 (App Router) | 4000
API | NestJS | 4001
DB | PostgreSQL (Prisma) | 5432
Redis | Present in docker-compose but NOT used by API | 6379
Worker | Spawned by API (backtest-v0) | —

Web proxy:
http://localhost:4000/api/* → http://localhost:4001/*

---

# 5️⃣ Infrastructure

docker-compose.yml exists at repo root.

Services:
- postgres
- redis (unused by API)

DB credentials:
- DB: crowdvest
- User: crowdvest
- Password: crowdvest_dev_pw

Start:

cd ~/crowdvest
docker compose up -d
pnpm db:migrate

---

# 6️⃣ Simulation Model Contract

SimulationRun → many RunVariant

Rules:

- expectedVariants stored at creation
- Run completes when completedVariants == expectedVariants
- RunVariant unique key:
  (runId, assetSymbol, seed, label)

overwrite=true:
- deletes AgentDecision rows inside a single DB transaction
- recomputes that variant only

SKIP:
- must NOT delete
- must NOT recompute

No silent recompute allowed.

---

# 7️⃣ Canonical Data Ownership

AssetStepReturn is canonical dataset.

- No dynamic recompute from raw data
- AgentDecision immutable unless overwrite=true
- overwrite must delete by runVariantId inside transaction

---

# 8️⃣ Determinism Philosophy

Config hash includes:
- seed
- steps
- modelVersion
- datasetVersion

All runs must be reproducible.

All expectedVariants must exist for run to be complete.

Determinism > speed.

---

# 9️⃣ Dashboard (Current State)

Route:
GET /dashboard

Summary proxy:
apps/web/src/app/api/dashboard/summary/route.ts

Summary includes:
- consensus
- latestRun
- health
- scalingRows
- stabilityRows
- driftAsset (object, never null)
- driftGlobal (object, never null)

Drawer:
drawerRunId=<RUN_ID>

Normalizer must NOT overwrite URL while drawerRunId exists.

Tests:
apps/web/tests/dashboard.spec.ts

---

# 🔟 Bootstrap Run

Create a completed run:

curl -X POST http://localhost:4001/runs/import/spy29

If count === 29 → API auto-enqueues backtest.

Worker:
spawn("pnpm", ["--filter", "worker", "run", "backtest-v0", ...])

No separate worker process.

---

# 11️⃣ Testing Layers

## HTTP Smoke
curl /health
curl /api/dashboard/summary

## Web Smoke
pnpm -C apps/web run smoke

## E2E
pnpm -C apps/web run test:e2e

---

# 12️⃣ Known Issues

Next.js .next corruption:
Fix:
pnpm -C apps/web run reset:next

Ports in use:
fuser -k 4000/tcp
fuser -k 4001/tcp

---

# 13️⃣ Roadmap

## Phase 1 — Deterministic Engine
✅ Core simulation
✅ Persistence
✅ Drift
✅ Dashboard

## Phase 2 — Signal Validation
- Directional accuracy tracking
- Rolling performance window
- Baseline comparison
- Confidence scoring

## Phase 3 — Intelligence Layer
- Archetype scoring
- Adaptive weighting
- Agent evolution
- Meta-aggregation model

## Phase 4 — Productization
- Portfolio simulation
- Multi-user accounts
- Public API
- SaaS layer

---

# 14️⃣ Immediate Next Focus

We must now move from observability → predictive evaluation.

Next logical engineering milestone:

Build a **Forecast Accuracy Engine**:

- Store aggregated forecast per run
- Compare against actual outcome
- Persist directional correctness
- Compute rolling accuracy
- Display on dashboard

This transitions us from “simulation system”
to “forecasting product”.

---

# 15️⃣ Execution Contract

ChatGPT must provide:
- Exact files
- Exact code
- WSL commands
- Verification steps

No theory unless asked.

Cursor-ready output only.

---

CrowdVest is evolving from deterministic simulation
to measurable crowd intelligence.

# 16️⃣ Phase 2 — Forecast Accuracy Engine (Implementation Plan)

Goal:
Move from simulation observability → measurable predictive power.

We define Forecast as:
Aggregated directional signal across all RunVariants for a given step.

We define Ground Truth as:
Actual return direction in AssetStepReturn for the evaluation horizon.

---

## Step 1 — Persist Aggregated Forecast

Create new table:

ForecastResult
- id
- runId
- assetSymbol
- evaluationStep
- forecastDirection (BUY/SELL/HOLD)
- forecastStrength (0–1)
- totalVotes
- buyVotes
- sellVotes
- holdVotes
- createdAt

Rule:
One ForecastResult per (runId, assetSymbol, evaluationStep)

---

## Step 2 — Compute Ground Truth

From AssetStepReturn:

groundTruthDirection =
  if return > 0 → BUY
  if return < 0 → SELL
  else → HOLD

Add fields to ForecastResult:
- groundTruthDirection
- isCorrect (boolean)

---

## Step 3 — Accuracy Metrics

Create table:

RunAccuracy
- runId
- assetSymbol
- totalEvaluations
- correctCount
- accuracyRate
- buyAccuracy
- sellAccuracy
- holdAccuracy
- computedAt

AccuracyRate = correctCount / totalEvaluations

---

## Step 4 — API

Add endpoint:

GET /runs/:id/accuracy

Returns:
{
  accuracyRate,
  totalEvaluations,
  breakdown: {
    buyAccuracy,
    sellAccuracy,
    holdAccuracy
  }
}

---

## Step 5 — Dashboard

Add new panel:

Forecast Accuracy

Display:
- Overall accuracy
- Rolling 10-step accuracy
- Buy vs Sell accuracy
- Baseline comparison (random / always-buy)

---

## Step 6 — Deterministic Rule

Accuracy must only compute once per completed run.
No dynamic recompute unless overwrite=true.

---

Success Criteria:

- We can say:
  "Run X achieved 58% directional accuracy over 29 steps."
- Stored in DB.
- Visible in Dashboard.
- Tested via E2E.


---

## 1) Prisma models

**AgentDecision** (lines 217–238):
```prisma
model AgentDecision {
  id             String              @id @default(uuid()) @db.Uuid
  runId          String              @db.Uuid
  runVariantId   String?             @db.Uuid
  step           Int
  agentId        String              @db.Uuid
  assetSymbol    String              @default("RUN")
  action         AgentDecisionAction
  confidence     Float
  rationale      String?
  createdAt      DateTime            @default(now())
  ...
}
```

**AssetStepReturn** (lines 277–290):
```prisma
model AssetStepReturn {
  id         String   @id @default(uuid()) @db.Uuid
  runId      String   @db.Uuid
  assetSymbol String
  step       Int
  stepReturn Float
  createdAt  DateTime @default(now())
  ...
}
```

**SimulationRun** (lines 82–117):
```prisma
model SimulationRun {
  id             String              @id @default(uuid()) @db.Uuid
  name           String
  status         SimulationRunStatus @default(PENDING)
  seed           Int
  modelVersion   String
  datasetVersion String
  ...
}
```

**RunVariant** (lines 124–150):
```prisma
model RunVariant {
  id           String    @id @default(uuid()) @db.Uuid
  runId        String    @db.Uuid
  assetSymbol  String
  seed         Int
  agents       Int
  steps        Int
  label        String?
  ...
}
```

---

## 2) AgentDecision fields

| Field        | Present |
|-------------|---------|
| step index  | Yes (`step`) |
| assetSymbol | Yes |
| variantId   | Yes (`runVariantId`, optional) |
| confidence | Yes |
| timestamp   | Yes (`createdAt`) |

---

## 3) What each AgentDecision predicts

Each decision at step `t` predicts the **next-step return** (from step `t` to `t+1`).

- `stepReturn[t+1]` = `(price[t+1] - price[t]) / price[t]`
- Decision at step `t` is compared to `stepReturn[t+1]` for accuracy

---

## 4) AssetStepReturn fields

| Field           | Present |
|----------------|---------|
| step index     | Yes (`step`) |
| return value   | Yes (`stepReturn`) |
| timestamp      | Yes (`createdAt`) |
| cumulative return | No |

`stepReturn` is the single-step return: `(price[t] - price[t-1]) / price[t-1]`. Step 0 is 0.

---

## 5) backtest-v0 step alignment

- Decisions are made at steps `0 .. steps-1`.
- Pairing: `for (let t = 0; t <= steps - 2; t++)` → signal at step `t`, outcome at `returnByStep.get(t + 1)`.
- So decisions at step `t` are aligned with the **next-step** outcome (`stepReturn[t+1]`).

---

## 6) Aggregation logic

**Dashboard consensus** is computed in `apps/api/src/dashboard/dashboard.service.ts` in `fetchConsensus()` (lines 479–529):

- Reads `RunVariantSummary.debugDecisionCounts` (BUY/SELL/HOLD counts).
- Aggregates across variants for the latest run.
- Computes `buyPct`, `sellPct`, `holdPct`, `majorityPct`, `entropy`, `polarization`.

**CrowdMetrics consensus** is computed in `apps/worker/src/scripts/compute-crowd-metrics.ts` from `AgentDecision` rows per step.

---

## 7) Persistence of decisions

Decisions are stored **per step** (and per agent):

- One `AgentDecision` row per `(runId, step, agentId, assetSymbol, runVariantId)`.
- Unique constraint: `@@unique([runId, step, agentId, assetSymbol, runVariantId])`.

# 17️⃣ Formal Forecast Definition

Decision at step t predicts stepReturn[t+1].

Evaluation Horizon:
Single-step ahead forecast (1-step forward).

Forecast Aggregation:
Majority vote across all AgentDecision rows
for (runId, assetSymbol, step).

Ground Truth:
AssetStepReturn.stepReturn at (step + 1).

Accuracy:
Correct if:
- BUY and stepReturn > 0
- SELL and stepReturn < 0
- HOLD and stepReturn == 0

# 18️⃣ IMPLEMENT NOW — Phase 2 Forecast Accuracy Engine (Persistence First)

We are now implementing Phase 2.

Objective:
Persist deterministic, step-aligned, 1-step-ahead forecast accuracy for each completed run.

STRICT RULES:
- No redesign.
- No meta-model.
- No weighting.
- Majority vote only.
- Deterministic.
- Compute once per completed run.
- No dynamic recompute unless overwrite=true.

Execution contract:
Every response must include:
1) Exact file(s) to edit
2) Exact code to paste
3) Exact WSL command(s)
4) Verification steps

No theory.

---

## Forecast Definition (LOCKED)

Decision at step t predicts stepReturn[t+1].

Aggregation:
Majority vote across all AgentDecision rows
for (runId, assetSymbol, step).

Ground truth:
AssetStepReturn.stepReturn at (step + 1)

Correct if:
- BUY and stepReturn > 0
- SELL and stepReturn < 0
- HOLD and stepReturn == 0

Ignore last step (no t+1).

---

# IMPLEMENTATION PLAN

## STEP 1 — Prisma Schema

Add new models:

ForecastResult
- id (uuid)
- runId
- assetSymbol
- step
- forecastDirection
- totalVotes
- buyVotes
- sellVotes
- holdVotes
- groundTruthDirection
- isCorrect
- createdAt

Unique:
(runId, assetSymbol, step)

RunAccuracy
- id (uuid)
- runId
- assetSymbol
- totalEvaluations
- correctCount
- accuracyRate
- buyAccuracy
- sellAccuracy
- holdAccuracy
- computedAt

Unique:
(runId, assetSymbol)

---

## STEP 2 — DB Migration

Use:
pnpm db:migrate

---

## STEP 3 — Accuracy Service

Create new service:

apps/api/src/forecast/forecast.service.ts

Responsibilities:
- Fetch AgentDecision per run
- Group by (assetSymbol, step)
- Aggregate votes
- Fetch AssetStepReturn for ground truth
- Persist ForecastResult rows
- Compute and persist RunAccuracy

Rules:
- Run only if SimulationRun.status == COMPLETED
- Must not overwrite existing ForecastResult unless overwrite=true

---

## STEP 4 — API Endpoint

Add:

GET /runs/:id/accuracy

Behavior:
- If accuracy not computed → compute
- Return RunAccuracy

---

## STEP 5 — Deterministic Guard

Accuracy must compute exactly once per run
unless overwrite=true is explicitly passed.

No automatic recompute.

---

## STEP 6 — Verification

1) Create run:
curl -X POST http://localhost:4001/runs/import/spy29

2) Wait for completion:
curl http://localhost:4001/runs?limit=1

3) Call:
curl http://localhost:4001/runs/<RUN_ID>/accuracy

4) Verify:
- accuracyRate between 0 and 1
- ForecastResult rows exist
- RunAccuracy row exists

5) Add minimal E2E test asserting:
accuracyRate is returned.

---

BEGIN IMPLEMENTATION.
Provide file-level instructions only.
