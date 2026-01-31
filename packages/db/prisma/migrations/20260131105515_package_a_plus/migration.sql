/*
  Warnings:

  - A unique constraint covering the columns `[name,datasetVersion]` on the table `SimulationRun` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `datasetVersion` to the `SimulationRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schemaVersion` to the `SimulationRun` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AgentExperience" ADD COLUMN     "learningMetaJson" JSONB,
ADD COLUMN     "reward" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SimulationRun" ADD COLUMN     "codeGitSha" TEXT,
ADD COLUMN     "datasetVersion" TEXT NOT NULL,
ADD COLUMN     "schemaVersion" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summaryJson" JSONB,
    "errorJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimulationRun_name_datasetVersion_key" ON "SimulationRun"("name", "datasetVersion");
