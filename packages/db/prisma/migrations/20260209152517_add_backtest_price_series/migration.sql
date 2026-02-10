-- CreateTable
CREATE TABLE "PriceSeriesPoint" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSeriesPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestWindowResult" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "runId" UUID NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "stride" INTEGER NOT NULL,
    "agents" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "corr" DOUBLE PRECISION NOT NULL,
    "hitRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestWindowResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceSeriesPoint_symbol_idx" ON "PriceSeriesPoint"("symbol");

-- CreateIndex
CREATE INDEX "PriceSeriesPoint_symbol_date_idx" ON "PriceSeriesPoint"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSeriesPoint_symbol_date_key" ON "PriceSeriesPoint"("symbol", "date");

-- CreateIndex
CREATE INDEX "BacktestWindowResult_symbol_idx" ON "BacktestWindowResult"("symbol");

-- CreateIndex
CREATE INDEX "BacktestWindowResult_symbol_createdAt_idx" ON "BacktestWindowResult"("symbol", "createdAt");
