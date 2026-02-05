# CrowdVest Web (Results UI)

Minimal web UI to view simulation results. Functionality only; no styling focus.

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

## Screenshots

To capture screenshots: run API + web, open `http://localhost:4000`, load a run that has data (e.g. after `pnpm --filter worker sim:run -- --name test --agents 10 --steps 5`), then screenshot the runs table and the run detail (metrics + agents table).
