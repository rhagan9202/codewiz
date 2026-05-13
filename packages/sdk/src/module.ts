import { z } from "zod";
import { ProvenanceSchema, SourceRefSchema, LayerKeySchema } from "./provenance.js";

export const ModuleKindSchema = z.enum([
  "page", "component", "hook", "store", "client",
  "route", "service", "middleware", "model", "external",
]);
export type ModuleKind = z.infer<typeof ModuleKindSchema>;

export const ValuedSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, provenance: ProvenanceSchema });

export const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  language: z.string(),
  layer:  ValuedSchema(LayerKeySchema),
  team:   ValuedSchema(z.string()).optional(),
  domain: ValuedSchema(z.string()).optional(),
  kind: ModuleKindSchema,
  loc: z.number().int().nonnegative(),
  health: z.object({
    score: z.number().min(0).max(1),
    reasons: z.array(z.string()),
  }).optional(),
  annotation: z.enum(["err", "warn", "new", "dup"]).optional(),
  notes: z.string().optional(),
  citations: z.array(SourceRefSchema),
});
export type Module = z.infer<typeof ModuleSchema>;

export const EdgeKindSchema = z.enum(["imports", "calls", "http", "data"]);
export type EdgeKind = z.infer<typeof EdgeKindSchema>;

export const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  kind: EdgeKindSchema,
  provenance: ProvenanceSchema,
  evidence: z.array(SourceRefSchema).optional(),
});
export type Edge = z.infer<typeof EdgeSchema>;
