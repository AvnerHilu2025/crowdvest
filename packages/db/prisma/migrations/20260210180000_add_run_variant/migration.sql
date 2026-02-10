-- CreateTable
CREATE TABLE "RunVariant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "agents" INTEGER NOT NULL,
    "steps" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunVariant_pkey" PRIMARY KEY ("id")
);

-- Add runVariantId columns (nullable for backfill)
ALTER TABLE "AgentDecision" ADD COLUMN "runVariantId" UUID;
ALTER TABLE "CrowdMetrics" ADD COLUMN "runVariantId" UUID;
ALTER TABLE "AgentInfoState" ADD COLUMN "runVariantId" UUID;
ALTER TABLE "AgentState" ADD COLUMN "runVariantId" UUID;
ALTER TABLE "AgentExperience" ADD COLUMN "runVariantId" UUID;
ALTER TABLE "AgentReward" ADD COLUMN "runVariantId" UUID;
ALTER TABLE "BacktestResult" ADD COLUMN "runVariantId" UUID;

-- Backfill: create legacy RunVariant per (runId, assetSymbol)
INSERT INTO "RunVariant" ("id", "runId", "assetSymbol", "seed", "agents", "steps", "label")
SELECT gen_random_uuid(), d."runId", d."assetSymbol", 0, 0, 0, 'legacy'
FROM (
  SELECT DISTINCT "runId", "assetSymbol" FROM "CrowdMetrics"
  UNION SELECT DISTINCT "runId", "assetSymbol" FROM "AgentDecision"
  UNION SELECT DISTINCT "runId", "assetSymbol" FROM "AgentState"
  UNION SELECT DISTINCT "runId", 'RUN' FROM "AgentExperience"
) AS d
WHERE NOT EXISTS (SELECT 1 FROM "RunVariant" v WHERE v."runId" = d."runId" AND v."assetSymbol" = d."assetSymbol" AND v."seed" = 0 AND v."label" = 'legacy');

-- Update CrowdMetrics with runVariantId
UPDATE "CrowdMetrics" c
SET "runVariantId" = v."id"
FROM "RunVariant" v
WHERE v."runId" = c."runId" AND v."assetSymbol" = c."assetSymbol" AND v."label" = 'legacy';

-- Update AgentDecision
UPDATE "AgentDecision" a
SET "runVariantId" = v."id"
FROM "RunVariant" v
WHERE v."runId" = a."runId" AND v."assetSymbol" = a."assetSymbol" AND v."label" = 'legacy';

-- Update AgentInfoState
UPDATE "AgentInfoState" a
SET "runVariantId" = v."id"
FROM "RunVariant" v
WHERE v."runId" = a."runId" AND v."assetSymbol" = a."assetSymbol" AND v."label" = 'legacy';

-- Update AgentState
UPDATE "AgentState" a
SET "runVariantId" = v."id"
FROM "RunVariant" v
WHERE v."runId" = a."runId" AND v."assetSymbol" = a."assetSymbol" AND v."label" = 'legacy';

-- Update AgentReward
UPDATE "AgentReward" a
SET "runVariantId" = v."id"
FROM "RunVariant" v
WHERE v."runId" = a."runId" AND v."assetSymbol" = a."assetSymbol" AND v."label" = 'legacy';

-- Update BacktestResult
UPDATE "BacktestResult" b
SET "runVariantId" = (SELECT v."id" FROM "RunVariant" v WHERE v."runId" = b."runId" AND v."assetSymbol" = b."assetSymbol" AND v."label" = 'legacy' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM "RunVariant" v WHERE v."runId" = b."runId" AND v."assetSymbol" = b."assetSymbol" AND v."label" = 'legacy');

-- AgentExperience: one variant per runId (pick first by runId)
UPDATE "AgentExperience" e
SET "runVariantId" = (SELECT v."id" FROM "RunVariant" v WHERE v."runId" = e."runId" LIMIT 1)
WHERE EXISTS (SELECT 1 FROM "RunVariant" v WHERE v."runId" = e."runId");

-- CreateIndex RunVariant
CREATE UNIQUE INDEX "RunVariant_runId_assetSymbol_seed_label_key" ON "RunVariant"("runId", "assetSymbol", "seed", "label");
CREATE INDEX "RunVariant_runId_assetSymbol_idx" ON "RunVariant"("runId", "assetSymbol");

-- Drop old unique constraints and add new (including runVariantId)
DROP INDEX IF EXISTS "AgentDecision_runId_step_agentId_assetSymbol_key";
CREATE UNIQUE INDEX "AgentDecision_runId_step_agentId_assetSymbol_runVariantId_key" ON "AgentDecision"("runId", "step", "agentId", "assetSymbol", "runVariantId");

DROP INDEX IF EXISTS "CrowdMetrics_runId_assetSymbol_step_key";
CREATE UNIQUE INDEX "CrowdMetrics_runId_assetSymbol_step_runVariantId_key" ON "CrowdMetrics"("runId", "assetSymbol", "step", "runVariantId");

DROP INDEX IF EXISTS "AgentInfoState_runId_assetSymbol_agentId_step_key";
CREATE UNIQUE INDEX "AgentInfoState_runId_assetSymbol_agentId_step_runVariantId_key" ON "AgentInfoState"("runId", "assetSymbol", "agentId", "step", "runVariantId");

DROP INDEX IF EXISTS "AgentState_runId_assetSymbol_agentId_step_key";
CREATE UNIQUE INDEX "AgentState_runId_assetSymbol_agentId_step_runVariantId_key" ON "AgentState"("runId", "assetSymbol", "agentId", "step", "runVariantId");

DROP INDEX IF EXISTS "AgentReward_runId_agentId_assetSymbol_step_key";
CREATE UNIQUE INDEX "AgentReward_runId_agentId_assetSymbol_step_runVariantId_key" ON "AgentReward"("runId", "agentId", "assetSymbol", "step", "runVariantId");

-- AgentExperience: add unique (no prior unique on runId+runAgentId+step, only index)
CREATE UNIQUE INDEX "AgentExperience_runId_runAgentId_step_runVariantId_key" ON "AgentExperience"("runId", "runAgentId", "step", "runVariantId");

-- Indexes for runVariantId
CREATE INDEX "AgentDecision_runVariantId_idx" ON "AgentDecision"("runVariantId");
CREATE INDEX "CrowdMetrics_runVariantId_idx" ON "CrowdMetrics"("runVariantId");
CREATE INDEX "AgentInfoState_runVariantId_idx" ON "AgentInfoState"("runVariantId");
CREATE INDEX "AgentState_runVariantId_idx" ON "AgentState"("runVariantId");
CREATE INDEX "AgentExperience_runVariantId_idx" ON "AgentExperience"("runVariantId");
CREATE INDEX "AgentReward_runVariantId_idx" ON "AgentReward"("runVariantId");
CREATE INDEX "BacktestResult_runVariantId_idx" ON "BacktestResult"("runVariantId");

-- Add FK RunVariant -> SimulationRun
ALTER TABLE "RunVariant" ADD CONSTRAINT "RunVariant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FKs from tables to RunVariant
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrowdMetrics" ADD CONSTRAINT "CrowdMetrics_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentInfoState" ADD CONSTRAINT "AgentInfoState_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentState" ADD CONSTRAINT "AgentState_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentExperience" ADD CONSTRAINT "AgentExperience_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentReward" ADD CONSTRAINT "AgentReward_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BacktestResult" ADD CONSTRAINT "BacktestResult_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
