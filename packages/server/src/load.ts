import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ManifestSchema,
  ModuleSchema, EdgeSchema, ContractSchema, FlowSchema, DiagnosticSchema,
  type Project,
} from "@codewiz/sdk";
import { z } from "zod";

async function readJson<T>(path: string, schema: z.ZodSchema<T>): Promise<T> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    throw new Error(`failed to read ${path}: ${(e as Error).message}`, { cause: e });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`failed to parse ${path}: ${(e as Error).message}`, { cause: e });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`schema validation failed for ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function readProject(projectRoot: string): Promise<Project> {
  const dir = join(projectRoot, ".codewiz");
  const [manifest, modules, edges, contracts, flows, diagnostics] = await Promise.all([
    readJson(join(dir, "manifest.json"),    ManifestSchema),
    readJson(join(dir, "modules.json"),     z.array(ModuleSchema)),
    readJson(join(dir, "edges.json"),       z.array(EdgeSchema)),
    readJson(join(dir, "contracts.json"),   z.array(ContractSchema)),
    readJson(join(dir, "flows.json"),       z.array(FlowSchema)),
    readJson(join(dir, "diagnostics.json"), z.array(DiagnosticSchema)),
  ]);
  return { manifest, modules, edges, contracts, flows, diagnostics };
}
