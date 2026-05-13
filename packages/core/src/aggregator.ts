import type {
  AnalyzeResponse, Module, Edge, Contract, HttpEndpoint, Diagnostic,
} from "@codewiz/sdk";

export interface AggregatedProject {
  modules: Module[];
  edges: Edge[];
  contracts: Contract[];
  httpEndpoints: HttpEndpoint[];
  diagnostics: Diagnostic[];
}

export function aggregate(responses: AnalyzeResponse[]): AggregatedProject {
  const modules: Module[] = [];
  const seenIds = new Set<string>();
  const edges: Edge[] = [];
  const contracts: Contract[] = [];
  const httpEndpoints: HttpEndpoint[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const r of responses) {
    for (const m of r.modules) {
      if (seenIds.has(m.id)) throw new Error(`duplicate module id across adapters: ${m.id}`);
      seenIds.add(m.id);
      modules.push(m);
    }
    edges.push(...r.edges);
    contracts.push(...r.contracts);
    httpEndpoints.push(...r.httpEndpoints);
    diagnostics.push(...r.diagnostics);
  }

  return { modules, edges, contracts, httpEndpoints, diagnostics };
}
