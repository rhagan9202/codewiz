import { Project, SourceFile } from "ts-morph";
import { relative } from "node:path";
import type { Edge } from "@codewiz/sdk";

function fileId(sf: SourceFile, projectRoot: string): string {
  return `ts:${relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/")}`;
}

export function extractImportEdges(project: Project, projectRoot: string): Edge[] {
  const edges: Edge[] = [];
  for (const sf of project.getSourceFiles()) {
    for (const decl of sf.getImportDeclarations()) {
      const target = decl.getModuleSpecifierSourceFile();
      if (!target) continue;       // bare-module / unresolved
      edges.push({
        source: fileId(sf, projectRoot),
        target: fileId(target, projectRoot),
        kind: "imports",
        provenance: { source: "static" },
        evidence: [{
          path: relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/"),
          line: decl.getStartLineNumber(),
        }],
      });
    }
  }
  return edges;
}
