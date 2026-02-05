# Results API — sample JSON responses

Read-only endpoints. No auth. Data shape follows the Results Data Model.

Base URL: `http://localhost:4001` (or `process.env.PORT`).

---

## GET /results/runs

List runs (paginated). Query: `limit`, `offset`.

**Response 200:**

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "timestamp": 1738342800000,
      "configHash": "a1b2c3d4e5f6789012345678abcdef01",
      "name": "ci-20260131-120000",
      "status": 2,
      "steps": 10
    }
  ],
  "total": 1
}
```

| Field        | Type   | Description                                      |
|-------------|--------|--------------------------------------------------|
| `id`        | string | Run UUID                                         |
| `timestamp` | number | Run creation time (ms since epoch)               |
| `configHash`| string | Hash of run config (reproducibility)             |
| `name`      | string | Run name                                         |
| `status`    | number | 0=PENDING, 1=RUNNING, 2=COMPLETED, 3=FAILED     |
| `steps`     | number | Number of simulation steps                       |
| `total`     | number | Total run count (for pagination)                  |

---

## GET /results/runs/:id

One run by id.

**Response 200:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": 1738342800000,
  "configHash": "a1b2c3d4e5f6789012345678abcdef01",
  "name": "ci-20260131-120000",
  "status": 2,
  "steps": 10
}
```

**Response 404:** `{ "statusCode": 404, "message": "Run not found: <id>" }`

---

## GET /results/agents?run_id=&lt;run_id&gt;

Per-agent rolled-up results for a run. Query: `run_id` (required for non-empty result).

**Response 200:**

```json
{
  "items": [
    {
      "agentId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "archetypeId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
      "runId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "steps": 10,
      "durationMs": 0,
      "pnl": 125.5,
      "risk": 0.02,
      "totalReward": 125.5,
      "actionCounts": {
        "buy": 3,
        "sell": 2,
        "hold": 5
      }
    }
  ],
  "total": 1
}
```

| Field         | Type   | Description                          |
|--------------|--------|--------------------------------------|
| `items`      | array  | Per-agent rolled-up results          |
| `total`      | number | Length of `items` (total agent count)|
| `items[].agentId`    | string | Agent UUID                           |
| `items[].archetypeId`| string | Archetype UUID                       |
| `items[].runId`      | string | Run UUID                             |
| `items[].steps`      | number | Steps this agent participated in     |
| `items[].durationMs` | number | Wall-clock duration (0 if not set)   |
| `items[].pnl`        | number | Total PnL over the run               |
| `items[].risk`       | number | Max fractional drawdown 0..1         |
| `items[].totalReward`| number | Sum of step rewards                  |
| `items[].actionCounts` | object | `buy`, `sell`, `hold` counts       |

If `run_id` is omitted or empty: `{ "items": [], "total": 0 }`. If run not found: **404**.

---

## GET /results/summary?run_id=&lt;run_id&gt;

Run-level aggregate + by-archetype aggregates + validation metrics for a run. Query: `run_id` (required for meaningful result).

**Response 200:**

```json
{
  "run": {
    "scope": 1,
    "runId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "metrics": {
      "agentCount": 50,
      "totalPnl": 6250.25,
      "avgPnl": 125.005,
      "avgRisk": 0.018,
      "totalSteps": 500,
      "avgStepsPerAgent": 10,
      "totalBuy": 150,
      "totalSell": 120,
      "totalHold": 230,
      "totalReward": 6250.25,
      "avgReward": 125.005
    }
  },
  "byArchetype": [
    {
      "scope": 2,
      "archetypeId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
      "runId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "metrics": {
        "agentCount": 25,
        "totalPnl": 3125.12,
        "avgPnl": 125.0048,
        "avgRisk": 0.02,
        "totalSteps": 250,
        "avgStepsPerAgent": 10,
        "totalBuy": 75,
        "totalSell": 60,
        "totalHold": 115,
        "totalReward": 3125.12,
        "avgReward": 125.0048
      }
    }
  ],
  "validation": {
    "totalPnlSum": 6250.25,
    "pctProfitableAgents": 62.0,
    "archetypeDispersion": 12.3456,
    "maxDrawdownByArchetype": [
      { "archetypeId": "c3d4e5f6-a7b8-9012-cdef-345678901234", "maxDrawdown": 0.02 }
    ]
  }
}
```

