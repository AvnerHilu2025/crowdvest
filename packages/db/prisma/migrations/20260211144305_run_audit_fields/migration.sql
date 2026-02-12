-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" VARCHAR(1000);
