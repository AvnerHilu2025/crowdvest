import { z } from "zod";

export const crowdSnapshotSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  step: z.number(),
  ts: z.coerce.date(),
  aggregationJson: z.unknown().nullable(),
  confidence: z.number().nullable(),
});

export type CrowdSnapshot = z.infer<typeof crowdSnapshotSchema>;
