-- CreateEnum
CREATE TYPE "SimulationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Archetype" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Archetype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitDefinition" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "valueRangeText" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraitDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchetypeTraitProfile" (
    "archetypeId" UUID NOT NULL,
    "traitDefinitionId" UUID NOT NULL,
    "baselineValue" DOUBLE PRECISION NOT NULL
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "archetypeId" UUID NOT NULL,
    "stateJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SimulationRunStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExperience" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "actionJson" JSONB,
    "signalsJson" JSONB,
    "pnl" DOUBLE PRECISION,
    "drawdown" DOUBLE PRECISION,
    "stateBeforeJson" JSONB,
    "stateAfterJson" JSONB,

    CONSTRAINT "AgentExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrowdSnapshot" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "aggregationJson" JSONB,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "CrowdSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Archetype_name_key" ON "Archetype"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TraitDefinition_key_key" ON "TraitDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ArchetypeTraitProfile_archetypeId_traitDefinitionId_key" ON "ArchetypeTraitProfile"("archetypeId", "traitDefinitionId");

-- CreateIndex
CREATE INDEX "AgentExperience_runId_step_idx" ON "AgentExperience"("runId", "step");

-- CreateIndex
CREATE INDEX "AgentExperience_agentId_ts_idx" ON "AgentExperience"("agentId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdSnapshot_runId_step_key" ON "CrowdSnapshot"("runId", "step");

-- AddForeignKey
ALTER TABLE "ArchetypeTraitProfile" ADD CONSTRAINT "ArchetypeTraitProfile_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchetypeTraitProfile" ADD CONSTRAINT "ArchetypeTraitProfile_traitDefinitionId_fkey" FOREIGN KEY ("traitDefinitionId") REFERENCES "TraitDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExperience" ADD CONSTRAINT "AgentExperience_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExperience" ADD CONSTRAINT "AgentExperience_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdSnapshot" ADD CONSTRAINT "CrowdSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
