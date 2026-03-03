# CrowdVest Web (Results UI)

Minimal web UI to view simulation results. Functionality only; no styling focus.

## When you see 427.js / routes-manifest missing (500 errors)

Next.js can serve stale or corrupted build artifacts (e.g. `Cannot find module './427.js'`, missing `routes-manifest.json`). Common causes: concurrent `next dev` processes, interrupted builds, or leftover `.next` from a different branch. **Recovery:** run `pnpm -C apps/web reset:next` then restart `pnpm -C apps/web dev`.

## Run

1. Start the API (must be reachable by the browser):
   ```bash
   pnpm --filter api dev
   ```
   API runs at `http://localhost:4001` by default.

2. Start the web app:
   ```bash
   pnpm --filter web dev
   ```
   Open `http://localhost:4000`.

## E2E tests (Playwright)

1. Ensure the dev server is running (`pnpm dev` or `pnpm -C apps/web dev`).
2. Run E2E tests:
   ```bash
   pnpm -C apps/web test:e2e
   ```
3. Optional: run with UI mode for debugging:
   ```bash
   pnpm -C apps/web test:e2e:ui
   ```

### Linux deps

On Ubuntu/WSL, Playwright’s Chromium needs system libraries (e.g. `libnspr4`, `libnss3`). Prefer Playwright’s built-in installer:

```bash
cd ~/crowdvest

# install Playwright OS deps (preferred, covers libnspr4 and friends)
pnpm -C apps/web exec playwright install-deps

# if the above fails (no sudo / permissions), fallback:
sudo apt-get update
sudo apt-get install -y libnspr4 libnss3

# (optional) ensure browsers exist
pnpm -C apps/web exec playwright install chromium
```

3. (Optional) Point the UI at another API:
   ```bash
   NEXT_PUBLIC_API_BASE=http://your-api:4001 pnpm --filter web dev
   ```

## UI overview

- **Runs table**: Lists runs (name, status, steps, created, id). Pagination: first 50 runs.
- **Click a run row**: Loads aggregated metrics and agent results for that run.
- **Run detail**:
  - **Aggregated metrics (run)**: agentCount, totalPnl, avgPnl, avgRisk, totalSteps, totalReward, action counts.
  - **By archetype**: Table of archetype-level metrics for the run.
  - **Agent results**: Table of per-agent pnl, risk, reward, steps, and buy/sell/hold counts.

## Files

- `src/app/page.tsx` — Main page (runs table, run detail, summary, agents table). Client component.
- `src/app/runs/page.tsx` — Runs list at `/runs` (table, refresh).
- `src/app/runs/[id]/page.tsx` — Run detail at `/runs/[id]` (compact summary, metrics, validation, warnings).
- `src/app/results-api.ts` — Fetch helpers and types (GET /results/runs, /results/agents, /results/summary, /results/summary-compact).

## Verification: Run detail page (`/runs/[id]`)

1. **URLs**  
   - Web: `http://localhost:4000`  
   - API: `http://localhost:4001`  

2. **Setup**  
   - API and web dev servers running.  
   - At least one completed run (e.g. `pnpm --filter worker sim:smoke`).  

3. **Checks**  
   - Open `http://localhost:4000/runs` → runs table with "View" links.  
   - Click "View" for a run → `/runs/[id]` loads.  
   - Page shows: Run ID, Metrics (agentCount, totalPnl, avgPnl, avgRisk, totalSteps, buys/sells/holds), Validation (pctProfitableAgents, archetypeDispersion), Warnings (highlighted box if any).  
   - "Back to runs" navigates to `/runs`.  
   - "Refresh" reloads the compact summary.  
   - Open `/runs/00000000-0000-0000-0000-000000000000` → "Run not found" message.

## Product Checks: Bet status label (OPEN / Open)

API returns `bet.status = "OPEN"` or `"SETTLED"`; UI shows **Open** / **Settled** via `formatBetStatus(status)` (no "Pending"). Used in Run Details "Bets on this run" and `/bets` My Bets table. Backend enums unchanged.

**Manual check steps**

- **Place Bet** → New row status column shows **OPEN** / **Open**.
- **Click Settle Bets (v1)** on Run Details → After refresh, that row status shows **SETTLED** / **Settled**.

---

1. **Create an OPEN bet (assetSymbol RUN)**  
   From repo root with API at `http://localhost:4001`:

   ```bash
   USER_ID="480117fb-d641-4afe-9d32-63310ff14511"
   RUN_ID="<run-uuid-from-get-runs>"

   curl -s -X POST http://localhost:4001/bets \
     -H "Content-Type: application/json" \
     -d "{\"userId\":\"$USER_ID\",\"runId\":\"$RUN_ID\",\"assetSymbol\":\"RUN\",\"direction\":\"BUY\",\"amount\":10,\"openStep\":0}" | jq .
   ```

2. **Refresh Run Details UI**  
   Open `http://localhost:4000/runs/<RUN_ID>` (or navigate to the run and click Refresh). In the "Bets on this run" table, confirm the new bet’s status column shows **Open** (not "Pending"). Settled bets should show **Settled**.

3. **My Bets page**  
   Open `http://localhost:4000/bets?userId=...` (or use the same `USER_ID` in the query). Confirm the table shows **Open** / **Settled** labels consistently.

## Screenshots

To capture screenshots: run API + web, open `http://localhost:4000`, load a run that has data (e.g. after `pnpm --filter worker sim:run -- --name test --agents 10 --steps 5`), then screenshot the runs table and the run detail (metrics + agents table).
