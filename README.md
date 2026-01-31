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

Apply the Package A+ migration and seed in this order:

1. **Precheck** (deduplicate `SimulationRun` so the unique constraint can be added):
   ```bash
   pnpm --filter @crowdvest/db db:precheck
   ```
2. **Migrate** (add ImportRun, new fields, unique constraint):
   ```bash
   pnpm --filter @crowdvest/db prisma:migrate -- --name package-a-plus
   ```
3. **Generate** Prisma client (if not already run by migrate):
   ```bash
   pnpm --filter @crowdvest/db prisma:generate
   ```
4. **Seed**:
   ```bash
   pnpm --filter @crowdvest/db db:seed
   ```

Requires Postgres running (e.g. `docker compose up -d`) and `DATABASE_URL` set (e.g. in repo root `.env`).
