# CrowdVest v1 Design – Crowd Wisdom Product

## Goal
Generate a crowd of diverse virtual investor agents (human-like traits) and extract crowd wisdom signals from their heterogeneous decisions. Wallet/Bets/Ledger support agent decision-making and scoring but are not the product goal itself.

## Phased Plan (v1 Only)

### Phase 1: DB + Generator + Read Endpoints ✓
- **DB**: Use existing schema (Agent, Archetype, TraitDefinition, AgentExperience, CrowdSnapshot). No new tables for v1; Agent.stateJson holds wallet/traits; CrowdSnapshot.aggregationJson holds step aggregates.
- **Generator**: POST /agents/generate creates run (or uses existing runId), creates N agents, runs simulation loop in-process. Uses sim-core (buildTraitValues, runStep) and existing archetype profiles.
- **Read endpoints**: GET /results/agents, GET /results/crowd-summary, GET /results/agent/:id/decisions.
- **Limits**: max 200 agents, 50 steps for sync generate to avoid timeout.

### Phase 2: Agent Model v1 (traits + correlations)
- Add AgentTraitValues or traitsJson to Agent for run-time generated traits (age, horizon, risk, confidence, etc.).
- Add optional correlations: age↔horizon, risk↔position size, confidence↔trade frequency.
- Migration + generator update.

### Phase 3: Decision Engine v1
- Per-step decision: BUY/SELL/HOLD + confidence + stake from market features (returns/momentum/volatility) and agent traits.
- Move logic from sim-core into explicit decision engine in worker.

### Phase 4: Crowd Wisdom Layer v1
- Aggregate into: vote distribution, weighted signal, disagreement index, stability.
- Persist in CrowdSnapshot.aggregationJson or new CrowdMetrics table.

### Phase 5: Scoring v1
- Per-agent and per-crowd: accuracy, pnl, drawdown, consistency.
- Compare to baselines.

---

## Repo Layout

| Component | Location |
|-----------|----------|
| Simulation loop & decision engine | apps/worker (sim-run, sim-core) |
| API endpoints | apps/api (agents, results) |
| DB schema + migrations | packages/db (Prisma) |
| Crowd dashboard | apps/web (new pages) |

---

## Minimal Endpoints v1

| Method | Path | Purpose |
|--------|------|---------|
| POST | /agents/generate | Create run + N agents + run sim (body: count, steps, seed?, name?; query: runId?) |
| GET | /results/agents | Per-agent rolled-up results (existing) |
| GET | /results/crowd-summary | Crowd metrics (vote distribution, totals) |
| GET | /results/agent/:id/decisions | Agent decisions (AgentExperience) for run |
| GET | /results/step-summary | (optional) Per-step crowd snapshot |

---

## Task List

- [x] Phase 1.1: Design doc
- [x] Phase 1.2: POST /agents/generate endpoint
- [x] Phase 1.3: GET /results/crowd-summary
- [x] Phase 1.4: GET /results/agent/:id/decisions
- [x] Phase 1.5: Smoke test commands (pnpm verify:crowd-v1)
- [ ] Phase 2: Agent traits + correlations
- [ ] Phase 3: Decision engine v1
- [ ] Phase 4: Crowd wisdom metrics
- [ ] Phase 5: Scoring v1
