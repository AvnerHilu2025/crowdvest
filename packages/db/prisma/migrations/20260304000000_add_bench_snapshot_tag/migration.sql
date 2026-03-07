-- AlterTable
ALTER TABLE "BenchWindowSnapshot" ADD COLUMN "tag" TEXT,
ADD COLUMN "isBaseline" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex (PostgreSQL allows multiple NULLs in unique column)
CREATE UNIQUE INDEX "BenchWindowSnapshot_tag_key" ON "BenchWindowSnapshot"("tag");
