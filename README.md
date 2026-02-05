# crowdvest

Monorepo (pnpm workspaces + Turborepo).

## How to run locally

```bash
pnpm install
pnpm dev
pnpm lint
```

- **pnpm install** — install dependencies for all workspaces.
- **pnpm dev** — run all apps in dev mode (web, api, worker).
- **pnpm lint** — lint all apps and packages.

Other commands: `pnpm build`, `pnpm test`.

## Database (Package A+ migration and seed)

**Single source of truth:** `DATABASE_URL` is read from repo root `.env`. All Prisma commands use `packages/db/scripts/with-env.js`, which loads root `.env` before running (CI sets `DATABASE_URL` directly).

Apply migrations and seed in this order:

1. **Precheck** (deduplicate `SimulationRun` so the unique constraint can be added, if needed):
   ```bash
   pnpm --filter @crowdvest/db db:precheck
   ```
2. **Verify migration integrity** (fail-fast if any migration folder is missing `migration.sql`):
   ```bash
   pnpm verify:db
   ```
3. **Migrate** (add ImportRun, RunDebug, unique constraint, etc.):
   ```bash
   pnpm --filter @crowdvest/db migrate:deploy
   ```
4. **Generate** Prisma client (if not already run by migrate):
   ```bash
   pnpm --filter @crowdvest/db prisma:generate
   ```
5. **Seed**:
   ```bash
   pnpm --filter @crowdvest/db db:seed
   ```

Requires Postgres running (e.g. `docker compose up -d`) and `DATABASE_URL` in repo root `.env`.

## Reproducing simulation locally (SELL actions)

To reproduce a standard simulation run and verify SELL actions:

1. **Start API** (in one terminal):
   ```bash
   pnpm --filter api run start:prod
   ```

2. **Run smoke simulation** (in another terminal):
   ```bash
   pnpm --filter worker sim:smoke
   ```

3. **Verify gate**:
   ```bash
   pnpm verify:run
   ```

**Expected output:**
- `Gate PASSED`
- `metrics.totalSell >= 1`
- `debug.decisionHistogram` and `debug.prePersistHistogram` match `debug.persistedHistogram` (BUY/SELL/HOLD counts)
- No `NO_SELL_ACTIONS` or `EXTREME_BUY_BIAS` in warnings

The sim-core uses deterministic SELL rules: after BUY, agents SELL on the next step (hasBought && !hasSoldAfterBuy), or when take-profit/stop-loss/max-hold-steps thresholds are hit. Defaults: `TAKE_PROFIT=0.001`, `STOP_LOSS=0.001`, `MAX_HOLD_STEPS=2`.

**Debug data:** The `RunDebug` table stores `prePersistHistogram` and `samplePrePersistActions` from the worker. Apply migrations before running simulations:

```bash
pnpm verify:db
pnpm --filter @crowdvest/db migrate:deploy
```

If `debug.prePersistHistogram` is null for new runs, migration integrity may be broken (P3015) or migrations not applied. Run `pnpm verify:db` then `migrate:deploy`, then `sim:smoke` again.
