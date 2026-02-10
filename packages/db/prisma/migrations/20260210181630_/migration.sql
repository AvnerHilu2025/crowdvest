-- AlterTable
ALTER TABLE "RunVariant" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RunVariantSummary" ADD COLUMN     "debugDecisionCounts" JSONB,
ADD COLUMN     "debugDecisionsHash" TEXT,
ADD COLUMN     "debugPairsSample" JSONB,
ADD COLUMN     "debugReturnsHash" TEXT;
