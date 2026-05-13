import { z } from "zod";

export const ManifestInputSchema = z.object({
  repoRoot: z.string(),
  gitCommit: z.string().nullable(),
  gitBranch: z.string().nullable(),
  adapters: z.array(z.object({
    name: z.string(),
    version: z.string(),
  })),
  llm: z.object({
    provider: z.string(),
    model: z.string(),
  }).nullable(),
});
export type ManifestInput = z.infer<typeof ManifestInputSchema>;

export const ManifestSchema = ManifestInputSchema.extend({
  generatedAt: z.string(),
  lastSuccessful: z.string(),
  contentHash: z.string(),
  protocolVersion: z.literal(1),
});
export type Manifest = z.infer<typeof ManifestSchema>;
