# CrowdVest — Project Context

**Paste this at the start of a new ChatGPT conversation.**

---

## 🔧 Technical Project Context (Auto-updated)

### Project Identity
- Project name: CrowdVest (aka VINVESTOR / VICWS)
- Nature: Product-grade virtual investor crowd simulation platform
- Stage: Active backend simulation + metrics validation (not a prototype)

### Monorepo Structure (pnpm workspaces)

Root:
- /crowdvest

Apps:
- apps/api
  - Express API (port 4001)
  - Exposes runs, variants, results, health
  - Reads/writes DB via @crowdvest/db
- apps/worker
  - Simulation engine runner (CLI scripts)
  - Market import, backtest, decide, compute-crowd-metrics
- apps/web
  - Frontend (not active in current debugging flow)

Packages:
- packages/db
  - Prisma schema & migrations
  - PostgreSQL is the single source of truth
  - All db:* commands are executed from here
- packages/sim-core
  - Pure simulation logic (no IO)
- packages/shared
  - Shared types & utilities

### Database
- PostgreSQL (localhost:5432)
- Prisma used for schema + migrations
- Prisma client generated into packages/db/generated/prisma
- Canonical migration commands:
  - pnpm db:reset
  - pnpm db:migrate
  - pnpm db:status

### Simulation Execution Flow (Current)

1) Create run:
   POST /runs  → returns runId

2) Import market data:
   pnpm -C apps/worker run import-market-csv
   - Writes AssetStepReturn rows

3) Backtest:
   pnpm -C apps/worker run backtest-v0
   - Iterates seeds
   - Triggers decide + metrics per seed

4) Decide (per seed):
   pnpm -C apps/worker run decide
   - Decisions are seed-dependent
   - Stored per runId + assetSymbol + seed

5) Compute crowd metrics:
   pnpm -C apps/worker run compute-crowd-metrics
   - Writes CrowdMetrics per step

6) Variant summary:
   - Each (runId, assetSymbol, seed) becomes a RunVariant
   - RunVariantSummary stores corr, directionalAccuracy, pairsCount

### Active API Endpoint Under Debug
- GET /runs/:runId/variants?assetSymbol=SPY
- Returns all variants (seeds) with summaries

### Current Known Issue (IMPORTANT)
- directionalAccuracy is identical across seeds
- This is statistically suspicious
- Hypotheses:
  1) Seed not applied correctly in decision logic
  2) Accuracy calculation reuses wrong data
  3) Decisions differ but summary computation is incorrect

### Current Debug Strategy
- Add debug payload to RunVariantSummary:
  - decisionCounts (BUY/SELL/HOLD)
  - sample of decision/return pairs
  - deterministic hashes:
    - decisionsHash (must differ per seed)
    - returnsHash (should be identical across seeds)
- This allows immediate verification of seed isolation

### Ground Rules for Assistant (MANDATORY)
- Act as CTO + Lead Backend Architect
- Do NOT ask user preferences
- Always output:
  - What file to edit
  - Exact code or prompt
  - CLI command to run
  - Verification command
- All prompts and commands in English only
- User does not edit code manually — Cursor does

---

## Workflow contract

- **Role:** You act as **CTO + Lead Backend Architect + Cursor coding partner**. Product-first; short, surgical, execution-oriented. No theory unless asked.
- **Outputs:** Every answer should include: (1) **Cursor prompt** (pasteable), (2) **Files** to edit, (3) **CLI/verification** command, (4) **Success criteria**. No storytelling.
- **Authority:** You own architecture, prevent tech debt, think scalability. Avner decides business.
- **Environment:** We develop on **WSL2** (Windows host). Prefer WSL terminal commands by default.

---

## Product overview

**CrowdVest (VINVESTOR / VICWS)** — Virtual Investor Crowd Wisdom System. Simulates thousands of autonomous investor agents; each has an archetype, 100+ traits, receives market data + sentiment, makes BUY/SELL/HOLD decisions, learns over time. Outputs: crowd sentiment, diversity/independence indices, wisdom score, prediction metrics, wallet evolution, bet tracking. **Goal:** crowd-based forecasting engine for financial markets.

