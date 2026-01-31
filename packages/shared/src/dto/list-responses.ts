import { z } from "zod";
import {
  archetypeSchema,
  traitDefinitionSchema,
  archetypeTraitProfileSchema,
  simulationRunSchema,
  importRunSchema,
} from "../schemas";

export const listArchetypesResponseSchema = z.object({
  items: z.array(archetypeSchema),
  total: z.number().optional(),
});

export type ListArchetypesResponse = z.infer<typeof listArchetypesResponseSchema>;

export const listTraitsResponseSchema = z.object({
  items: z.array(traitDefinitionSchema),
  total: z.number().optional(),
});

export type ListTraitsResponse = z.infer<typeof listTraitsResponseSchema>;

export const listArchetypeProfilesResponseSchema = z.object({
  items: z.array(archetypeTraitProfileSchema),
  total: z.number().optional(),
});

export type ListArchetypeProfilesResponse = z.infer<
  typeof listArchetypeProfilesResponseSchema
>;

export const listRunsResponseSchema = z.object({
  items: z.array(simulationRunSchema),
  total: z.number().optional(),
});

export type ListRunsResponse = z.infer<typeof listRunsResponseSchema>;

export const listImportRunsResponseSchema = z.object({
  items: z.array(importRunSchema),
  total: z.number().optional(),
});

export type ListImportRunsResponse = z.infer<typeof listImportRunsResponseSchema>;

const datasetEntrySchema = z.object({
  datasetVersion: z.string(),
  createdAt: z.coerce.date(),
});

export const listDatasetsResponseSchema = z.object({
  items: z.array(datasetEntrySchema),
});

export type DatasetEntry = z.infer<typeof datasetEntrySchema>;
export type ListDatasetsResponse = z.infer<typeof listDatasetsResponseSchema>;
