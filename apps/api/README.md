# API (CrowdVest)

NestJS REST API for CrowdVest. Reads configuration from the repository root `.env` or `apps/api/.env`.

## Required environment variables

| Variable       | Description                                      |
|----------------|--------------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection URL (required at startup). |

Env is loaded from (first existing file wins per variable): `../.env`, `.env`, `apps/api/.env` (so repo-root `.env` is used when running from `apps/api`). Create a `.env` at the **repository root** so all apps share the same config.

**Recommendation:** Use unquoted values in `.env` to avoid parser ambiguity (e.g. `DATABASE_URL=postgresql://...` not `DATABASE_URL="..."`).

## Example: local Docker Compose

With Postgres from the repo `docker-compose.yml` (user `crowdvest`, password `crowdvest_dev_pw`, db `crowdvest` on port 5432):

```env
DATABASE_URL=postgresql://crowdvest:crowdvest_dev_pw@localhost:5432/crowdvest?schema=public
```

## Run

From repo root:

```bash
pnpm --filter api dev
```

From `apps/api`:

```bash
pnpm dev
```

If `DATABASE_URL` is missing, the API will fail at startup with a clear error telling you to add it to a root or app-level `.env`.

## Post-run verification (compact)

For CI and fast post-run checks, use the compact summary endpoint:

```bash
# With run_id (from sim:run / sim:ci output)
curl "http://localhost:4001/results/summary-compact?run_id=<run_id>"

# Or use the script (picks latest run if run_id omitted)
chmod +x scripts/check-summary-compact.sh
./scripts/check-summary-compact.sh
./scripts/check-summary-compact.sh <run_id> http://localhost:4001
```

Response: `runId`, `metrics`, `validation`, `archetypeTotals`, `warnings[]`. See `src/results/RESULTS_API.md`.

### Gate script and CI

The **post-run gate** script checks health, run existence, and invariants (sums match, steps sanity). It prints `RUN_ID` and `warnings`; it does not fail on warnings.

```bash
# From repo root (RUN_ID required: env or first arg)
RUN_ID=<uuid> pnpm verify:run
./scripts/post_run_gate.sh <run_id>

# Turbo pipeline
turbo run verify:run
```

CI: the main workflow (`.github/workflows/ci.yml`) runs build, lint, test. To run the gate in CI, ensure the API is up and set `RUN_ID`, then run `pnpm verify:run` (e.g. after a sim job that exports `RUN_ID`).

## Product Checks: POST /bets userId

Verify that the created bet’s `userId` always equals the request body’s `userId` (no server-side substitution). From repo root with API at `http://localhost:4001`.

**1) Create a bet with a known USER_ID**

Replace `USER_ID` and `RUN_ID` with valid UUIDs (e.g. from your app identity and `GET /runs` or latest sim run).

```bash
USER_ID="480117fb-d641-4afe-9d32-63310ff14511"
RUN_ID="<your-run-uuid>"

curl -s -X POST http://localhost:4001/bets \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"runId\":\"$RUN_ID\",\"assetSymbol\":\"RUN\",\"direction\":\"BUY\",\"amount\":10,\"openPrice\":1,\"openStep\":0}" | jq .
```

**2) Verify via GET /bets?userId=&lt;same&gt; that it appears**

```bash
curl -s "http://localhost:4001/bets?userId=$USER_ID&limit=50" | jq '.items[] | {id, userId, status, pnl}'
```

**3) Verify the returned bet.userId equals the requested userId**

```bash
curl -s "http://localhost:4001/bets?userId=$USER_ID&limit=50" | jq '.items[0].userId == "'"$USER_ID"'"'
```

Expect: `true`.

**4) Run settle and confirm settlement still works**

```bash
pnpm -C apps/worker run settle -- --runId "$RUN_ID" --closeStep 10
```

Then re-check GET /bets: bet should be `status: "SETTLED"` and `pnl` set.

**5) Confirm results endpoints still work**

```bash
curl -s "http://localhost:4001/results/runs?limit=1" | jq .
curl -s "http://localhost:4001/results/agents?run_id=$RUN_ID" | jq '.items | length'
```

---

## Product Checks (WSL): Place Bet

Same payload shape the web UI sends (no `openPrice`; API derives from run timeseries). From repo root with API at `http://localhost:4001` and worker available.

**1) Create a bet (UI-shaped payload)**

```bash
USER_ID="480117fb-d641-4afe-9d32-63310ff14511"
RUN_ID="<your-run-uuid>"

curl -s -X POST http://localhost:4001/bets \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"runId\":\"$RUN_ID\",\"assetSymbol\":\"RUN\",\"direction\":\"BUY\",\"amount\":10,\"openStep\":0}" | jq .
```

**2) GET /bets?userId=... shows the bet OPEN**

```bash
curl -s "http://localhost:4001/bets?userId=$USER_ID&limit=50" | jq '.items[] | {id, userId, status, openStep, amount}'
```

**3) Run settle and verify bet becomes SETTLED**

```bash
pnpm -C apps/worker run settle -- --runId "$RUN_ID" --closeStep 10
curl -s "http://localhost:4001/bets?userId=$USER_ID&limit=50" | jq '.items[] | {id, status, pnl}'
```

**4) Regression: /results/summary-compact still works**

```bash
curl -s "http://localhost:4001/results/summary-compact?run_id=$RUN_ID" | jq .
```

**5) assetSymbol=RUN (v1) must succeed**

POST /bets with `assetSymbol="RUN"` must return 200. From repo root:

```bash
USER_ID="480117fb-d641-4afe-9d32-63310ff14511"
RUN_ID="<your-run-uuid>"

curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:4001/bets \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"runId\":\"$RUN_ID\",\"assetSymbol\":\"RUN\",\"direction\":\"BUY\",\"amount\":10,\"openStep\":0}"
```

Expect: HTTP 200 and JSON bet object (e.g. `id`, `userId`, `status: "OPEN"`, `assetSymbol`). Non-200 or validation error means assetSymbol validation needs to allow `"RUN"`.
