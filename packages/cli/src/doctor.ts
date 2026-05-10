import type { AdapterRegistry } from "@codewiz/core";

export interface DoctorOptions {
  projectRoot: string;
  registry: AdapterRegistry;
  adapters: string[];
}

export interface DoctorResult {
  allOk: boolean;
  results: { name: string; ok: boolean; error?: string }[];
}

export async function runDoctor(opts: DoctorOptions): Promise<DoctorResult> {
  const results: DoctorResult["results"] = [];
  for (const name of opts.adapters) {
    try {
      const a = opts.registry.create(name);
      await a.initialize({ projectRoot: opts.projectRoot, protocolVersion: 1 });
      await a.shutdown();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: (e as Error).message });
    }
  }
  return { allOk: results.every((r) => r.ok), results };
}
