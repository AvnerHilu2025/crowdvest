-- AlterTable
ALTER TABLE "BacktestResult" ADD COLUMN     "pairsCount" INTEGER;

-- CreateIndex
CREATE INDEX "BacktestResult_runId_assetSymbol_idx" ON "BacktestResult"("runId", "assetSymbol");
