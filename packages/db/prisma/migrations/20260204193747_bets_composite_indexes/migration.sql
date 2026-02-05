-- DropIndex
DROP INDEX "Bet_runId_idx";

-- DropIndex
DROP INDEX "Bet_userId_idx";

-- CreateIndex
CREATE INDEX "Bet_userId_createdAt_idx" ON "Bet"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_runId_createdAt_idx" ON "Bet"("runId", "createdAt");
