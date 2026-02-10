-- CreateEnum
CREATE TYPE "SimulationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentDecisionAction" AS ENUM ('BUY', 'SELL', 'HOLD');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('SEED', 'BET_DEBIT', 'BET_CREDIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BetDirection" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('OPEN', 'SETTLED', 'CANCELLED');

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
CREATE TABLE "AgentWallet" (
    "agentId" UUID NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentWallet_pkey" PRIMARY KEY ("agentId")
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SimulationRunStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "codeGitSha" TEXT,
    "schemaVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunAgent" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" TEXT,
    "biases" JSONB,
    "humanState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunAgentTrait" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "valueStr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunAgentTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "agentId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL DEFAULT 'RUN',
    "action" "AgentDecisionAction" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrowdMetrics" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "signal" DOUBLE PRECISION NOT NULL,
    "weightedSignal" DOUBLE PRECISION NOT NULL,
    "consensus" DOUBLE PRECISION NOT NULL,
    "polarization" DOUBLE PRECISION NOT NULL,
    "uncertainty" DOUBLE PRECISION NOT NULL,
    "minorityStrength" DOUBLE PRECISION NOT NULL,
    "beliefMomentum" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrowdMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoEvent" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "sentiment" DOUBLE PRECISION NOT NULL,
    "credibility" DOUBLE PRECISION NOT NULL,
    "reach" DOUBLE PRECISION NOT NULL,
    "volatilityImpact" DOUBLE PRECISION,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInfoState" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "agentId" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "exposedCount" INTEGER NOT NULL,
    "infoSignal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInfoState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunTimeSeries" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunTimeSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunDebug" (
    "runId" UUID NOT NULL,
    "prePersistHistogram" JSONB,
    "samplePrePersistActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunDebug_pkey" PRIMARY KEY ("runId")
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
    "reward" DOUBLE PRECISION,
    "learningMetaJson" JSONB,
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

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserWallet" (
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserWalletTransaction" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "betId" UUID,
    "runId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" UUID NOT NULL,
    "agentId" UUID,
    "decisionStep" INTEGER,
    "assetSymbol" TEXT NOT NULL,
    "direction" "BetDirection" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'OPEN',
    "openPrice" DOUBLE PRECISION NOT NULL,
    "openStep" INTEGER NOT NULL,
    "closePrice" DOUBLE PRECISION,
    "closeStep" INTEGER,
    "pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summaryJson" JSONB,
    "errorJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Archetype_name_key" ON "Archetype"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TraitDefinition_key_key" ON "TraitDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ArchetypeTraitProfile_archetypeId_traitDefinitionId_key" ON "ArchetypeTraitProfile"("archetypeId", "traitDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationRun_name_datasetVersion_key" ON "SimulationRun"("name", "datasetVersion");

-- CreateIndex
CREATE INDEX "RunAgent_runId_idx" ON "RunAgent"("runId");

-- CreateIndex
CREATE INDEX "RunAgentTrait_agentId_idx" ON "RunAgentTrait"("agentId");

-- CreateIndex
CREATE INDEX "RunAgentTrait_key_idx" ON "RunAgentTrait"("key");

-- CreateIndex
CREATE INDEX "AgentDecision_runId_idx" ON "AgentDecision"("runId");

-- CreateIndex
CREATE INDEX "AgentDecision_step_idx" ON "AgentDecision"("step");

-- CreateIndex
CREATE INDEX "AgentDecision_agentId_idx" ON "AgentDecision"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDecision_runId_step_agentId_assetSymbol_key" ON "AgentDecision"("runId", "step", "agentId", "assetSymbol");

-- CreateIndex
CREATE INDEX "CrowdMetrics_runId_idx" ON "CrowdMetrics"("runId");

-- CreateIndex
CREATE INDEX "CrowdMetrics_runId_assetSymbol_idx" ON "CrowdMetrics"("runId", "assetSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdMetrics_runId_assetSymbol_step_key" ON "CrowdMetrics"("runId", "assetSymbol", "step");

-- CreateIndex
CREATE INDEX "InfoEvent_runId_assetSymbol_step_idx" ON "InfoEvent"("runId", "assetSymbol", "step");

-- CreateIndex
CREATE INDEX "InfoEvent_runId_assetSymbol_idx" ON "InfoEvent"("runId", "assetSymbol");

-- CreateIndex
CREATE INDEX "AgentInfoState_runId_idx" ON "AgentInfoState"("runId");

-- CreateIndex
CREATE INDEX "AgentInfoState_runId_assetSymbol_idx" ON "AgentInfoState"("runId", "assetSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInfoState_runId_assetSymbol_agentId_step_key" ON "AgentInfoState"("runId", "assetSymbol", "agentId", "step");

-- CreateIndex
CREATE INDEX "RunTimeSeries_runId_step_idx" ON "RunTimeSeries"("runId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "RunTimeSeries_runId_step_key" ON "RunTimeSeries"("runId", "step");

-- CreateIndex
CREATE INDEX "AgentExperience_runId_step_idx" ON "AgentExperience"("runId", "step");

-- CreateIndex
CREATE INDEX "AgentExperience_agentId_ts_idx" ON "AgentExperience"("agentId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdSnapshot_runId_step_key" ON "CrowdSnapshot"("runId", "step");

-- CreateIndex
CREATE INDEX "UserWalletTransaction_userId_idx" ON "UserWalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "UserWalletTransaction_betId_idx" ON "UserWalletTransaction"("betId");

-- CreateIndex
CREATE INDEX "UserWalletTransaction_runId_idx" ON "UserWalletTransaction"("runId");

-- CreateIndex
CREATE INDEX "UserWalletTransaction_userId_createdAt_idx" ON "UserWalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_runId_idx" ON "Bet"("runId");

-- CreateIndex
CREATE INDEX "Bet_assetSymbol_idx" ON "Bet"("assetSymbol");

-- CreateIndex
CREATE INDEX "Bet_userId_createdAt_idx" ON "Bet"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_runId_createdAt_idx" ON "Bet"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_userId_status_createdAt_idx" ON "Bet"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_runId_status_createdAt_idx" ON "Bet"("runId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ArchetypeTraitProfile" ADD CONSTRAINT "ArchetypeTraitProfile_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchetypeTraitProfile" ADD CONSTRAINT "ArchetypeTraitProfile_traitDefinitionId_fkey" FOREIGN KEY ("traitDefinitionId") REFERENCES "TraitDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWallet" ADD CONSTRAINT "AgentWallet_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunAgent" ADD CONSTRAINT "RunAgent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunAgentTrait" ADD CONSTRAINT "RunAgentTrait_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "RunAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "RunAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdMetrics" ADD CONSTRAINT "CrowdMetrics_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoEvent" ADD CONSTRAINT "InfoEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInfoState" ADD CONSTRAINT "AgentInfoState_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInfoState" ADD CONSTRAINT "AgentInfoState_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "RunAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunTimeSeries" ADD CONSTRAINT "RunTimeSeries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunDebug" ADD CONSTRAINT "RunDebug_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExperience" ADD CONSTRAINT "AgentExperience_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExperience" ADD CONSTRAINT "AgentExperience_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdSnapshot" ADD CONSTRAINT "CrowdSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWalletTransaction" ADD CONSTRAINT "UserWalletTransaction_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
