import { z } from "zod";

export const LayerKeySchema = z.enum([
  "ui", "state", "api", "service", "data", "external",
]);
export type LayerKey = z.infer<typeof LayerKeySchema>;

export const SourceRefSchema = z.object({
  path: z.string(),
  line: z.number().int().nonnegative(),
  col: z.number().int().nonnegative().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ProvenanceSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("static") }),
  z.object({
    source: z.literal("annotation"),
    file: z.string(),
    line: z.number().int().nonnegative(),
  }),
  z.object({
    source: z.literal("bridge"),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    source: z.literal("llm"),
    model: z.string(),
    promptHash: z.string(),
    confidence: z.number().min(0).max(1),
    citations: z.array(SourceRefSchema),
  }),
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;