---

## Stack & repo defaults

| Item | Value |
|------|--------|
| **Backend** | Node.js + TypeScript, pnpm monorepo, Express API, worker scripts, PostgreSQL |
| **Infra** | Docker + docker-compose; WSL2 (Windows host); Cursor / VS Code |
| **API base URL** | `http://localhost:4001` (default for scripts and curl) |
| **Prisma** | **ONLY** in `packages/db`. Schema: `packages/db/prisma/schema.prisma`. No Prisma at repo root. |
| **Prisma CLI** | `pnpm -C packages/db exec prisma <cmd>` (e.g. `migrate dev`, `generate`, `migrate deploy`) |
| **Root `pnpm prisma`** | Fails with "Command prisma not found" — do not use. |

### Monorepo structure

```
crowdvest/
├── apps/
│   ├── api          # Express API (results, runs, agents, etc.)
│   ├── worker       # Scripts: decide, compute-crowd-metrics, compute-rewards, import-market-csv, backtest-v0
│   └── web          # React dashboard
├── packages/
│   └── db           # @crowdvest/db — Prisma client + schema (ONLY place for Prisma)
├── scripts/         # E2E/smoke: spy_e2e_smoke.sh, backtest_e2e_smoke.sh, learning_v1_smoke.sh, etc.
└── docker-compose.yml
```

---

## 🗺️ Repo Map & Paths (WSL) — Source of Truth

Use this section to regain orientation in a new chat. All paths are absolute-from-repo-root with leading `/`.

### 1) Monorepo structure (pnpm workspaces)

Workspace package paths:

- `/apps/api`
- `/apps/web`
- `/apps/worker`
- `/packages/db`
- `/packages/shared`
- `/packages/sim-core`

### 2) How to run commands correctly (critical gotchas)

- `pnpm -C apps/api ...` runs from `/apps/api` (path is relative to repo root).
- `pnpm -C packages/db ...` runs from `/packages/db`.
- Root wrapper scripts (`db:status`, `db:migrate`, etc.) call into **apps/api**, which then delegates to **packages/db** with `pnpm -C ../../packages/db run ...`. From `apps/api`, `packages/db` would resolve to `apps/api/packages/db` (wrong); hence scripts in `apps/api` use `../../packages/db`.

List workspaces:

```bash
pnpm -r --depth -1 list
pnpm -r --depth -1 list --json | jq -r '.[].path'
```

### 3) DB / Prisma location and env loading

- **Prisma schema and migrations** (only location in repo):
  - `/packages/db/prisma/schema.prisma`
  - `/packages/db/prisma/migrations/`
- **Prisma env** is loaded from: `/packages/db/prisma/.env`
- **DB migrations are managed from packages/db only** (not from apps/api). Prisma CLI and migrate commands run via `packages/db` scripts (e.g. `node scripts/with-env.js migrate ...`).

### 4) Root DB commands

| Action | Command | Expansion |
|--------|---------|-----------|
| Status | `pnpm db:status` | `pnpm -C apps/api run db:status` → `pnpm -C ../../packages/db run db:status` |
| Deploy | `pnpm db:migrate` | `pnpm -C apps/api run db:deploy` → `pnpm -C ../../packages/db run db:deploy` |
| **DEV-ONLY reset** | `pnpm db:reset` | Hard-resets local DB (drop + reapply all migrations). **Never use in prod.** Use when Prisma is blocked by failed migration P3009. |

### 5) Known Issue: DB_NOT_READY / P3009

- **Symptom:** API endpoint returns 503 with `{"error":{"code":"DB_NOT_READY","message":"Database schema not migrated"}}`.
- **Root cause:** A failed Prisma migration blocks deploy (e.g. `20260210200000_add_run_variant_summary`).
- **Fix (dev):**
  ```bash
  pnpm db:reset
  pnpm db:migrate
  pnpm db:status
  ```
- **Verification:**
  ```bash
  curl -i http://localhost:4001/health
  curl -i "$API/runs/$RUN_ID/variants?assetSymbol=$ASSET" | head -n 80
  ```
  Response should no longer be 503 DB_NOT_READY.

