-- CreateTable
CREATE TABLE "AgentState" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "agentId" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "riskTolerance" DOUBLE PRECISION NOT NULL,
    "herding" DOUBLE PRECISION NOT NULL,
    "infoSignal" DOUBLE PRECISION NOT NULL,
    "exposedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentState_runId_assetSymbol_step_idx" ON "AgentState"("runId", "assetSymbol", "step");

-- CreateIndex
CREATE INDEX "AgentState_runId_assetSymbol_agentId_idx" ON "AgentState"("runId", "assetSymbol", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentState_runId_assetSymbol_agentId_step_key" ON "AgentState"("runId", "assetSymbol", "agentId", "step");

-- AddForeignKey
ALTER TABLE "AgentState" ADD CONSTRAINT "AgentState_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentState" ADD CONSTRAINT "AgentState_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "RunAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
