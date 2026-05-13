import { LanguageAdapter, InitResponseSchema, AnalyzeResponseSchema } from "./adapter.js";

export interface ConformanceInput {
  projectRoot: string;
  files: string[];
}

export interface ConformanceResult {
  passed: boolean;
  failures: string[];
}

export async function runConformanceSuite(
  adapter: LanguageAdapter,
  input: ConformanceInput,
): Promise<ConformanceResult> {
  const failures: string[] = [];

  let init;
  try {
    init = InitResponseSchema.parse(
      await adapter.initialize({
        projectRoot: input.projectRoot,
        protocolVersion: 1,
      }),
    );
  } catch (e) {
    failures.push(`initialize() failed schema validation: ${(e as Error).message}`);
    return { passed: false, failures };
  }

  let resp;
  try {
    resp = AnalyzeResponseSchema.parse(await adapter.analyze({ files: input.files }));
  } catch (e) {
    failures.push(`analyze() failed schema validation: ${(e as Error).message}`);
    return { passed: false, failures };
  }

  // Invariant: module IDs unique
  const ids = new Set<string>();
  for (const m of resp.modules) {
    if (ids.has(m.id)) failures.push(`duplicate module id: ${m.id}`);
    ids.add(m.id);
  }

  // Invariant: edges reference declared modules (within this adapter's output)
  const nsPrefix = `${init.idNamespace}:`;
  for (const e of resp.edges) {
    if (!ids.has(e.source) && e.source.startsWith(nsPrefix)) {
      failures.push(`edge source ${e.source} not in modules`);
    }
    if (!ids.has(e.target) && e.target.startsWith(nsPrefix)) {
      failures.push(`edge target ${e.target} not in modules`);
    }
  }

  // Invariant: every module has at least one citation
  for (const m of resp.modules) {
    if (m.citations.length === 0) failures.push(`module ${m.id} has no citations`);
  }

  await adapter.shutdown();
  return { passed: failures.length === 0, failures };
}
