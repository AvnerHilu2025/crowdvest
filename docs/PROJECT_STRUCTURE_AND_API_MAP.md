# Project Structure & API Map (CrowdVest)

**Purpose:** Factual reference for debugging and ChatGPT context. No fixes applied.

---

## 1) Monorepo / folders overview

| Path | Role |
|------|------|
| `apps/api/` | NestJS backend (REST API). Single entry: `src/main.ts`. |
| `apps/web/` | Next.js 15 App Router frontend. Port 4000. |
| `apps/worker/` | Simulation/scripts (sim-run, sim-ci, sim-smoke, etc.). No long-lived HTTP server. |
| `packages/db/` | Prisma schema + migrations + generated client. No server. |
| `packages/shared/` | Shared DTOs, schemas, validation. No server. |
| `packages/sim-core/` | Simulation engine (action, reward, types). No server. |
| `scripts/` | Shell/Node helpers (check-port, verification scripts). |
| `docs/` | Verification and dev docs. |

**Ports and where configured:**

| Service | Port | Where configured |
|---------|------|------------------|
| Web (Next.js) | 4000 | `apps/web/package.json` dev script: `PORT=4000 next dev --port 4000`; `scripts/check-port.js 4000`. |
| API (NestJS) | 4001 | `apps/api/package.json` dev script: `PORT=4001 nest start --watch`; `apps/api/src/main.ts` line 7: `const port = Number(process.env.PORT) \|\| 4001`. |
| Postgres | 5432 | `docker-compose.yml`: `ports: "5432:5432"`. |
| Redis | 6379 | `docker-compose.yml`: `ports: "6379:6379"`. |

Docker-compose does **not** run the API or Web apps; it only runs Postgres and Redis.

---

## 2) Runtime entry points

| App | Entry | Start command (from repo root) |
|-----|--------|--------------------------------|
| API | `apps/api/src/main.ts` | `pnpm --filter api dev` → `node ../../scripts/check-port.js 4001 && PORT=4001 nest start --watch` (Nest builds and runs `main.ts`). |
| Web | Next.js default (App Router) | `pnpm --filter web dev` → `node ../../scripts/check-port.js 4000 && PORT=4000 next dev --port 4000`. Config: `apps/web/next.config.ts` (reactStrictMode only). |
| Worker | Scripts under `apps/worker/src/scripts/` (e.g. `sim-run.ts`) | Invoked via package scripts or direct ts-node/tsx; no single long-lived process. |

Root dev: `pnpm dev` runs Turbo and starts both `web` and `api` dev tasks (see root `package.json` script `"dev"`).

---

## 3) API routing map

All routes are on the API server (default base URL `http://localhost:4001`). NestJS uses global prefix only if set in `main.ts` (none in this repo), so paths below are exact.

### Health

| Method | Path | Controller / handler | Returns |
|--------|------|----------------------|--------|
| GET | `/health` | `apps/api/src/health/health.controller.ts` — `get()` | `{ ok: true }` |

### Agents

| Method | Path | Controller / handler | Returns |
|--------|------|----------------------|--------|
| GET | `/agents/:agentId` | `apps/api/src/agents/agents.controller.ts` — `getById(@Param("agentId"))` | `{ id, name, archetype: { id, name }, wallet: { balance } }`; 400 if not UUID; **404** if agent not found (`"Agent not found"` from `agents.service.ts` line 26). |

- **GET /agents (list):** **Does not exist.** No route registered for `GET /agents` without a path segment. The only “agents” routes are:
  - `GET /agents/:agentId` (single agent by UUID),
  - `GET /results/agents?run_id=<runId>` (per-agent results for a run).

### Runs (main app)

| Method | Path | Controller / handler | Returns |
|--------|------|----------------------|--------|
| GET | `/runs` | `apps/api/src/runs/runs.controller.ts` — `findAll()` | List of runs (paginated). |
| GET | `/runs/latest` | `runs.controller.ts` — `getLatest()` | Latest run payload (404 if no run). |
| GET | `/runs/:id` | `runs.controller.ts` — `getById()` | Run payload by id; 400 if id not UUID. |
| GET | `/runs/:id/timeseries` | `runs.controller.ts` — `getTimeseries()` | Run timeline curve. |

### Results API

