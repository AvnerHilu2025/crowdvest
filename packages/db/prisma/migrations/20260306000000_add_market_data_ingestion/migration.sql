-- CreateTable
CREATE TABLE "MarketDataPayload" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datasetVersion" TEXT NOT NULL,

    CONSTRAINT "MarketDataPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" UUID NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" INTEGER,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketDataPayload_provider_symbol_idx" ON "MarketDataPayload"("provider", "symbol");

-- CreateIndex
CREATE INDEX "MarketDataPayload_datasetVersion_idx" ON "MarketDataPayload"("datasetVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_datasetVersion_symbol_timestamp_key" ON "MarketPrice"("datasetVersion", "symbol", "timestamp");

-- CreateIndex
CREATE INDEX "MarketPrice_symbol_timestamp_idx" ON "MarketPrice"("symbol", "timestamp");

-- CreateIndex
CREATE INDEX "MarketPrice_datasetVersion_idx" ON "MarketPrice"("datasetVersion");
