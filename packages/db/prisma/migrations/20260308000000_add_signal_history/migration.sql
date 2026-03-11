-- CreateTable
CREATE TABLE "SignalHistory" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "disagreement" DOUBLE PRECISION NOT NULL,
    "instability" DOUBLE PRECISION NOT NULL,
    "runsUsed" INTEGER NOT NULL,
    "windowSize" INTEGER NOT NULL,
    "sourceRunId" UUID,
    "datasetVersion" TEXT,
    "strategyProfile" TEXT,
    "aggregationMode" TEXT,
    "selectionPolicy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalHistory_symbol_createdAt_idx" ON "SignalHistory"("symbol", "createdAt");

-- CreateIndex
CREATE INDEX "SignalHistory_createdAt_idx" ON "SignalHistory"("createdAt");

-- CreateIndex
CREATE INDEX "SignalHistory_datasetVersion_idx" ON "SignalHistory"("datasetVersion");
