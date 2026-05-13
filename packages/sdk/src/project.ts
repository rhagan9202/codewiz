import { z } from "zod";
import { ManifestSchema } from "./manifest.js";
import { ModuleSchema, EdgeSchema } from "./module.js";
import { ContractSchema, FlowSchema } from "./contract.js";
import { DiagnosticSchema } from "./adapter.js";

export const ProjectSchema = z.object({
  manifest: ManifestSchema,
  modules: z.array(ModuleSchema),
  edges: z.array(EdgeSchema),
  contracts: z.array(ContractSchema),
  flows: z.array(FlowSchema),
  diagnostics: z.array(DiagnosticSchema),
});
export type Project = z.infer<typeof ProjectSchema>;