| Method | Path | Controller / handler | Returns |
|--------|------|----------------------|--------|
| GET | `/results/runs` | `apps/api/src/results/results.controller.ts` — `getRuns()` | `{ items, total }` (Results Data Model runs). |
| GET | `/results/runs/:id` | `results.controller.ts` — `getRunById()` | Single run by id. |
| GET | `/results/agents` | `results.controller.ts` — `getAgents(@Query("run_id"))` | `{ items, total }` per-agent results for run; empty if no `run_id`. |
| GET | `/results/summary` | `results.controller.ts` — `getSummary()` | Run-level + by-archetype summary; `run_id` optional (empty run if missing). |
| GET | `/results/summary-compact` | `results.controller.ts` — `getSummaryCompact()` | Compact verification payload; **requires** `run_id` (400 if missing/invalid). |

### Me (identity-lite)

| Method | Path | Controller / handler | Returns |
|--------|------|----------------------|--------|
| GET | `/me` | `apps/api/src/me/me.controller.ts` — `getProfile(@Query("userId"))` | `{ userId, displayName }` from `UserProfile` or **null** if not found. **400** if `userId` missing. |
| POST | `/me` | `me.controller.ts` — `upsertProfile(@Body("userId"), @Body("displayName"))` | Upserts `UserProfile`; returns `{ userId, displayName }`. 400 if missing params. |

Implementation: `apps/api/src/me/me.service.ts` — `getProfile(userId)` uses `prisma.userProfile.findUnique({ where: { userId } })`.

### Bets

| Method | Path | Controller / handler | Returns |
|--------|------|----------------------|--------|
| GET | `/bets` | `apps/api/src/bets/bets.controller.ts` — `findAll()` | List bets (query: userId, runId, limit, offset). |
| POST | `/bets` | `bets.controller.ts` — `create()` | Create bet. |
| POST | `/bets/settle` | `bets.controller.ts` — `settleRun()` | Settle run. |
| POST | `/bets/settle-latest` | `bets.controller.ts` — `settleLatest()` | Settle latest run. |
| POST | `/bets/:id/settle` | `bets.controller.ts` — `settleBet()` | Settle single bet. |

### Wallet, leaderboard, archetypes, traits, datasets, import-runs

| Method | Path | Controller / handler | Returns |
|--------|------|----------------------|--------|
| GET | `/wallet` | `apps/api/src/wallet/wallet.controller.ts` — `getWallet(@Query("userId"))` | Wallet for userId (defaults "demo-user"). |
| POST | `/wallet/reset` | `wallet.controller.ts` — `resetWallet()` | Reset wallet (body: userId, balance). |
| GET | `/leaderboard` | `apps/api/src/leaderboard/leaderboard.controller.ts` — `getLeaderboard()` | Leaderboard (query: by, limit). |
| GET | `/archetypes` | `apps/api/src/archetypes/archetypes.controller.ts` — `findAll()` | List archetypes. |
| GET | `/archetype-profiles` | `apps/api/src/profiles/profiles.controller.ts` — `findAll()` | Archetype profiles. |
| GET | `/traits` | `apps/api/src/traits/traits.controller.ts` — `findAll()` | List traits. |
| GET | `/datasets` | `apps/api/src/datasets/datasets.controller.ts` — `getDatasets()` | Datasets. |
| GET | `/import-runs` | `apps/api/src/import-runs/import-runs.controller.ts` — `findAll()` | List import runs (paginated). |

---

## 4) Data model touchpoints (agents-related)

**DB tables (Prisma):** `Agent`, `Archetype`, `AgentWallet`, `AgentExperience`, `SimulationRun`, `RunDebug`, `CrowdSnapshot`. (Also `UserProfile`, `UserWallet`, `Bet` for user/bets flows.)

**Single agent by id (GET /agents/:agentId):**

- **File:** `apps/api/src/agents/agents.service.ts` — `findOne(agentId)`.
- **Query:** `prisma.agent.findUnique({ where: { id: agentId }, select: { id, displayName, archetype: { id, name }, wallet: { balance } } })`.
- **Tables:** `Agent`, `Archetype` (join), `AgentWallet` (optional join). 404 if agent not found.

**Per-agent results for a run (GET /results/agents?run_id=):**

