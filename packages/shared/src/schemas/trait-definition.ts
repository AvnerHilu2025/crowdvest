import { z } from "zod";

export const traitDefinitionSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  valueRangeText: z.string().nullable(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TraitDefinition = z.infer<typeof traitDefinitionSchema>;
