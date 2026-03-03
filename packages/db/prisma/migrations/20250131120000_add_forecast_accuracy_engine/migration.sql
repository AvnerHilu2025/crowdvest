-- CreateTable
CREATE TABLE "ForecastResult" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "forecastDirection" "AgentDecisionAction" NOT NULL,
    "totalVotes" INTEGER NOT NULL,
    "buyVotes" INTEGER NOT NULL,
    "sellVotes" INTEGER NOT NULL,
    "holdVotes" INTEGER NOT NULL,
    "groundTruthDirection" "AgentDecisionAction" NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunAccuracy" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "totalEvaluations" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "accuracyRate" DOUBLE PRECISION NOT NULL,
    "buyAccuracy" DOUBLE PRECISION NOT NULL,
    "sellAccuracy" DOUBLE PRECISION NOT NULL,
    "holdAccuracy" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunAccuracy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForecastResult_runId_assetSymbol_step_key" ON "ForecastResult"("runId", "assetSymbol", "step");

-- CreateIndex
CREATE INDEX "ForecastResult_runId_idx" ON "ForecastResult"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunAccuracy_runId_assetSymbol_key" ON "RunAccuracy"("runId", "assetSymbol");

-- CreateIndex
CREATE INDEX "RunAccuracy_runId_idx" ON "RunAccuracy"("runId");
