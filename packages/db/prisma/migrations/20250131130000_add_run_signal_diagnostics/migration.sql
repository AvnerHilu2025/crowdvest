-- CreateTable
CREATE TABLE "RunSignalDiagnostics" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,

    "totalSteps" INTEGER NOT NULL,

    "pctCrowdBuy" DOUBLE PRECISION NOT NULL,
    "pctCrowdSell" DOUBLE PRECISION NOT NULL,
    "pctCrowdHold" DOUBLE PRECISION NOT NULL,

    "pctMarketUp" DOUBLE PRECISION NOT NULL,
    "pctMarketDown" DOUBLE PRECISION NOT NULL,
    "pctMarketFlat" DOUBLE PRECISION NOT NULL,

    "buyCorrect" INTEGER NOT NULL,
    "buyWrong" INTEGER NOT NULL,
    "sellCorrect" INTEGER NOT NULL,
    "sellWrong" INTEGER NOT NULL,
    "holdCorrect" INTEGER NOT NULL,
    "holdWrong" INTEGER NOT NULL,

    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunSignalDiagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunSignalDiagnostics_runId_assetSymbol_key" ON "RunSignalDiagnostics"("runId", "assetSymbol");

-- CreateIndex
CREATE INDEX "RunSignalDiagnostics_runId_idx" ON "RunSignalDiagnostics"("runId");