### 6) Worker Backtest Smoke Test (exact happy path)

Copy-paste sequence:

```bash
API=http://localhost:4001
ASSET=SPY
STEPS=29
AGENTS=200
CSV="$(pwd)/apps/worker/data/market/spy.us.daily.sample.csv"
RUN_ID="$(curl -fsS -X POST "$API/runs" | jq -r .id)"

pnpm -C apps/worker run import-market-csv -- --runId "$RUN_ID" --assetSymbol "$ASSET" --csv "$CSV" --priceField close
pnpm -C apps/worker run backtest-v0 -- --runId "$RUN_ID" --assetSymbol "$ASSET" --steps "$STEPS" --agents "$AGENTS" --seedStart 1 --seeds 3
```

Note: backtest-v0 internally calls decide + compute-crowd-metrics per seed.

### 7) CTO operating mode reminders

- We produce **Cursor-ready prompts only** (Avner doesn’t touch code directly).
- Every task must include: **what file to edit**, **exact code**, **CLI command**, **verification check**.

---

## Prisma & database

- **Schema path:** `packages/db/prisma/schema.prisma`
- **Model naming:** e.g. **CrowdMetrics** (plural), not CrowdMetric.
- **DATABASE_URL:** Often includes `?schema=public` (or other query params). That **breaks** `psql $DATABASE_URL`. Strip for psql:
  ```bash
  DB_URL_PSQL="${DATABASE_URL%\?*}"
  psql "$DB_URL_PSQL"
  ```
- **Postgres columns:** CamelCase; must be **double-quoted** in raw SQL: `"runId"`, `"assetSymbol"`.

---

## Reward loop v1 & Learning v1

- **AgentState** is the **learning source-of-truth** (runId, assetSymbol, agentId, step, confidence, riskTolerance, herding, infoSignal, exposedCount).
- **Decide** upserts AgentState per (runId, assetSymbol, agentId, step) with baseline from traits and infoSignal/exposedCount.
- **compute-rewards:**
  - `--overwrite=true`: compute rewards + ensure baseline AgentState (no learning).
  - `--overwrite=false`: compute rewards then **per-step learning** into AgentState (prev from AgentState step-1; decay-to-baseline formulae). Use this for learning verification.
- **API:** `GET /results/agent-rewards?runId=&assetSymbol=&agentId=&fromStep=&toStep=`. `GET /results/agent-state?runId=&assetSymbol=&agentId=&historyLimit=` — reads **AgentState**; returns **latest** (max step) and **stepHistory** (last N steps). **historyLimit** default 10, max 100.
- **DEBUG_LEARNING=1:** worker logs prev→new for first agent once per step.

```bash
# Example verification (WSL)
export RUN_ID="<uuid>" API="http://localhost:4001" AGENT_ID="<uuid>"
pnpm -C apps/worker run decide -- --runId "$RUN_ID" --assetSymbol RUN --overwrite true
pnpm -C apps/worker run compute-rewards -- --runId "$RUN_ID" --assetSymbol RUN --overwrite false
curl -fsS "$API/results/agent-state?runId=$RUN_ID&assetSymbol=RUN&agentId=$AGENT_ID" | jq '.latest, .stepHistory[0], .stepHistory[4]'
```

---

## SPY local CSV & AssetStepReturn

- **Path:** `apps/worker/data/market/spy.us.daily.sample.csv` (date, open, high, low, close, volume, symbol, source).
- **import-market-csv:** Reads CSV, sorts by date asc, computes step returns, upserts **AssetStepReturn** for (runId, assetSymbol). Requires `date` column and a price column (default `close`; `--priceField` for another).
- **Step return formula:** `stepReturn[0]=0`; for t≥1: `stepReturn[t] = (price[t]-price[t-1])/price[t-1]`.
- **CSV path handling:** When running from `apps/worker`, pass path **relative to repo root** (e.g. `apps/worker/data/market/spy.us.daily.sample.csv`) or **absolute**; script tries cwd then repo root.

