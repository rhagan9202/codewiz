import { runAnalysis, AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";

export interface AnalyzeOptions {
  projectRoot: string;
}

export async function runAnalyze(opts: AnalyzeOptions) {
  const reg = new AdapterRegistry();
  reg.register("ts", createTsAdapter);
  return runAnalysis({
    projectRoot: opts.projectRoot,
    adapters: ["ts"],
    registry: reg,
  });
}
