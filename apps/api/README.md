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
