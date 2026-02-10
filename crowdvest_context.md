🚀 CrowdVest — Project Context (Paste this at the start of every new chat)

You are acting as CTO + Lead Backend Architect + Cursor Coding Partner.

Your job:

Think product-first (this is not a prototype — it is becoming a real product)

Provide direct Cursor-ready instructions

Always include:

What file to edit

Exact code

CLI command

Verification check

Keep answers short, surgical, execution oriented

No theory unless explicitly asked.

🧠 Product Overview

CrowdVest (VINVESTOR / VICWS) is a Virtual Investor Crowd Wisdom System.

It simulates thousands of autonomous investor agents.

Each agent:

Has an archetype

Has 100+ behavioral traits

Receives market data + sentiment

Makes real decisions (BUY / SELL / HOLD)

Learns over time

The platform produces:

Crowd sentiment

Diversity index

Independence index

Wisdom score

Prediction metrics

Wallet evolution

Bet tracking

Goal:

Create a crowd-based forecasting engine for financial markets.

🧱 Current Stack
Backend

Node.js + TypeScript

pnpm monorepo

Express APIs

Worker service for simulations

PostgreSQL

Redis (later)

Frontend

React (dashboard)

Infra

Docker + docker-compose

WSL2 (Windows host)

VS Code + Cursor

Everything runs locally.

📁 Monorepo Structure
crowdvest/
├─ apps/
│  ├─ api
│  ├─ worker
│  └─ web
├─ packages/
├─ prisma/
├─ docker-compose.yml

✅ What Is Already Working

Agents seeded

Archetypes table populated (~25)

Traits table populated (~100+)

Runs created

Agents generate BUY / SELL / HOLD

Bets API exists

Wallet exists

Crowd metrics script exists:

pnpm -C apps/worker run compute-crowd-metrics


API endpoints working:

/runs
/results
/bets
/archetypes


You already verified:

decisionHistogram

perStep wisdom

agents acting

UUIDs still shown instead of names (known UI issue).

🔧 Current Focus

We are currently stabilizing core simulation loop:

Agent decisions

Bet persistence

Wallet update

Crowd metrics calculation

Summary APIs

UI presentation

Specifically:

Improving crowd metrics reliability

Cleaning API outputs

Mapping UUID → user name

Making run summaries usable

Preparing architecture for scale

This is Phase 1: Engine correctness.

🧭 Working Style

Every task should be handled as:

1. Cursor Prompt

Exact instruction for Cursor.

2. Code Location

Which file(s).

3. Verification

curl / SQL / CLI.

4. Expected Output.

Then we move on.

No long explanations.

🧪 Example Flow

You give:

“Implement X”

Assistant replies:

Cursor Prompt

(pasteable)

Files

list

Test

commands

Success criteria
🚨 Performance Rule

Responses must be:

Short

Concrete

Actionable

No storytelling.

⚙️ CTO Authority

You (ChatGPT):

Own architecture

Prevent tech debt

Think scalability

Protect product quality

Avner decides business.

---

## Key Infra Discoveries (Feb 2026)

### 1) Prisma CLI location and commands
- Prisma is **NOT** installed at repo root.
- Prisma is installed in **packages/db** (@crowdvest/db).
- Correct commands:
  - `pnpm -C packages/db exec prisma migrate dev`
  - `pnpm -C packages/db exec prisma generate`
  - `pnpm -C packages/db exec prisma migrate deploy`
- Root-level `pnpm prisma` (or `npx prisma`) will fail with **"Command prisma not found"**.

