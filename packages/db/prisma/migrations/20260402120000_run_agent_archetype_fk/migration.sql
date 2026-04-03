-- AlterTable
ALTER TABLE "RunAgent" ADD COLUMN "archetypeId" UUID;

-- AddForeignKey
ALTER TABLE "RunAgent" ADD CONSTRAINT "RunAgent_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RunAgent_archetypeId_idx" ON "RunAgent"("archetypeId");
