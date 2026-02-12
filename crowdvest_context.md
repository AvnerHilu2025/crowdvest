# 🚀 CrowdVest (VINVESTOR / VICWS)

## 1. Product Vision

CrowdVest is a Virtual Investor Crowd Wisdom System.

It simulates thousands of autonomous investor agents
with archetypes and behavioral traits.

Purpose:
- Model collective intelligence
- Generate crowd-based forecasts
- Analyze directional accuracy
- Simulate market behavior
- Measure correlation vs actual returns
- Provide deterministic backtesting
- Become a decision-support intelligence platform

Long-term vision:
- Crowd-based alpha detection
- Market regime detection
- Agent archetype analytics
- Commercial SaaS platform

------------------------------------------------------------------

## 2. System Architecture (Monorepo)

Root: ~/crowdvest

Package manager: pnpm
Workspace structure: multi-app monorepo

### Apps

apps/api        → NestJS backend (port 4001)
apps/web        → Next.js frontend (port 4000)
apps/worker     → TS worker scripts (backtest-v0, etc.)

### Packages

packages/db     → Prisma schema + generated client
packages/shared → shared types (if exists)

------------------------------------------------------------------

## 3. Ports & Services

API:
http://localhost:4001
NestJS + Prisma

Web:
http://localhost:4000
Next.js 15

Health endpoints:
GET /health (API)
GET /api/health (Web proxy)

------------------------------------------------------------------

## 4. Database

Database: PostgreSQL
ORM: Prisma

Core models:

- SimulationRun
- RunVariant
- AssetStepReturn
- AgentDecision
- CrowdMetrics

Important constraints:

Unique index:
(name, datasetVersion) on SimulationRun

------------------------------------------------------------------

## 5. Current Stable Capabilities (PRODUCTION READY)

✅ Deterministic backtest-v0
- Requires AssetStepReturn rows
- steps must match return count
- seeds produce deterministic variants
- decision hashes stable

✅ Run lifecycle:
POST /runs/create-unique
POST /runs/import/spy29
Worker backtest
GET /runs/:id
GET /runs/:id/variants

Status flow:
PENDING → COMPLETED

