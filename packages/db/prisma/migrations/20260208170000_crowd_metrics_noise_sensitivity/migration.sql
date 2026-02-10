-- Add noiseSensitivity to CrowdMetrics (reaction to low-credibility events)
ALTER TABLE "CrowdMetrics" ADD COLUMN "noiseSensitivity" DOUBLE PRECISION;
