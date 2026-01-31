import { z } from "zod";

export const agentSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  archetypeId: z.string().uuid(),
  stateJson: z.unknown().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Agent = z.infer<typeof agentSchema>;
