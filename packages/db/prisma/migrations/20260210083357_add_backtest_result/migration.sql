-- CreateTable
CREATE TABLE "BacktestResult" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "steps" INTEGER NOT NULL,
    "agents" INTEGER NOT NULL,
    "corr" DOUBLE PRECISION NOT NULL,
    "directionalAccuracy" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BacktestResult_assetSymbol_idx" ON "BacktestResult"("assetSymbol");

-- CreateIndex
CREATE INDEX "BacktestResult_assetSymbol_createdAt_idx" ON "BacktestResult"("assetSymbol", "createdAt");
