import type { LanguageAdapter, AnalyzeResponse } from "@codewiz/sdk";
import { createProject } from "./project.js";
import { extractModules } from "./modules.js";
import { extractImportEdges } from "./imports.js";
import { extractHttpEndpoints } from "./http.js";
import { extractContracts } from "./contracts.js";

export function createTsAdapter(): LanguageAdapter {
  let projectRoot = "";
  return {
    async initialize(req) {
      projectRoot = req.projectRoot;
      return {
        adapterName: "@codewiz/adapter-ts",
        adapterVersion: "0.0.1",
        protocolVersion: 1,
        idNamespace: "ts",
        capabilities: ["modules", "edges-imports", "contracts", "http-endpoints"],
        fileGlobs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
      };
    },
    async analyze({ files }): Promise<AnalyzeResponse> {
      const proj = createProject(projectRoot, files);
      const modules = extractModules(proj, projectRoot);
      const edges = extractImportEdges(proj, projectRoot);
      const httpEndpoints = extractHttpEndpoints(proj, projectRoot);
      const contracts = extractContracts(proj, projectRoot);
      return {
        modules, edges, contracts, httpEndpoints,
        diagnostics: [],
      };
    },
    async shutdown() {
      // ts-morph holds no native handles; nothing to release.
    },
  };
}

export * from "./project.js";
export * from "./modules.js";
export * from "./imports.js";
export * from "./http.js";
export * from "./contracts.js";
export * from "./classify.js";
