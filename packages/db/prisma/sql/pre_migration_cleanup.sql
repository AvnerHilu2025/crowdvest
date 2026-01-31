-- Pre-migration cleanup: ensure SimulationRun has no duplicate (name, datasetVersion)
-- before adding the unique constraint. Run this BEFORE applying the package-a-plus migration.
--
-- Current schema may not have datasetVersion yet; we deduplicate by name so that after
-- the migration adds datasetVersion (with default), (name, datasetVersion) is unique.
-- Strategy: keep the oldest row per name (by createdAt); append '-dup-<shortid>' to others.

BEGIN;

WITH dupes AS (
  SELECT
    id,
    name,
    "createdAt",
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt" ASC) AS rn
  FROM "SimulationRun"
),
to_update AS (
  SELECT id, name
  FROM dupes
  WHERE rn > 1
)
UPDATE "SimulationRun" AS s
SET name = s.name || '-dup-' || LOWER(SUBSTRING(REPLACE(s.id::TEXT, '-', ''), 1, 8))
FROM to_update
WHERE s.id = to_update.id;

COMMIT;