✅ Web proxy working:
4000/api/* → 4001/*

Runs page loads
Run details page loads
Variants visible

------------------------------------------------------------------

## 6. Deterministic Dataset

SPY dataset:
29 AssetStepReturn rows
DatasetVersion:
ab8cd075a60e9164d278ba1a5451f973c66def292a46b06375c9a42e8a65e96b

Required:
--steps 29

------------------------------------------------------------------

## 7. Worker Commands

Backtest:

```bash
pnpm -C apps/worker run backtest-v0 -- \
  --runId <RUN_ID> \
  --assetSymbol SPY \
  --steps 29 \
  --agents 50 \
  --seedStart 1 \
  --seeds 2
```

------------------------------------------------------------------

## 8. Current Status (CEO Summary)

System is stable.
Deterministic.
Lifecycle validated.
Web + API integrated.
Ready to move from infrastructure to product features.

No blocking bugs.

------------------------------------------------------------------

## 9. Roadmap (Next Strategic Phase)

Phase 2: Productization

1. Real Run Status Flow
   - PENDING → RUNNING → COMPLETED → FAILED
   - Update status during worker execution

2. Background Job Queue
   - Decouple worker from manual CLI
   - Automatic execution on run creation

3. Metrics Dashboard
   - Correlation trend chart
   - Directional accuracy visualization
   - Archetype performance breakdown

4. Leaderboard Integration
   - Rank runs by correlation
   - Rank by directional accuracy

5. Agent Behavior Analytics
   - BUY/HOLD/SELL distribution graphs
   - Risk heatmaps

6. Performance Optimization
   - 1,000+ agents
   - Concurrency testing

------------------------------------------------------------------

## 10. Known Constraints

- AssetStepReturn required before backtest
- Steps must match return count
- Unique (name,datasetVersion)
- Web proxy must mirror API endpoints

------------------------------------------------------------------

## 11. Developer Rules

- Determinism first
- No hidden randomness
- All seeds reproducible
- All endpoints testable via curl
- All lifecycle flows testable via WSL

------------------------------------------------------------------

## 12. Next Immediate Task

~~Implement RUNNING status transition~~ DONE.

Status transitions implemented:
- Worker sets RUNNING when backtest starts (before dataset validation)
- Worker sets COMPLETED on success (after all DB writes)
- Worker sets FAILED on error (in catch, best-effort)

------------------------------------------------------------------

## 13. Agent Architecture

Each agent:

- Belongs to an archetype
- Has 100+ behavioral traits
- Makes BUY / SELL / HOLD decisions per step
- Can evolve in future versions

Archetypes:
Currently 25 predefined archetypes.

Agents are generated deterministically using:
- seed
- archetype definition
- trait parameter ranges

Future:
Dynamic trait mutation and learning loops.

------------------------------------------------------------------

## 14. Traits System

We maintain a structured list of 100+ investor traits.

Traits include:
- Risk tolerance
- Time horizon
- Volatility sensitivity
- Momentum bias
- Loss aversion
- Liquidity preference
- Reaction speed
- Herd behavior factor
- Confidence decay
- Overreaction bias
- Regime sensitivity
- Sentiment influence

Traits are stored in DB and used by decision engine.

This is core intellectual property.

------------------------------------------------------------------

## 15. Determinism Protocol

System must be 100% reproducible.

Validation strategy:

- Fixed seeds
- decisionsHash comparison
- returnsHash comparison
- Correlation delta threshold check
- A/B repeated backtest diff must be zero

Floating point delta tolerance:
~1e-15 acceptable

Determinism is mandatory.

------------------------------------------------------------------

## 16. Simulation Metrics

Current run-level metrics:

- totalPnl
- avgPnl
- avgRisk
- tradeRate
- holdRate
- buyRate
- sellRate
- directionalAccuracy
- corr
- pairsCount

Variants include:
- decisionCounts
- decisionsHash
- returnsHash
- debug sample

Future metrics:
- Sharpe ratio
- Max drawdown
- Volatility clustering
- Regime classification

------------------------------------------------------------------

## 17. Leaderboard & Betting System

Planned integration:

- bets table
- wallet tracking
- ranking by:
  - correlation
  - directional accuracy
  - risk-adjusted return

Leaderboard must be deterministic and queryable.

------------------------------------------------------------------

## 18. Environment

Development:
WSL Ubuntu
Ports 4000 / 4001

All commands must run in WSL.

No hidden Windows dependencies.

------------------------------------------------------------------

## 19. Long-Term Product Direction

CrowdVest is not a toy backtester.

It is:

- A Crowd Intelligence Engine
- A research platform
- A signal generation engine
- A SaaS product candidate

Target users:
- Quant researchers
- Hedge funds
- Retail analytics platforms
- Academic research groups

Future:
- Cloud deployment
- Multi-asset support
- Real-time ingestion
- Sentiment ingestion pipeline
- Multi-run comparison dashboard

------------------------------------------------------------------

## 20. Organizational Model

ChatGPT = CEO / System Architect
Cursor = Lead Developer

Rules:
- CEO defines architecture
- Cursor implements precisely
- All changes must be reproducible
- No undocumented decisions

------------------------------------------------------------------

## 21. API Surface (Current Endpoints)

Runs:

POST /runs
POST /runs/create-unique
POST /runs/import/spy29
GET  /runs?limit=N
GET  /runs/:id
GET  /runs/:id/variants
GET  /runs/:id/variants?assetSymbol=SPY

Health:

GET /health (API)
GET /api/health (Web proxy)

Web proxy:

4000/api/* → 4001/*

------------------------------------------------------------------

## 22. Run Lifecycle (Current vs Target)

Current:
PENDING → COMPLETED

Target:
PENDING → RUNNING → COMPLETED → FAILED

Worker must explicitly update run status.

Status updates must be persisted via Prisma.

------------------------------------------------------------------

## 23. Dataset Rules

AssetStepReturn rows are linked to runId.

Rules:
- AssetStepReturn must exist before backtest
- steps parameter must equal AssetStepReturn count
- Dataset import route populates AssetStepReturn
- DatasetVersion must match imported dataset

Failure to satisfy these conditions causes worker error.

------------------------------------------------------------------

## 24. Deterministic Validation Procedure

Deterministic validation protocol:

1. Run identical backtest twice
2. Compare decisionsHash
3. Compare returnsHash
4. Compare corr
5. Accept float delta <= 1e-15
6. diff output must be empty

All deterministic tests must pass before feature merge.

------------------------------------------------------------------

## 25. Hash Philosophy

decisionsHash:
Cryptographic hash of ordered agent decisions.

returnsHash:
Cryptographic hash of ordered AssetStepReturn rows.

Purpose:
- Ensure data integrity
- Ensure reproducibility
- Enable audit trail
- Prevent silent drift

Hashes are core product integrity mechanism.

------------------------------------------------------------------

## 26. Scaling Targets

Phase 2 targets:

- 1,000 agents per run
- 10 seeds per run
- <5 seconds execution time for 1k agents
- Support concurrent runs
- Determinism preserved under concurrency

------------------------------------------------------------------

## 27. Technology Stack

Backend:
NestJS v10
Prisma ORM
PostgreSQL

Frontend:
Next.js 15
App Router

Worker:
TypeScript
tsx execution

Package manager:
pnpm workspace

Environment:
WSL Ubuntu
Ports 4000 / 4001
No Docker in current phase

------------------------------------------------------------------

## 28. Naming Clarification

CrowdVest:
Product name.

VINVESTOR:
Concept name (Virtual Investor).

VICWS:
Technical system name (Virtual Investor Crowd Wisdom System).

All refer to the same platform.

## 29. Critical Invariants

- SimulationRun must never mutate datasetVersion after creation
- RunVariant must always reference valid runId
- decisionsHash must be deterministic for identical seeds
- returnsHash must match datasetVersion
- Worker must fail fast if dataset invalid
- No silent fallback to default dataset





