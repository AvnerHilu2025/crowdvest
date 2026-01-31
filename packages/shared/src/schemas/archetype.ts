import { z } from "zod";

export const archetypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Archetype = z.infer<typeof archetypeSchema>;
