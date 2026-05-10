import { z } from "zod";
import { ModuleSchema, EdgeSchema } from "./module.js";
import { ContractSchema } from "./contract.js";
import { SourceRefSchema } from "./provenance.js";

export const CapabilitySchema = z.enum([
  "modules", "edges-imports", "edges-calls",
  "contracts", "http-endpoints", "type-references",
]);
export type Capability = z.infer<typeof CapabilitySchema>;

export const InitRequestSchema = z.object({
  projectRoot: z.string(),
  adapterOptions: z.record(z.unknown()).optional(),
  protocolVersion: z.literal(1),
});
export type InitRequest = z.infer<typeof InitRequestSchema>;

export const InitResponseSchema = z.object({
  adapterName: z.string(),
  adapterVersion: z.string(),
  protocolVersion: z.literal(1),
  idNamespace: z.string(),
  capabilities: z.array(CapabilitySchema),
  fileGlobs: z.array(z.string()),
});
export type InitResponse = z.infer<typeof InitResponseSchema>;

export const HttpEndpointSchema = z.object({
  side: z.enum(["client", "server"]),
  verb: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  pathTemplate: z.string(),
  module: z.string(),
  citation: SourceRefSchema,
  requestType: z.string().optional(),
  responseType: z.string().optional(),
});
export type HttpEndpoint = z.infer<typeof HttpEndpointSchema>;

export const DiagnosticSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().int().nonnegative().optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const AnalyzeRequestSchema = z.object({
  files: z.array(z.string()),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalyzeResponseSchema = z.object({
  modules: z.array(ModuleSchema),
  edges: z.array(EdgeSchema),
  contracts: z.array(ContractSchema),
  httpEndpoints: z.array(HttpEndpointSchema),
  diagnostics: z.array(DiagnosticSchema),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export interface LanguageAdapter {
  initialize(req: InitRequest): Promise<InitResponse>;
  analyze(req: AnalyzeRequest): Promise<AnalyzeResponse>;
  shutdown(): Promise<void>;
}