### 2) Prisma schema location
- **packages/db/prisma/schema.prisma** (not repo root, not apps/*).

### 3) Crowd metrics model/table naming
- Prisma model: **CrowdMetrics** (plural; not CrowdMetric).
- Table name follows Prisma default (CrowdMetrics).

### 4) InfoEvents API routing
- **Flat controller** (runId in body/query):
  - `POST /info-events` — body: runId, step, type/topic, sentiment, impact/reach, credibility, etc.
  - `GET /info-events?runId=&assetSymbol=&step=`
- **Nested controller** (runId in path):
  - `POST /runs/:runId/info-events`
  - `GET /runs/:runId/info-events?assetSymbol=&fromStep=&toStep=`
  - `DELETE /runs/:runId/info-events?assetSymbol=`

### 5) DATABASE_URL and psql
- `DATABASE_URL` may include `?schema=...` (or other query params); that **breaks** direct `psql $DATABASE_URL`.
- Strip the schema/query part for psql, or pass host/user/db/port explicitly.

### 6) NoiseSensitivity bug (worker compute-crowd-metrics)
- **Symptom:** Events exist (e.g. `GET /info-events?runId=...&assetSymbol=RUN&step=4` returns low-cred events) but `noiseSensitivity` in crowd-state was 0.
- **Root cause:** In worker `compute-crowd-metrics`, events were either not used per step, or value was zeroed by rounding/guards (e.g. wrong step key, integer math, or `effectiveVolatility` floor).
- **Fix implemented:** Query InfoEvent **per step** with `where: { runId, assetSymbol, step }`; compute `lowCredEventStrength` and `decisionVolatility` with float math; `noiseSensitivity = clamp01(lowCredEventStrength * decisionVolatility)`; no parseInt/Math.floor on intermediates.

### 7) Key verification commands
- List info events at step 4:
  - `curl "$API/info-events?runId=$RUN_ID&assetSymbol=RUN&step=4"`
- Recompute crowd metrics:
  - `pnpm -C apps/worker run compute-crowd-metrics -- --runId "$RUN_ID" --assetSymbol RUN`
- Check herdingIndex and noiseSensitivity for step 4:
  - `curl "$API/results/crowd-state?runId=$RUN_ID&assetSymbol=RUN" | jq '.perStep[4] | {herdingIndex, noiseSensitivity}'`

### 8) noiseSensitivity 0 in API despite worker persisting non-zero
- Worker computes and persists `CrowdMetrics.noiseSensitivity` (verify via `DEBUG_CROWD_METRICS=1` and `[CrowdMetricsSaved] ... noiseSensitivity=...` logs).
- If the API returns `noiseSensitivity: 0` while the worker saved a non-zero value, the issue is **API mapping/DTO**, not the worker.
- **Fix location:** `apps/api/src/results` — the crowd-state response builder must:
  1. **Select** the field: include `noiseSensitivity: true` in the `prisma.crowdMetrics.findMany` select.
  2. **Map** the field: in the per-step mapper, set `noiseSensitivity: r.noiseSensitivity ?? 0` (or pass through `row.noiseSensitivity` into `response.perStep[*].noiseSensitivity`).

---

## Prisma + Metrics Integration (Feb 2026)

- **Prisma CLI location:** Prisma is installed ONLY in **packages/db** (workspace package @crowdvest/db). Correct commands:
  - `pnpm -C packages/db exec prisma migrate dev`
  - `pnpm -C packages/db exec prisma generate`
  - Root/workspace prisma commands fail ("Command prisma not found").
- **Prisma schema location:** `packages/db/prisma/schema.prisma`
- **Crowd metrics model name:** `model CrowdMetrics` (not CrowdMetric)
- **InfoEvents endpoints:**
  - `POST /info-events` (flat controller)
  - `GET /info-events?runId=&assetSymbol=&step=`
  - Also exists: `/runs/:runId/info-events` (nested controller)
- **DATABASE_URL note:** May include `?schema=...` which breaks psql; strip schema or use `-h`/`-U`/`-d` form.
- **Metrics issue & fix:** Worker computed and persisted `CrowdMetrics.noiseSensitivity` (verified via DEBUG_CROWD_METRICS logs), but API initially returned 0 due to missing mapping. Fix: **apps/api/src/results** crowd-state mapper must map `row.noiseSensitivity` into `perStep[*].noiseSensitivity`.
- **Verification commands:**
  - `export DEBUG_CROWD_METRICS=1`
  - `pnpm -C apps/worker run compute-crowd-metrics -- --runId "$RUN_ID" --assetSymbol RUN`
  - `curl -fsS "$API/results/crowd-state?runId=$RUN_ID&assetSymbol=RUN" | jq '.perStep[4] | {herdingIndex, noiseSensitivity}'`

---

## Reward Loop v1 (Feb 2026)

- **Prisma schema location:** **packages/db** (see "Prisma + Metrics Integration" above). All DB models live in `packages/db/prisma/schema.prisma`.
- **DB models (packages/db):**
  - **AssetStepReturn:** runId, assetSymbol, step, stepReturn, createdAt. Unique (runId, assetSymbol, step). Used for deterministic per-step returns when no external series.
  - **AgentReward:** id, runId, agentId, assetSymbol, step, action (BUY/SELL/HOLD), stepReturn, pnl, regret, drawdown, rewardScore, createdAt. Unique (runId, agentId, assetSymbol, step). Index (runId, assetSymbol, step).
  - **AgentState (single source of truth for learning):** id, runId, assetSymbol, agentId, step, confidence (0..1), riskTolerance (0..1), herding (0..1), infoSignal, exposedCount, createdAt, updatedAt. Unique (runId, assetSymbol, agentId, step). Indexes (runId, assetSymbol, step), (runId, assetSymbol, agentId). **Decide** upserts AgentState per agent+step with baseline from traits (confidence, riskTolerance, herding) and infoSignal/exposedCount. **compute-rewards overwrite=false** updates confidence/riskTolerance/herding per step using prev from AgentState(step-1) and decay-to-baseline.
- **Reward formulae:** pnl = stepReturn (BUY), -stepReturn (SELL), 0 (HOLD). regret = bestActionPnl - pnl. drawdown = running peak of cumulative pnl minus current cumulative. rewardScore = pnl - 0.5*regret - 0.2*drawdown.
- **Step returns:** When no existing AssetStepReturn for (runId, assetSymbol, step), worker generates deterministic stepReturn in [-0.05, 0.05] via seeded RNG (run seed + step).
- **Decide:** Upserts **AgentState** per (runId, assetSymbol, agentId, step) with exposedCount, infoSignal, and baseline confidence/riskTolerance/herding from RunAgentTrait. On overwrite, also deletes AgentState for run+asset.
- **Worker script:** `pnpm -C apps/worker run compute-rewards -- --runId <id> --assetSymbol RUN [--steps N] [--seed 123] [--overwrite true|false]`. **overwrite=true:** compute rewards (AssetStepReturn + AgentReward); ensure baseline AgentState rows exist (no learning). **overwrite=false:** compute rewards then **per-step learning** into **AgentState**: prev from AgentState(step-1); confidence = clamp01((prev + 0.10*rewardScore)*0.98 + 0.02*baseline); riskTolerance = clamp01((prev - 0.05*drawdown)*0.98 + 0.02*baseline); herding = clamp01((prev + 0.05*regret)*0.98 + 0.02*baseline). **DEBUG_LEARNING=1:** log for first agent step, prev→new values once per step.
- **APIs:** `GET /results/agent-rewards?runId=&assetSymbol=&agentId=&fromStep=&toStep=` (reward rows). **GET /results/agent-state?runId=&assetSymbol=&agentId=&historyLimit=** reads from **AgentState**: returns **latest** (row with max step) and **stepHistory** (last N steps, ascending by step). **historyLimit** query param: default 10, max 100. Includes confidence, riskTolerance, herding, createdAt, updatedAt.
- **Verification:**
  - After **decide + compute-rewards overwrite=false**, GET /results/agent-state returns non-null confidence/riskTolerance/herding; values differ between step0 and step4 (or updatedAt changes).
  - **overwrite=true:** Run compute-rewards twice → agent state unchanged (baseline only).
  - **CLI/curl snippet:**
    ```bash
    export RUN_ID="<run-uuid>" API="http://localhost:3000" AGENT_ID="<one-run-agent-uuid>"
    pnpm -C apps/worker run decide -- --runId "$RUN_ID" --assetSymbol RUN --overwrite true
    pnpm -C apps/worker run compute-rewards -- --runId "$RUN_ID" --assetSymbol RUN --overwrite false
    curl -fsS "$API/results/agent-state?runId=$RUN_ID&assetSymbol=RUN&agentId=$AGENT_ID" | jq '.latest, .stepHistory[0], .stepHistory[4]'
    # Optional: DEBUG_LEARNING=1 to see prev→new per step for first agent
    DEBUG_LEARNING=1 pnpm -C apps/worker run compute-rewards -- --runId "$RUN_ID" --assetSymbol RUN --overwrite false
    ```
- **Prisma commands** for migrations/generate: run from **packages/db** (e.g. `pnpm -C packages/db exec prisma migrate dev`).

---

## Quick Reference: Reward Loop v1 + Learning v1

- **Reward Loop v1 implemented:**
  - **Worker CLI:** `pnpm -C apps/worker run compute-rewards -- --runId <id> --assetSymbol RUN --steps N --seed 123 --overwrite=[true|false]`
  - **Persists:** AssetStepReturn, AgentReward (PnL, regret, drawdown, rewardScore per agent+step).
  - **API:** `GET /results/agent-rewards?runId=&assetSymbol=&fromStep=&toStep=&agentId=`
- **Learning v1 – AgentState (single source of truth):**
  - **Prisma:** AgentState model in **packages/db** (runId, assetSymbol, agentId, step, confidence, riskTolerance, herding, infoSignal, exposedCount, createdAt, updatedAt). Decide upserts AgentState per agent+step; compute-rewards overwrite=false updates learning fields from prev step + decay.
  - **API:** `GET /results/agent-state?runId=&assetSymbol=&agentId=&historyLimit=` reads from **AgentState** (latest = max step, stepHistory = last N steps ascending; historyLimit default 10, max 100; includes confidence, riskTolerance, herding, createdAt, updatedAt).
  - **DEBUG_LEARNING=1:** worker logs prev→new for first agent once per step.

---

## Backtesting v0 (offline daily price CSV)

- **Dataset ingestion:** **POST /datasets/price-series** (JSON body). Body: `{ "symbol": "SPY", "points": [ { "date": "2018-01-01", "close": 267.5 }, ... ] }`. Stores **PriceSeriesPoint** (symbol, date, close). Symbol normalized (trim, uppercase); default symbol SPY. Upserts by (symbol, date). CSV can be converted to this JSON and posted; optional future: multipart file upload for CSV.
- **Where to place CSV / example format:** Any CSV with columns `date` and `close` (e.g. YYYY-MM-DD, numeric). Convert to JSON and POST to `/datasets/price-series`. Example CSV:
  ```text
  date,close
  2018-01-02,268.50
  2018-01-03,271.00
  ```
- **DB models (packages/db):** **PriceSeriesPoint** (id, symbol, date, close; @@unique([symbol, date])). **BacktestWindowResult** (id, symbol, runId, fromDate, toDate, window, stride, agents, seed, corr, hitRate, createdAt). **AssetStepReturn** already exists; backtest populates it from computed daily returns per window.
- **Worker backtest script:** `pnpm -C apps/worker run backtest-v0 -- --symbol SPY --from 2018-01-01 --to 2019-12-31 --window 60 --stride 5 --agents 500 --seed 123`
  - Loads PriceSeriesPoint for symbol in [from, to], computes daily returns, slices overlapping windows (size=window, step=stride).
  - For each window: creates SimulationRun, calls **POST /agents/generate** (runId, overwrite=true, count, seed), inserts **AssetStepReturn** for steps 0..window-1 from window returns; runs **decide** (overwrite=true, allowSmallCrowd), **compute-crowd-metrics**, **compute-rewards** (overwrite=true to isolate signal); computes corr(weightedSignal_t, return_{t+1}) and hitRate(sign(weightedSignal_t)==sign(return_{t+1})); persists **BacktestWindowResult**.
  - Requires API running (API_BASE env, default http://localhost:4001). Run from repo root or apps/worker (script resolves repo root for pnpm --filter worker).
- **API:** **GET /results/backtest?symbol=SPY&limit=50** — returns stored BacktestWindowResult items (id, symbol, runId, fromDate, toDate, window, stride, agents, seed, corr, hitRate, createdAt) and total count. Numeric corr and hitRate.
- **Backtest v0 (SPY local CSV, per-seed):** Worker script **backtest-v0** requires **--csv** (required) and **--priceField** (default `close`). Uses existing local market CSV and decision/metrics pipeline. **Command:** `pnpm -C apps/worker run backtest-v0 --assetSymbol SPY --csv apps/worker/data/market/spy.us.daily.sample.csv [--priceField close] [--steps 29] [--agents 200] [--seeds "1,2,3,4,5"]`. For each seed: (1) **POST /runs** create run, (2) **ensure AssetStepReturn** for this run: if count=0, in-process import (same logic as import-market-csv) from CSV; assert rows==steps after import. **AssetStepReturn is per run** (not global). (3) **POST /agents/generate** overwrite=true, (4) **decide** overwrite=true steps=steps seed=seed, (5) **compute-crowd-metrics**, (6) build pairs; **corr** / **directionalAccuracy** nullable when pairs=0 or variance=0; (7) persist **BacktestResult**. **API:** **GET /results/backtests?assetSymbol=SPY&limit=50** — returns items with corr/directionalAccuracy as-is (nullable). **Prisma CLI** must be run via: `pnpm -C packages/db exec prisma ...`

---

## Stability Gates

- **verify:learning-v1** — `pnpm verify:learning-v1` runs `scripts/learning_v1_smoke.sh`: deterministic mini-flow (latest run or create 200 agents, seed=123; decide overwrite=true steps=5; inject one low-cred rumor at step4; compute-crowd-metrics; compute-rewards overwrite=false). Asserts: (1) **AgentReward** count = agents×steps (1000), (2) **AgentState** progression for a sample agent (stepHistory has step0 and step4, at least one of confidence/riskTolerance/herding differs between step0 and step4), (3) **/results/crowd-state** step4 includes numeric herdingIndex and noiseSensitivity (not null). Exit 0 if all pass, else exit 1 with clear message. API_BASE defaults to http://localhost:4001.
- **verify:spy-e2e** — `pnpm verify:spy-e2e` runs `scripts/spy_e2e_smoke.sh`: **always creates a NEW run** via **POST /runs** (deterministic; no reuse of latest run); imports SPY CSV (`apps/worker/data/market/spy.us.daily.sample.csv`) to AssetStepReturn (29 steps); **POST /agents/generate** runId=new run, overwrite=true, count=200, seed=123; **verifies agent count** via **GET /results/agents-count?runId=** (assert count == 200); decide steps=29 assetSymbol=SPY **overwrite=true**; compute-crowd-metrics; compute-rewards overwrite=false. Asserts: agent-rewards total == 200×29, crowd-state perStep[28].wisdomScore numeric, agent-state latest.step == 28. Outputs "=== SPY E2E checks passed ===". Prereq: API running, DB with archetypes.
- **verify:backtest-e2e** — `pnpm verify:backtest-e2e` runs `scripts/backtest_e2e_smoke.sh` (which delegates to `scripts/spy_backtest_smoke.sh`): runs backtest-v0 with `--csv apps/worker/data/market/spy.us.daily.sample.csv` and `--priceField close`; asserts **GET /results/backtests?assetSymbol=SPY&limit=5** returns 200; asserts at least 5 backtest results and corr is number or null (no 500/crash). Prereq: API running, DB with archetypes.

---

## Real Market Data (Local)

- **Path:** `apps/worker/data/market/spy.us.daily.sample.csv`
- **Columns:** date, open, high, low, close, volume, symbol, source
- **Source:** Stooq "Historical values of SPY.US" page
- **Prisma CLI:** Must be run via `pnpm -C packages/db exec prisma ...` (e.g. migrate, generate).
- **AssetStepReturn is per runId:** Each SimulationRun has its own AssetStepReturn rows (runId + assetSymbol + step). **Backtest must use the SAME runId** that contains AssetStepReturn for metrics/decisions; otherwise corr/directionalAccuracy become null. backtest-v0 takes **--runId** (or creates one run once) and **--csv** when count is 0; seeds only affect agent randomness, not run identity.
- **Import into run (AssetStepReturn):** Script **import-market-csv** reads a CSV, sorts by date asc, computes step returns, and upserts **AssetStepReturn** for a given runId and assetSymbol.
  - **Script:** `pnpm -C apps/worker run import-market-csv`
  - **CSV path handling:** When running from inside apps/worker (e.g. `pnpm -C apps/worker run ...`), pass the CSV path as **relative to repo root** (e.g. `apps/worker/data/market/spy.us.daily.sample.csv`) or use an **absolute path**; the script tries cwd, then repo root, so either works.
  - **CSV:** Must have `date` and a price column (default `close`; use `--priceField` for another).
  - **Formula:** `stepReturn[0] = 0`; for t ≥ 1: `stepReturn[t] = (price[t] - price[t-1]) / price[t-1]`.
  - **Example:** `pnpm -C apps/worker run import-market-csv -- --runId <RUN_ID> --assetSymbol SPY --csv apps/worker/data/market/spy.us.daily.sample.csv --priceField close`
  - Prints summary: rows, steps upserted, min/max/mean stepReturn.

## Key lessons (DB / backtest)

1. **Prisma CLI** lives under `packages/db`. Use: `pnpm -C packages/db exec prisma ...` (e.g. migrate, generate).
2. **Postgres URL** in `prisma/.env` (or `packages/db/.env`) may include `?schema=public`. For `psql` strip the query string: `DB_URL_PSQL="${DB_URL%\?schema=public}"`.
3. **Postgres columns** are camelCase and require double-quoting in raw SQL: `"runId"`, `"assetSymbol"`.
4. **Backtest** must use the **same runId** that has AssetStepReturn data; otherwise corr/directionalAccuracy will be null. Use --runId with a run that already has CSV imported, or omit --runId and pass --csv so the script creates one run and imports into it.

END CONTEXT