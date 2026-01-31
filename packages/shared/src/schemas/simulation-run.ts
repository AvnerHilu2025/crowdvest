import { z } from "zod";

export const simulationRunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export type SimulationRunStatus = z.infer<typeof simulationRunStatusSchema>;

export const simulationRunSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: simulationRunStatusSchema,
  seed: z.number(),
  modelVersion: z.string(),
  datasetVersion: z.string(),
  codeGitSha: z.string().nullable(),
  schemaVersion: z.string(),
  startedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  configJson: z.unknown().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SimulationRun = z.infer<typeof simulationRunSchema>;
