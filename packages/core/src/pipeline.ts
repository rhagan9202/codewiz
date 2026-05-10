import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Module, Edge, Diagnostic } from "@codewiz/sdk";
import { walk } from "./walker.js";
import { AdapterRegistry } from "./registry.js";
import { aggregate } from "./aggregator.js";
import { resolveBridges } from "./bridge.js";
import { parseAnnotations, applyAnnotations } from "./annotations.js";
import { persist, type Manifest } from "./persister.js";

export interface RunAnalysisOptions {
  projectRoot: string;
  adapters: string[];                    // names registered in registry
  registry: AdapterRegistry;
  llm?: { provider: string; model: string };  // metadata only in v0.1
}

export async function runAnalysis(opts: RunAnalysisOptions): Promise<Manifest> {
  const { projectRoot, adapters: adapterNames, registry } = opts;

  // Load annotations (optional)
  let annotations = null;
  let annotationDiagnostics: Diagnostic[] = [];
  const annPath = join(projectRoot, ".codewiz.yml");
  if (existsSync(annPath)) {
    const parsed = parseAnnotations(readFileSync(annPath, "utf8"), ".codewiz.yml");
    annotationDiagnostics = parsed.diagnostics;
    if (parsed.value === null) {
      const errSummary = parsed.diagnostics.filter(d => d.level === "error").map(d => d.message).join("; ");
      throw new Error(`invalid .codewiz.yml: ${errSummary}`);
    }
    annotations = parsed.value;
  }

  // Initialize adapters, ask each for its file globs
  const live = adapterNames.map((n) => ({ name: n, adapter: registry.create(n) }));
  const inits = await Promise.all(
    live.map(async ({ name, adapter }) => ({
      name,
      adapter,
      init: await adapter.initialize({ projectRoot, protocolVersion: 1 as const }),
    })),
  );

  let manifest: Manifest;
  try {
    // Walk + dispatch per adapter
    const responses = await Promise.all(
      inits.map(async ({ adapter, init }) => {
        const files = await walk(projectRoot, init.fileGlobs, {
          exclude: annotations?.exclude,
        });
        return adapter.analyze({ files });
      }),
    );

    // Aggregate
    const project = aggregate(responses);

    // Bridge resolution
    const bridgeEdges = resolveBridges(project.httpEndpoints);
    const allEdges: Edge[] = [...project.edges, ...bridgeEdges];

    // Annotations
    let annotated: Module[] = project.modules;
    if (annotations) {
      annotated = applyAnnotations(project.modules, annotations, ".codewiz.yml");
    }

    // Persist
    manifest = await persist(
      projectRoot,
      {
        repoRoot: projectRoot,
        gitCommit: null, gitBranch: null,
        adapters: inits.map(({ init }) => ({ name: init.adapterName, version: init.adapterVersion })),
        llm: opts.llm ?? null,
      },
      {
        modules: annotated,
        edges: allEdges,
        contracts: project.contracts,
        flows: [],   // v0.1 flows are not yet emitted
        diagnostics: [...project.diagnostics, ...annotationDiagnostics],
      },
    );
  } finally {
    await Promise.all(inits.map(({ adapter }) => adapter.shutdown()));
  }
  return manifest;
}
