-- AgentExperience: add composite index for (runId, runAgentId, step) queries
CREATE INDEX IF NOT EXISTS "AgentExperience_runId_runAgentId_step_idx" ON "AgentExperience"("runId", "runAgentId", "step");