```bash
pnpm -C apps/worker run import-market-csv -- --runId <RUN_ID> --assetSymbol SPY --csv apps/worker/data/market/spy.us.daily.sample.csv --priceField close
```

- **AssetStepReturn is per runId:** Each SimulationRun has its own rows (runId + assetSymbol + step). **Backtest must use the SAME runId** that has AssetStepReturn; otherwise corr/directionalAccuracy are null.

---

## Backtest v0 (per-seed, same runId)

- **Script:** `pnpm -C apps/worker run backtest-v0`
- **Required/optional:** `--runId <id>` optional; if omitted, script **creates one run** and prints it. **--csv** required when AssetStepReturn count for (runId, assetSymbol) is 0 (script imports into that runId). **--priceField** default `close`.
- **Seeds:** Same runId for all seeds; seeds only affect agent randomness (generate/decide), not run identity.
- **Flow:** Resolve runId → ensure AssetStepReturn for (runId, assetSymbol) [if count=0 and --csv, import; else throw] → for each seed: agents/generate overwrite → decide → compute-crowd-metrics → read CrowdMetrics + AssetStepReturn from **same runId** → corr/directionalAccuracy → persist BacktestResult.
- **Critical:** Decide **overwrite cleanup must NOT delete AssetStepReturn** (market data is input). If decide overwrite deleted AssetStepReturn, backtest later sees count=0 and fails with "AssetStepReturn count is 0 ... Import CSV first".
- **API:** `GET /results/backtests?assetSymbol=SPY&limit=50` — items with nullable corr/directionalAccuracy.

```bash
# Smoke: create run, import CSV, then backtest with that runId
RUN_ID=$(curl -sS -X POST http://localhost:4001/runs -H "Content-Type: application/json" -d "{}" | jq -r '.id')
pnpm -C apps/worker run import-market-csv -- --runId "$RUN_ID" --assetSymbol SPY --csv apps/worker/data/market/spy.us.daily.sample.csv --priceField close
pnpm -C apps/worker run backtest-v0 -- --runId "$RUN_ID" --assetSymbol SPY --steps 29 --agents 200 --seeds "1,2,3,4,5" --csv apps/worker/data/market/spy.us.daily.sample.csv --priceField close
curl -sS "http://localhost:4001/results/backtests?assetSymbol=SPY&limit=5"
```

---

## Stability gates

| Command | Script | What it does |
|---------|--------|--------------|
| `pnpm verify:learning-v1` | `scripts/learning_v1_smoke.sh` | Mini-flow: decide overwrite, step4 rumor, compute-crowd-metrics, compute-rewards overwrite=false. Asserts AgentReward count, AgentState progression (step0 vs step4), crowd-state step4 herdingIndex + noiseSensitivity. API_BASE default http://localhost:4001. |
| `pnpm verify:spy-e2e` | `scripts/spy_e2e_smoke.sh` | **Always creates a NEW run** (POST /runs), imports SPY CSV, agents/generate 200, decide steps=29, compute-crowd-metrics, compute-rewards. Asserts agents count, agent-rewards total 200×29, crowd-state step28 wisdomScore, agent-state latest.step=28. Ends with "=== SPY E2E checks passed ===". |
| `pnpm verify:backtest-e2e` | `scripts/backtest_e2e_smoke.sh` | Creates run, imports CSV, runs backtest-v0 with --runId; asserts output contains pairsCount=28, GET /results/backtests 200 and at least one non-null corr. |

---

## InfoEvents & crowd metrics

- **Endpoints:** `POST /info-events`, `GET /info-events?runId=&assetSymbol=&step=`; also `POST/GET/DELETE /runs/:runId/info-events`.
- **NoiseSensitivity:** Worker computes per step from InfoEvents (lowCredEventStrength × decisionVolatility, clamped). If API returns `noiseSensitivity: 0` while worker persisted non-zero, **fix is in API mapper**: `apps/api/src/results` — crowd-state builder must **select** and **map** `noiseSensitivity` (e.g. `noiseSensitivity: row.noiseSensitivity ?? 0` in per-step response).

