-- CreateTable
CREATE TABLE "RunVariantSummary" (
    "id" UUID NOT NULL,
    "runVariantId" UUID NOT NULL,
    "corr" DOUBLE PRECISION NOT NULL,
    "directionalAccuracy" DOUBLE PRECISION NOT NULL,
    "pairsCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunVariantSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunVariantSummary_runVariantId_key" ON "RunVariantSummary"("runVariantId");

-- CreateIndex
CREATE INDEX "RunVariant_runId_assetSymbol_createdAt_idx" ON "RunVariant"("runId", "assetSymbol", "createdAt");

-- AddForeignKey
ALTER TABLE "RunVariantSummary" ADD CONSTRAINT "RunVariantSummary_runVariantId_fkey" FOREIGN KEY ("runVariantId") REFERENCES "RunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
