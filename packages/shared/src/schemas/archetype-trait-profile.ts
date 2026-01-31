import { z } from "zod";

export const archetypeTraitProfileSchema = z.object({
  archetypeId: z.string().uuid(),
  traitDefinitionId: z.string().uuid(),
  baselineValue: z.number(),
});

export type ArchetypeTraitProfile = z.infer<typeof archetypeTraitProfileSchema>;
