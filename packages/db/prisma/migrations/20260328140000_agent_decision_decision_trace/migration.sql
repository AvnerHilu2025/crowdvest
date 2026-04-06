-- Observability: optional JSON audit of decision pipeline (--decisionTrace / CV_DECISION_TRACE=1)
ALTER TABLE "AgentDecision" ADD COLUMN "decisionTrace" JSONB;
