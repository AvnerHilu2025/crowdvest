# Web Runs UI — verification checklist

## URLs

| URL | Description |
|-----|-------------|
| http://localhost:4000 | Web app (home) |
| http://localhost:4000/runs | Runs list page |
| http://localhost:4000/runs/[id] | Run detail page (replace `[id]` with a run UUID) |
| http://localhost:4001 | API base |
| http://localhost:4001/results/runs | Runs API endpoint |

## Prerequisites

1. API running: `pnpm --filter api dev` (or `pnpm dev` from root)
2. Web running: `pnpm --filter web dev` (or `pnpm dev` from root)
3. At least one simulation run in the database (run `pnpm --filter worker sim:smoke` if needed)

## Expected behavior

### /runs page

- **Loading**: Shows "Loading runs…" then a table
- **Empty**: Shows "No runs found" in table body
- **With data**: Table columns: Name, Run ID (8 chars), Timestamp (human-readable), Steps, Status (PENDING/RUNNING/COMPLETED/FAILED), View link
- **Refresh**: Click "Refresh" — reloads runs; button shows "Loading…" while fetching
- **Error**: If API unreachable, shows "Error: runs: …" in red

### /runs/[id] page

- **Loading**: Shows "Loading run…"
- **Success**: Shows run name, ID, status, steps; aggregated metrics; by-archetype table; agent results table
- **Back**: "← Back to runs" links to /runs
- **Error**: If run not found or API error, shows error and back link

### API response handling

- The runs list handles both `{ items: [...], total: N }` and raw array `[...]` from the API
- No UI library; uses plain HTML table and minimal inline styles

## Env override

To use a different API base:

```bash
# In .env.local or environment
NEXT_PUBLIC_API_BASE=http://your-api:4001
```

Default is `http://localhost:4001` when not set.
