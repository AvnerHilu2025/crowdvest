-- CreateTable
CREATE TABLE "RunDebug" (
    "runId" UUID NOT NULL,
    "prePersistHistogram" JSONB,
    "samplePrePersistActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunDebug_pkey" PRIMARY KEY ("runId")
);

-- AddForeignKey
ALTER TABLE "RunDebug" ADD CONSTRAINT "RunDebug_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
