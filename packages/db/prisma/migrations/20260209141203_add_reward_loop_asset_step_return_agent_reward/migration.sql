-- CreateTable
CREATE TABLE "AssetStepReturn" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "stepReturn" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetStepReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentReward" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "action" "AgentDecisionAction" NOT NULL,
    "stepReturn" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL,
    "regret" DOUBLE PRECISION NOT NULL,
    "drawdown" DOUBLE PRECISION NOT NULL,
    "rewardScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetStepReturn_runId_assetSymbol_idx" ON "AssetStepReturn"("runId", "assetSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "AssetStepReturn_runId_assetSymbol_step_key" ON "AssetStepReturn"("runId", "assetSymbol", "step");

-- CreateIndex
CREATE INDEX "AgentReward_runId_assetSymbol_step_idx" ON "AgentReward"("runId", "assetSymbol", "step");

-- CreateIndex
CREATE UNIQUE INDEX "AgentReward_runId_agentId_assetSymbol_step_key" ON "AgentReward"("runId", "agentId", "assetSymbol", "step");

-- AddForeignKey
ALTER TABLE "AssetStepReturn" ADD CONSTRAINT "AssetStepReturn_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReward" ADD CONSTRAINT "AgentReward_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReward" ADD CONSTRAINT "AgentReward_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "RunAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
