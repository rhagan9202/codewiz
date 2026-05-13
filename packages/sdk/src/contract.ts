import { z } from "zod";
import { ProvenanceSchema, SourceRefSchema } from "./provenance.js";

export const SchemaShapeSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  source: z.string(),    // "file.ts:123"
  snippet: z.string(),
});
export type SchemaShape = z.infer<typeof SchemaShapeSchema>;

export const ContractIssueSchema = z.object({
  kind: z.enum(["missing", "shape", "extra"]),
  field: z.string(),
  consumer: z.string(),
  producer: z.string(),
  expected: SchemaShapeSchema,
  actual:   SchemaShapeSchema,
  provenance: ProvenanceSchema,
});
export type ContractIssue = z.infer<typeof ContractIssueSchema>;

export const ContractFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  provenance: ProvenanceSchema,
});
export type ContractField = z.infer<typeof ContractFieldSchema>;

export const ContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  fields: z.array(ContractFieldSchema),
  producers: z.array(z.string()),
  consumers: z.array(z.string()),
  issues: z.array(ContractIssueSchema),
  related: z.array(z.string()),
  citations: z.array(SourceRefSchema),
});
export type Contract = z.infer<typeof ContractSchema>;

export const FlowStepSchema = z.object({
  mod: z.string(),
  action: z.string(),
  payload: z.unknown().optional(),
  contract: z.string().optional(),
  warn: z.boolean().optional(),
  provenance: ProvenanceSchema,
});
export type FlowStep = z.infer<typeof FlowStepSchema>;

export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string(),
  kind: z.enum(["functional", "data"]),
  health: z.enum(["ok", "warn", "err"]),
  steps: z.array(FlowStepSchema),
});
export type Flow = z.infer<typeof FlowSchema>;