```bash
# Verify crowd metrics after recompute
pnpm -C apps/worker run compute-crowd-metrics -- --runId "$RUN_ID" --assetSymbol RUN
curl -fsS "$API/results/crowd-state?runId=$RUN_ID&assetSymbol=RUN" | jq '.perStep[4] | {herdingIndex, noiseSensitivity}'
```

---

## Current status

- **Learning v1:** Checks passed; AgentState progression and compute-rewards overwrite=false verified.
- **SPY E2E:** Checks passed after ensuring new run creation and correct agent count (200×29 rewards, crowd-state step28, agent-state latest.step=28).
- **Backtest:** Results endpoint previously returned 500 (fixed). Then returned 200 but **corr/directionalAccuracy null** when runs had no AssetStepReturn — diagnosed via psql (count AssetStepReturn per runId). Root causes: (1) decide overwrite was deleting AssetStepReturn (bug — now fixed: decide overwrite must NOT delete AssetStepReturn). (2) Backtest must use same runId that has AssetStepReturn (single runId, import CSV into it or pass --runId of pre-imported run).

---

## Next steps (actionable)

1. **Decide overwrite:** Confirm decide overwrite cleanup does **not** delete AssetStepReturn (already fixed in code; verify with a run → import CSV → decide overwrite → check AssetStepReturn count still > 0).
2. **Backtest-v0:** Ensure it uses one runId and imports CSV into that run when count=0; keep debug logs (runId, assetStepReturnRows, perStepEntries, pairsCount).
3. **API:** Map UUID→name where useful; stabilize endpoints; add better run/summary responses.
4. **Scripts:** Document or add a single flow script: create run → import market CSV → generate agents → decide → compute-crowd-metrics → compute-rewards → (optional) backtest-v0 with --runId.

---

## Known pitfalls & fixes

| Pitfall | Error / symptom | Fix / workaround |
|---------|------------------|------------------|
| Prisma not found | `Command prisma not found` at repo root | Prisma lives only in `packages/db`. Use `pnpm -C packages/db exec prisma <cmd>`. |
| psql fails on DATABASE_URL | Connection or protocol error when using `psql $DATABASE_URL` | Strip query string: `DB_URL_PSQL="${DATABASE_URL%\?*}"` then `psql "$DB_URL_PSQL"`. |
| Raw SQL column not found | Postgres "column does not exist" for runId/assetSymbol | Columns are camelCase; quote: `"runId"`, `"assetSymbol"`. |
| noiseSensitivity 0 in API | Worker logs show non-zero CrowdMetrics.noiseSensitivity but API returns 0 | API mapper in `apps/api/src/results`: include noiseSensitivity in select and map into perStep[].noiseSensitivity. |
| Backtest corr null | "AssetStepReturn count is 0" or pairsCount=0 → corr/directionalAccuracy null | (1) Decide overwrite must NOT delete AssetStepReturn. (2) Backtest must run on same runId that has AssetStepReturn; create run, import CSV, then run backtest-v0 with --runId. |
| GET /results/backtests 500 | API build or runtime error on backtests endpoint | parseLimit in results controller: use single-arg signature; default 50, max 200 in parse-query. Ensure `pnpm -C apps/api build` passes. |
| CSV not found (worker) | "CSV file not found" when running from apps/worker | Pass path relative to repo root (e.g. `apps/worker/data/market/...`) or absolute; script resolves via cwd and repo root. |

---

## Where to continue

- [ ] Run `pnpm -C packages/db exec prisma migrate dev` / `generate` only from packages/db context.
- [ ] Use `API_BASE=http://localhost:4001` (or leave default) for all scripts and curl.
- [ ] After decide with overwrite, confirm AssetStepReturn rows still exist for that runId+assetSymbol.
- [ ] For backtest: one runId, CSV imported into that run, then backtest-v0 with that --runId (or omit --runId and pass --csv so script creates and imports).
- [ ] Verify: `pnpm verify:learning-v1`, `pnpm verify:spy-e2e`, `pnpm verify:backtest-e2e` (if available).

END CONTEXT
