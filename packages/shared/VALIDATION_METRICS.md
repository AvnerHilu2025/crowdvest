# Validation metrics (sanity checks)

Sanity checks and validation metrics for simulation results. All computed from per-agent `pnl`, `risk` (max drawdown), and `archetypeId`.

## Metrics

| Metric | Description |
|--------|-------------|
| **totalPnlSum** | Sum of all agent PnLs. Sanity: in a zero-fee model this should match total reward; useful to spot aggregation bugs. |
| **pctProfitableAgents** | Percentage of agents with `pnl > 0` (0..100). |
| **archetypeDispersion** | Standard deviation of mean PnL per archetype. Measures how spread out performance is across archetypes. |
| **maxDrawdownByArchetype** | For each archetype, the maximum agent risk (max fractional drawdown 0..1) in that archetype. |

## Validation logic

- **Shared:** `packages/shared/src/validation-metrics.ts`
  - `computeValidationMetrics(agents: AgentForValidation[]): ValidationMetrics`
  - Input: array of `{ pnl, risk, archetypeId }` (one per agent).
  - Pure function; no DB.

## Where it runs in the pipeline

| Stage | Where | When |
|-------|--------|------|
| **sim:summary** | `apps/worker/src/scripts/sim-summary.ts` | After `getSummary()`: fetches per-agent pnl/risk/archetype via `getAgentResultsForValidation()`, calls `computeValidationMetrics()`, adds `validation` to summary JSON and prints a "Validation metrics" block. |
| **Results API** | `apps/api/src/results/results.service.ts` | In `getSummary(runId)`: uses existing `getAgents()` result, calls `computeValidationMetrics()`, returns `validation` in the response. |
| **sim:verify / sim:ci** | Not yet | Can later call the same logic and add pass/fail rules (e.g. pctProfitableAgents &gt; threshold). |

## Example output

### sim:summary (human)

```
--- Validation metrics ---
Total PnL sum:     6250.25
% profitable agents: 62.0%
Archetype dispersion: 12.3456
Max drawdown by archetype:
  a1b2c3d4…: 0.0200
  e5f6a7b8…: 0.0150
--------------------------------------
```

### sim:summary (JSON, --out)

```json
{
  "run": { ... },
  "experiencesCount": 500,
  "validation": {
    "totalPnlSum": 6250.25,
    "pctProfitableAgents": 62.0,
    "archetypeDispersion": 12.3456,
    "maxDrawdownByArchetype": [
      { "archetypeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "maxDrawdown": 0.02 },
      { "archetypeId": "e5f6a7b8-9012-cdef-345678901234", "maxDrawdown": 0.015 }
    ]
  }
}
```

### GET /results/summary?run_id=&lt;id&gt; (API)

```json
{
  "run": { "scope": 1, "runId": "...", "metrics": { ... } },
  "byArchetype": [ ... ],
  "validation": {
    "totalPnlSum": 6250.25,
    "pctProfitableAgents": 62.0,
    "archetypeDispersion": 12.3456,
    "maxDrawdownByArchetype": [
      { "archetypeId": "a1b2c3d4-...", "maxDrawdown": 0.02 },
      { "archetypeId": "e5f6a7b8-...", "maxDrawdown": 0.015 }
    ]
  }
}
```
