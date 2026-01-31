import { z } from "zod";

export const importRunSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  sourceFilename: z.string(),
  sourceHash: z.string(),
  status: z.string(),
  summaryJson: z.unknown().nullable(),
  errorJson: z.unknown().nullable(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ImportRun = z.infer<typeof importRunSchema>;
