-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "evalVersion" TEXT,
ADD COLUMN     "isCorrect" BOOLEAN,
ADD COLUMN     "pnl" DOUBLE PRECISION,
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Bet_userId_status_createdAt_idx" ON "Bet"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_runId_status_createdAt_idx" ON "Bet"("runId", "status", "createdAt");