- **File:** `apps/api/src/results/results.service.ts` — `getAgents(runId)` (lines 113–185).
- **Queries:** `prisma.simulationRun.findUnique` (id), then `prisma.agentExperience.findMany({ where: { runId }, select: { agentId, pnl, drawdown, reward, actionJson, agent: { archetypeId } }, orderBy: [...] })`.
- **Tables:** `SimulationRun`, `AgentExperience`, `Agent` (for archetypeId only).

**Summary and summary-compact:**

- `getSummary(runId)` calls `getAgents(runId)` (so same tables as above), then aggregates in memory.
- `getSummaryCompact(runId)` (lines 254–432) uses: `getSummary(runId)`, `prisma.agentExperience.findMany` (runId), `prisma.simulationRun.findUnique` (configJson), raw SQL on `RunDebug` (prePersistHistogram, samplePrePersistActions).
- **Tables:** `AgentExperience`, `SimulationRun`, `RunDebug`, plus Agent/Archetype via getAgents.

**Where sampleDecisions are produced and what IDs they use:**

- **Produced (worker):** `apps/worker/src/scripts/sim-run.ts` (and similarly sim-ci, sim-smoke): array `sampleDecisions: { agentId: string; step: number; action: string }[]`. Each entry is pushed with `agentId: e.agentId` (line 235), where `e` comes from the simulation step’s experiences (same as persisted to `AgentExperience`). So **agentId** is the simulation agent’s id (UUID of `Agent.id`).
- **Stored:** `sim-run.ts` line 296: `configJson: { decisionHistogram, sampleDecisions }` on `SimulationRun.update`. Also `RunDebug` gets `samplePrePersistActions` (same shape) via raw INSERT/UPDATE (lines 298–305).
- **Read (API):** `apps/api/src/results/results.service.ts`: `getSummaryCompact` reads `SimulationRun.configJson` and uses `config.sampleDecisions` (line 338); `getRunPayload` (used by GET runs/:id and runs/latest) can include `debug.sampleDecisions` from that compact payload (lines 435–450).

---

## 5) “Past similar issue” scan

Search strings and matches (path, line, short context):

**"Agent not found"**

- `apps/api/src/agents/agents.service.ts` line 26: `if (!agent) throw new NotFoundException("Agent not found");` — thrown when `findUnique` returns null for GET /agents/:agentId.

**"/me"**

- `apps/api/src/me/me.controller.ts` line 4: `@Controller("me")` — defines base path for GET and POST /me.
- `apps/api/src/me/me.module.ts` line 2: import of MeController.
- `apps/api/src/app.module.ts` line 15: import of MeModule.
- `apps/web/src/app/bets/page.tsx` lines 32–38: client fetches `GET ${API_BASE}/me?userId=...` and logs "[bets] fetching /me for", "[bets] /me status", "[bets] /me fetch failed" on error.

**"identity-bootstrap"**

- `apps/web/src/app/layout.tsx` line 1: `import { IdentityBootstrap } from "./identity-bootstrap";` and line 12: `<IdentityBootstrap>` wraps children.
- `apps/web/src/app/identity-bootstrap.tsx`: component that calls `getOrCreateUserId()` and shows display-name modal if no display name; no string "identity-bootstrap" in shared docs.

**"Cannot GET /agents"**

- **No matches** in the repo. So any "Cannot GET /agents" message would come from the framework (e.g. 404 for unregistered route), not from application code.

**API_BASE / proxy usage:**

- Frontend uses `process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4001"` in `apps/web/src/app/bets/page.tsx` (line 8) and `apps/web/src/lib/api.ts` (lines 5–6). Same fallback in `apps/web/src/app/results-api.ts` (lines 5–7) with optional `NEXT_PUBLIC_API_URL`. No Next.js rewrite or proxy configured in `next.config.ts`; all API calls are direct to the API origin.

---

## 6) How frontend chooses the current identity/agent

**Identity bootstrap:**

- **File:** `apps/web/src/app/identity-bootstrap.tsx`. Rendered in `apps/web/src/app/layout.tsx` wrapping the app.
- **Behavior:** On mount, `getOrCreateUserId()` is called (so a UUID exists in localStorage). If `getDisplayName()` is null, a modal asks for a display name and saves it via `setDisplayName(name)`.

**Where the ID comes from:**