| Field        | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| `run.scope` | number | 1 = run-level aggregate                      |
| `run.runId` | string | Run UUID                                     |
| `run.metrics` | object | AggregateMetrics (all numeric)             |
| `byArchetype[].scope` | number | 2 = archetype aggregate              |
| `byArchetype[].archetypeId` | string | Archetype UUID                   |
| `byArchetype[].runId` | string | Same run                        |
| `byArchetype[].metrics` | object | AggregateMetrics for that archetype   |
| `validation` | object | Sanity checks: totalPnlSum, pctProfitableAgents, archetypeDispersion, maxDrawdownByArchetype |

If `run_id` is omitted or empty: `{ "run": null, "byArchetype": [] }`. If run not found: **404**.

---

## GET /results/summary-compact?run_id=&lt;run_id&gt;

Compact post-run verification payload (CI-friendly). Query: `run_id` (required for non-null result). Values match `/results/summary` for the same run; `archetypeTotals` is derived from `byArchetype`; `warnings` are derived from metrics/validation only.

**Response 200:**

```json
{
  "runId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "metrics": {
    "agentCount": 50,
    "totalPnl": 6250.25,
    "avgPnl": 125.005,
    "avgRisk": 0.018,
    "totalSteps": 500,
    "avgStepsPerAgent": 10,
    "totalBuy": 120,
    "totalSell": 115,
    "totalHold": 265,
    "totalReward": 6250.25,
    "avgReward": 125.005,
    "tradeRate": 0.47,
    "holdRate": 0.53,
    "buyRate": 0.24,
    "sellRate": 0.23
  },
  "validation": {
    "totalPnlSum": 6250.25,
    "pctProfitableAgents": 62.0,
    "archetypeDispersion": 12.3456
  },
  "archetypeTotals": {
    "agentCountSum": 50,
    "totalPnlSum": 6250.25
  },
  "debug": {
    "decisionHistogram": { "BUY": 120, "SELL": 115, "HOLD": 265, "OTHER": 0 },
    "sampleDecisions": [
      { "agentId": "uuid", "step": 0, "action": "BUY" },
      { "agentId": "uuid", "step": 0, "action": "HOLD" }
    ],
    "prePersistHistogram": { "BUY": 120, "SELL": 115, "HOLD": 265, "OTHER": 0 } | null (null if RunDebug row missing),
    "persistedHistogram": { "BUY": 120, "SELL": 115, "HOLD": 265, "OTHER": 0 },
    "actionHistogram": { "BUY": 120, "SELL": 115, "HOLD": 265, "OTHER": 0 },
    "samplePrePersistActions": [
      { "agentId": "uuid", "step": 0, "action": "BUY" },
      { "agentId": "uuid", "step": 0, "action": "HOLD" }
    ],
    "sampleActions": [
      { "agentId": "uuid", "step": 0, "action": "BUY" },
      { "agentId": "uuid", "step": 0, "action": "HOLD" }
    ],
    "mappingNotes": "optional: set when prePersistHistogram differs from persistedHistogram"
  },
  "warnings": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Run UUID |
| `metrics` | object | Run-level: agentCount, totalPnl, avgPnl, avgRisk, totalSteps, avgStepsPerAgent, totalBuy, totalSell, totalHold, totalReward, avgReward, tradeRate, holdRate, buyRate, sellRate |
| `validation` | object | totalPnlSum, pctProfitableAgents, archetypeDispersion |
| `archetypeTotals` | object | Sum across archetypes: agentCountSum, totalPnlSum |
| `debug` | object | decisionHistogram (sim-core output), sampleDecisions (first 10), prePersistHistogram (in-memory before DB write), persistedHistogram (from DB), actionHistogram (alias of persistedHistogram), samplePrePersistActions (first 10), sampleActions (first 10), mappingNotes (optional) |
| `warnings` | string[] | NO_SELL_ACTIONS, LOW_TRADE_RATE, HIGH_HOLD_RATIO, ALL_AGENTS_LOSING, RISK_TOO_LOW (never fails the request) |

If `run_id` is omitted or empty: **400 Bad Request** ("run_id is required"). If `run_id` is not a valid UUID: **400 Bad Request** ("run_id must be a UUID"). If run not found: **404**.
