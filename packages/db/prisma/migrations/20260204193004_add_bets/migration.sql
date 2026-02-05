-- CreateEnum
CREATE TYPE "BetDirection" AS ENUM ('BUY', 'SELL', 'HOLD');

-- CreateTable
CREATE TABLE "Bet" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" UUID NOT NULL,
    "direction" "BetDirection" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL,
    "thesis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_runId_idx" ON "Bet"("runId");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
