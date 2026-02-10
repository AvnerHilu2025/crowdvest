-- AgentExperience: switch from Agent to RunAgent reference
-- 1) Add runAgentId column (nullable for backfill)
ALTER TABLE "AgentExperience" ADD COLUMN "runAgentId" UUID;

-- 2) Backfill runAgentId where agentId matches RunAgent.id (same run)
UPDATE "AgentExperience" e
SET "runAgentId" = ra.id
FROM "RunAgent" ra
WHERE e."runId" = ra."runId" AND e."agentId" = ra.id;

-- 3) Drop old FK and column
ALTER TABLE "AgentExperience" DROP CONSTRAINT IF EXISTS "AgentExperience_agentId_fkey";
ALTER TABLE "AgentExperience" DROP COLUMN "agentId";

-- 4) Make runAgentId required (only rows that couldn't be backfilled may remain; delete them)
DELETE FROM "AgentExperience" WHERE "runAgentId" IS NULL;
ALTER TABLE "AgentExperience" ALTER COLUMN "runAgentId" SET NOT NULL;

-- 5) Add FK and index
ALTER TABLE "AgentExperience" ADD CONSTRAINT "AgentExperience_runAgentId_fkey"
  FOREIGN KEY ("runAgentId") REFERENCES "RunAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "AgentExperience_agentId_ts_idx";
CREATE INDEX "AgentExperience_runAgentId_ts_idx" ON "AgentExperience"("runAgentId", "ts");