- **File:** `apps/web/src/lib/identity.ts`.
- **localStorage keys:** `cv_userId` (UUID), `cv_displayName`. Legacy keys `userId` and `displayName` are migrated to `cv_*` once.
- **getOrCreateUserId():** Returns stored value from `cv_userId` if it’s a valid UUID; otherwise generates `crypto.randomUUID()`, stores it in `cv_userId`, and returns it. On server/SSR it returns `"demo-user"` (no localStorage).

**How the Bets page gets the ID:**

- **File:** `apps/web/src/app/bets/page.tsx`.
- **Flow:** `useState(null)` for `userId`; in `useEffect` runs `setUserId(getOrCreateUserId())` (client-only). That **userId** is then used for: fetching `/me?userId=...` (to show displayName), `getWallet(userId)`, `getBetsByUser(userId)`.

**Intended meaning of the ID:**

- The code and API use it as a **userId** (human/player identity): it drives `UserProfile` (GET/POST /me), `UserWallet` (GET /wallet), and `Bet` (userId). It is **not** an simulation **agentId** (not the `Agent` table used by GET /agents/:agentId or by sampleDecisions). So: **UI identity = userId (UserProfile / UserWallet / Bet), not agentId.**

---

## 7) Recommended next debugging commands (no code changes)

Assume API at `http://localhost:4001`, Web at `http://localhost:4000`. Database from `.env` or `.env.example`: `DATABASE_URL=postgresql://...@localhost:5432/crowdvest?schema=public`.

**1) Health**

```bash
curl -s http://localhost:4001/health | jq .
```

**2) Latest run id (main runs API)**

```bash
curl -s "http://localhost:4001/runs?limit=1" | jq '.items[0].id // .items[0].runId // empty'
```

If the list shape uses `runId`:

```bash
curl -s "http://localhost:4001/runs?limit=1" | jq '.items[0].runId // .items[0].id // empty'
```

**3) Latest run id (results API)**

```bash
curl -s "http://localhost:4001/results/runs?limit=1" | jq '.items[0].id // empty'
```

**4) Run payload with debug (includes sampleDecisions); set RUN_ID**

```bash
RUN_ID=$(curl -s "http://localhost:4001/results/runs?limit=1" | jq -r '.items[0].id // empty')
curl -s "http://localhost:4001/runs/${RUN_ID}?debug=1" | jq '.debug.sampleDecisions // []'
```

**5) Extract one agentId from sampleDecisions**

```bash
RUN_ID=$(curl -s "http://localhost:4001/results/runs?limit=1" | jq -r '.items[0].id // empty')
AGENT_ID=$(curl -s "http://localhost:4001/runs/${RUN_ID}?debug=1" | jq -r '.debug.sampleDecisions[0].agentId // empty')
echo "AGENT_ID=$AGENT_ID"
```

**6) Call GET /agents/:id with that agentId**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}" "http://localhost:4001/agents/${AGENT_ID}" | tail -1
# Or with body:
curl -s "http://localhost:4001/agents/${AGENT_ID}" | jq .
```

**7) Confirm GET /agents (list) is not a route**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/agents
# Expect 404 (or 400 if Nest matches :agentId with empty).
```

**8) Me and wallet (replace USER_ID if you have one)**

```bash
USER_ID="your-user-uuid-or-demo-user"
curl -s "http://localhost:4001/me?userId=${USER_ID}" | jq .
curl -s "http://localhost:4001/wallet?userId=${USER_ID}" | jq .
```

**9) DB: check agent and run exist (requires DATABASE_URL in env)**

```bash
source .env 2>/dev/null || true
# If DATABASE_URL is set:
psql "$DATABASE_URL" -c "SELECT id, \"displayName\", \"archetypeId\" FROM \"Agent\" LIMIT 3;"
psql "$DATABASE_URL" -c "SELECT id, name, status FROM \"SimulationRun\" ORDER BY \"createdAt\" DESC LIMIT 3;"
```

**10) Summary-compact for a run (required run_id)**

```bash
RUN_ID=$(curl -s "http://localhost:4001/results/runs?limit=1" | jq -r '.items[0].id // empty')
curl -s "http://localhost:4001/results/summary-compact?run_id=${RUN_ID}" | jq '.runId, .metrics.agentCount'
```

Use the same `RUN_ID` and `AGENT_ID` from (4)–(5) when testing agents and sampleDecisions together.
