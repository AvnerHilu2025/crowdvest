-- Crowd Wisdom Quality metrics: add diversityIndex, independenceIndex, herdingIndex, wisdomScore
ALTER TABLE "CrowdMetrics" ADD COLUMN "diversityIndex" DOUBLE PRECISION;
ALTER TABLE "CrowdMetrics" ADD COLUMN "independenceIndex" DOUBLE PRECISION;
ALTER TABLE "CrowdMetrics" ADD COLUMN "herdingIndex" DOUBLE PRECISION;
ALTER TABLE "CrowdMetrics" ADD COLUMN "wisdomScore" DOUBLE PRECISION;
