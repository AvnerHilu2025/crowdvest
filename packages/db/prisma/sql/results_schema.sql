-- ---------------------------------------------------------------------------
-- Results Data Model – database schema (append-only)
-- Stores SimulationRunResult, AgentResult, and AggregatedResults.
-- No UPDATEs; INSERT only. Indexed for run_id and archetype_id.
-- ---------------------------------------------------------------------------

-- Runs: one row per simulation run (minimal identity + config hash).
CREATE TABLE IF NOT EXISTS "ResultRun" (
  "id"           UUID PRIMARY KEY,
  "timestamp"    BIGINT NOT NULL,
  "configHash"   TEXT NOT NULL,
  "name"         TEXT,
  "status"       SMALLINT NOT NULL,
  "steps"        INT NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE "ResultRun" IS 'Append-only run-level results (SimulationRunResult). status: 0=PENDING, 1=RUNNING, 2=COMPLETED, 3=FAILED.';
COMMENT ON COLUMN "ResultRun"."configHash" IS 'Hash of run config for reproducibility.';
COMMENT ON COLUMN "ResultRun"."timestamp" IS 'Run creation time (ms since epoch).';

-- Agent results: one row per (run, agent); rolled-up metrics.
CREATE TABLE IF NOT EXISTS "ResultAgent" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId"        UUID NOT NULL,
  "agentId"      UUID NOT NULL,
  "archetypeId"  UUID NOT NULL,
  "steps"        INT NOT NULL,
  "durationMs"  BIGINT NOT NULL DEFAULT 0,
  "pnl"         DOUBLE PRECISION NOT NULL,
  "risk"         DOUBLE PRECISION NOT NULL,
  "totalReward"  DOUBLE PRECISION NOT NULL,
  "actionBuy"    INT NOT NULL DEFAULT 0,
  "actionSell"   INT NOT NULL DEFAULT 0,
  "actionHold"   INT NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ResultAgent_runId_agentId_key" UNIQUE ("runId", "agentId")
);

COMMENT ON TABLE "ResultAgent" IS 'Append-only per-agent rolled-up results (AgentResult). One row per (run, agent).';
COMMENT ON COLUMN "ResultAgent"."risk" IS 'Max fractional drawdown 0..1 over the run.';

ALTER TABLE "ResultAgent"
  ADD CONSTRAINT "ResultAgent_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "ResultRun"("id") ON DELETE CASCADE;

-- Aggregated results: one table for scope 0 (global), 1 (run), 2 (archetype).
-- runId NULL for global (scope=0) or for archetype global (scope=2, archetypeId set).
CREATE TABLE IF NOT EXISTS "ResultAggregate" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope"           SMALLINT NOT NULL,
  "runId"           UUID,
  "archetypeId"     UUID,
  "runCount"        INT,
  "durationMs"      BIGINT,
  "agentCount"      INT NOT NULL,
  "totalPnl"        DOUBLE PRECISION NOT NULL,
  "avgPnl"          DOUBLE PRECISION NOT NULL,
  "avgRisk"         DOUBLE PRECISION NOT NULL,
  "totalSteps"      BIGINT NOT NULL,
  "avgStepsPerAgent" DOUBLE PRECISION NOT NULL,
  "totalBuy"        BIGINT NOT NULL,
  "totalSell"       BIGINT NOT NULL,
  "totalHold"       BIGINT NOT NULL,
  "totalReward"     DOUBLE PRECISION NOT NULL,
  "avgReward"       DOUBLE PRECISION NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ResultAggregate_scope_check" CHECK ("scope" IN (0, 1, 2))
);

COMMENT ON TABLE "ResultAggregate" IS 'Append-only aggregates: scope 0=global, 1=run, 2=archetype. All metrics numeric.';
COMMENT ON COLUMN "ResultAggregate"."scope" IS '0=GlobalAggregate, 1=RunAggregate, 2=ArchetypeAggregate.';
COMMENT ON COLUMN "ResultAggregate"."runCount" IS 'Set only for scope=0 (number of runs in global).';
COMMENT ON COLUMN "ResultAggregate"."durationMs" IS 'Set for scope=1 (run wall-clock duration).';

-- Optional FK: point to ResultRun for scope=1; no FK for archetype (reference data may live elsewhere).
ALTER TABLE "ResultAggregate"
  ADD CONSTRAINT "ResultAggregate_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "ResultRun"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Indexing strategy
-- ---------------------------------------------------------------------------

-- ResultRun: lookup by id (PK), by time range, by config.
CREATE INDEX IF NOT EXISTS "ResultRun_timestamp_idx" ON "ResultRun" ("timestamp");
CREATE INDEX IF NOT EXISTS "ResultRun_configHash_idx" ON "ResultRun" ("configHash");
CREATE INDEX IF NOT EXISTS "ResultRun_createdAt_idx" ON "ResultRun" ("createdAt");

-- ResultAgent: query by run_id and by archetype (main access patterns).
CREATE INDEX IF NOT EXISTS "ResultAgent_runId_idx" ON "ResultAgent" ("runId");
CREATE INDEX IF NOT EXISTS "ResultAgent_archetypeId_idx" ON "ResultAgent" ("archetypeId");
CREATE INDEX IF NOT EXISTS "ResultAgent_runId_archetypeId_idx" ON "ResultAgent" ("runId", "archetypeId");
CREATE INDEX IF NOT EXISTS "ResultAgent_createdAt_idx" ON "ResultAgent" ("createdAt");

-- ResultAggregate: query by run_id, by archetype, by scope.
CREATE INDEX IF NOT EXISTS "ResultAggregate_runId_idx" ON "ResultAggregate" ("runId");
CREATE INDEX IF NOT EXISTS "ResultAggregate_archetypeId_idx" ON "ResultAggregate" ("archetypeId");
CREATE INDEX IF NOT EXISTS "ResultAggregate_scope_idx" ON "ResultAggregate" ("scope");
CREATE INDEX IF NOT EXISTS "ResultAggregate_scope_runId_idx" ON "ResultAggregate" ("scope", "runId");
CREATE INDEX IF NOT EXISTS "ResultAggregate_scope_archetypeId_idx" ON "ResultAggregate" ("scope", "archetypeId");
CREATE INDEX IF NOT EXISTS "ResultAggregate_createdAt_idx" ON "ResultAggregate" ("createdAt");
