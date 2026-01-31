import { z } from "zod";

export const agentExperienceSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  agentId: z.string().uuid(),
  step: z.number(),
  ts: z.coerce.date(),
  actionJson: z.unknown().nullable(),
  signalsJson: z.unknown().nullable(),
  pnl: z.number().nullable(),
  drawdown: z.number().nullable(),
  reward: z.number().nullable(),
  learningMetaJson: z.unknown().nullable(),
  stateBeforeJson: z.unknown().nullable(),
  stateAfterJson: z.unknown().nullable(),
});

export type AgentExperience = z.infer<typeof agentExperienceSchema>;
