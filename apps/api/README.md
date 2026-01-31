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
