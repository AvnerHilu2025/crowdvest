-- AlterTable
ALTER TABLE "RunVariant" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3);
