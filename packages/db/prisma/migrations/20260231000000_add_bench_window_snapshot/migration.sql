-- CreateTable
CREATE TABLE "BenchWindowSnapshot" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbols" TEXT NOT NULL,
    "windows" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "points" INTEGER,
    "overwrite" BOOLEAN NOT NULL DEFAULT false,
    "datasetVersion" TEXT,
    "modelVersion" TEXT,
    "payloadJson" JSONB NOT NULL,

    CONSTRAINT "BenchWindowSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BenchWindowSnapshot_createdAt_idx" ON "BenchWindowSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "BenchWindowSnapshot_symbols_idx" ON "BenchWindowSnapshot"("symbols");

-- CreateIndex
CREATE INDEX "BenchWindowSnapshot_windows_idx" ON "BenchWindowSnapshot"("windows");
