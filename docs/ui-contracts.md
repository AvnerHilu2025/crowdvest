# CrowdVest — UI Contracts (Phase 3)

## 0. Scope

- Phase 3 is UI contracts only (no styling, no UX design).
- Web app consumes API via 4000 -> 4001 proxy (/api/*).
- All endpoints are read-only projections over persisted state.
- No endpoint may recompute corr/directionalAccuracy/hashes.

## 1. Global UI Rules

### 1.1 Determinism & Integrity

- Only COMPLETED runs appear by default.
- FAILED runs never appear in: latest, leaderboard, default runs list.
- latest must use RunVariantSummary only.
- hashes shown are persisted only.

### 1.2 Pagination

Define standard query params:

- `limit` (default 50 for most endpoints; parseLimit caps at 200)
- `offset` (default 0)

Define response shape:

```json
{ "items": T[], "total": number }
```

**Note:** Some endpoints use different defaults (e.g. runs-v2 uses parseLimit default 50; leaderboard uses limit default 20, max 100). Not all list endpoints return `{ items, total }` (e.g. leaderboard returns a plain array).

### 1.3 Common Filters

- `assetSymbol` (default "SPY" where applicable)
- `status` filter (optional; not yet supported on runs-v2)
- date ranges (future)

### 1.4 Error Mapping

- 400 bad request (missing required query, invalid UUID)
- 404 not found
- 409 conflict (run not completed)
- 500 internal

## 2. Screens & Contracts

### 2.1 Dashboard (Home)

**Purpose:**

- Show Latest Run summary for assetSymbol=SPY.
- Show quick health of system (queue depth, worker running).

**API:**

- `GET /results/latest?assetSymbol=SPY`

  **Response:** `{ run, defaultVariant, summary }`

  - `run`: `{ id, status, startedAt, completedAt, failedAt, lastError }` or null
  - `defaultVariant`: RunVariant (seed=1 preferred) or null
  - `summary`: RunVariantSummary (corr, directionalAccuracy, pairsCount, etc.) or null

  **Note:** run does not include datasetVersion/modelVersion; those are on SimulationRun. Use GET /runs/:id for full run metadata.

- `GET /jobs/queue`

  **Response:** `{ queueLen, runningRunId, lastEvents }`

  - `queueLen`: number
  - `runningRunId`: string | null
  - `lastEvents`: `{ ts, type, runId?, msg? }[]` (ENQUEUE|START|DONE|FAIL|SKIP)

**UI fields:**

- runId, status, completedAt, datasetVersion, modelVersion (latter from /runs/:id if needed)
- summary: corr, directionalAccuracy, pairsCount
- histograms (if available via summary-compact)

### 2.2 Runs List

**Purpose:**

- Browse historical runs (COMPLETED only by default).
- Sort newest first.

**API:**

- `GET /results/runs-v2?limit=&offset=`

  **Response:** `{ items: [...], total }`

  **Params:** limit (default 50, max 200), offset (default 0)

  **Note:** Currently returns ALL runs (PENDING, RUNNING, COMPLETED, FAILED). No status filter. UI must filter client-side for "COMPLETED only by default" per 1.1.

  **Item shape:**

  - id, name, createdAt, status, startedAt, completedAt, failedAt, lastError
  - assetSymbol, steps, agents (from fallback variant)
  - variantsCount

  **Note:** Item does not include datasetVersion, modelVersion. Use GET /runs/:id for full run metadata.

**Columns (aspirational):**

- createdAt, name, datasetVersion, modelVersion, status, completedAt

**Actions:**

- Open Run Details

### 2.3 Run Details

**Purpose:**

- Inspect one run.
- List its variants for assetSymbol filter.
- Display run lifecycle timestamps and error (if failed).

**API:**

- `GET /runs/:id` — run by id with normalized payload. Add `?debug=1` for debug fields.

  **Response:** NormalizedRunPayload (id, runId, status, name, seed, modelVersion, datasetVersion, schemaVersion, metrics, validation, archetypeTotals, warnings, prePersistHistogram, persistedHistogram)

- `GET /runs/:runId/variants?assetSymbol=SPY&label=&limit=&offset=`

  **Response:** `{ items: [...], total }`

  **Item shape:**

  - id, runId, assetSymbol, seed, agents, steps, label, createdAt
  - decisionsHash, returnsHash (from RunVariantSummary)
  - summary: { corr, directionalAccuracy, pairsCount, createdAt, decisionsHash, returnsHash, decisionCounts, debug? }

**Variant fields to display:**

- seed, agents, steps, label, decisionsHash, returnsHash

**Action:**

- Open Variant Details

### 2.4 Variant Details

**Purpose:**

- Show canonical performance metrics (RunVariantSummary).
- Show crowd analytics charts (CrowdMetrics)
- Show agent decisions histogram

**API:**

- `GET /results/summary?run_id=RUN_ID` — run-level + by-archetype summary. No runVariantId or assetSymbol.

  **Response:** `{ run, byArchetype, validation }`

- `GET /results/summary-compact?run_id=RUN_ID` — compact post-run verification.

  **Response:** runId, metrics, validation, archetypeTotals, debug, warnings. debug includes persistedHistogram, prePersistHistogram, sampleActions.

- `GET /results/crowd-summary?run_id=RUN_ID&assetSymbol=RUN` — crowd metrics. Add assetSymbol for AgentDecision aggregation + recommendation.

  **Response:** runId, overall (BUY/SELL/HOLD), perStep, recommendation

- `GET /results/crowd-state?runId=RUN_ID&assetSymbol=SPY` — per-step CrowdMetrics + recommendation.

  **Response:** runId, assetSymbol, perStep (signal, weightedSignal, consensus, polarization, uncertainty, etc.), recommendation (direction, strength, confidence, stability, explanation)

- `GET /results/backtests?assetSymbol=SPY&limit=50` — list BacktestResult (per-seed backtest v0).

  **Response:** `{ items: [...], total }` — items have runId, assetSymbol, seed, steps, agents, pairsCount, corr, directionalAccuracy, createdAt

  **Limitation:** Does NOT accept runId. Returns all backtests for assetSymbol, ordered by createdAt desc. Cannot filter by run.

- `GET /results/crowd-wisdom-dump?runId=RUN_ID&assetSymbol=SPY` — raw decisions + returns. Dev/analysis only, not default UI. Run must be COMPLETED. 409 if not.

- `GET /results/step-summary?run_id=RUN_ID&step=N` — per-step crowd snapshot. No assetSymbol.

- `GET /results/decisions?run_id=RUN_ID&step=N&assetSymbol=SPY` — per-step decision summary from AgentDecision.

**UI:**

- corr, directionalAccuracy, pairsCount
- decision histogram BUY/SELL/HOLD
- crowd metrics per step: signal, consensus, polarization (as available)

### 2.5 Agents (Future v1)

**Purpose:**

- list agents for a run, show archetype, traits, state, rewards.

**API:**

- `GET /results/agents?run_id=RUN_ID` — per-agent rolled-up results. Returns `{ items, total }`. No runVariantId or assetSymbol.

- `GET /results/agent-state?runId=RUN_ID&assetSymbol=SPY&agentId=UUID&historyLimit=10` — latest learning state + last N steps (AgentState). historyLimit default 10, max 100.

- `GET /results/agent-rewards?runId=RUN_ID&assetSymbol=SPY&agentId=&fromStep=&toStep=` — reward rows (AgentReward).

  **Response:** `{ runId, assetSymbol, items, total }`

**Note:** agent-state and agent-rewards do not accept runVariantId. They scope by runId + assetSymbol. Mark as experimental if not stable.

### 2.6 Bets + Leaderboard (Future)

**Purpose:**

- show user wallet, bet history, leaderboard.

**API (existing):**

- `GET /bets?userId=UUID&limit=50&offset=0&status=OPEN|SETTLED|CANCELLED` — returns `{ items: Bet[], total }`

- `GET /leaderboard?by=wallet|accuracy&limit=20` — returns array (not `{ items, total }`). by=wallet | accuracy. limit default 20, max 100.

**Placeholders (document only; do not implement):**

- `GET /bets?userId=&limit=&offset=` — already exists; add metric filter if needed
- `GET /leaderboard?metric=wallet|accuracy&limit=&offset=` — exists as `by` param

## 3. Parameter Conventions (Actual API)

| Endpoint                    | runId param      | assetSymbol | Other                          |
|----------------------------|------------------|-------------|--------------------------------|
| results/latest             | —                | assetSymbol | —                              |
| results/runs-v2            | —                | —          | limit, offset                  |
| results/summary            | run_id           | —          | —                              |
| results/summary-compact    | run_id           | —          | —                              |
| results/crowd-summary      | run_id \| runId  | optional   | —                              |
| results/crowd-state        | runId \| run_id  | required   | —                              |
| results/crowd-wisdom-dump  | runId \| run_id  | assetSymbol | —                             |
| results/backtests          | —                | assetSymbol | limit (no runId)               |
| results/agents             | run_id           | —          | —                              |
| results/agent-state         | runId \| run_id  | required   | agentId, historyLimit          |
| results/agent-rewards      | runId \| run_id  | required   | agentId, fromStep, toStep      |
| results/decisions          | run_id \| runId  | assetSymbol | step                          |
| results/step-summary       | run_id           | —          | step                          |
| runs/:id                   | :id (path)       | —          | debug                          |
| runs/:runId/variants       | :runId (path)    | assetSymbol | label, limit, offset          |

## 4. Contract Gaps / TODO

- No endpoint returns AssetStepReturn directly (unless through crowd-wisdom-dump).
- backtests endpoint returns summaries only; does not accept runId.
- Define stable DTOs for results endpoints (currently mixed runId/run_id params).
- results/runs-v2 returns all runs; no status filter. UI must filter for COMPLETED.
- results/latest run object does not include datasetVersion, modelVersion.
- results/summary and results/summary-compact do not accept runVariantId or assetSymbol; they aggregate at run level.
- leaderboard returns plain array, not `{ items, total }`.

## 5. Change Control

- Any endpoint shape change must bump API version OR add new endpoint.
- UI should be tolerant to additive fields only.
