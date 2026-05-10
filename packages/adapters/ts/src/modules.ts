import { Project } from "ts-morph";
import { relative } from "node:path";
import type { Module } from "@codewiz/sdk";
import { basename } from "node:path";

export function extractModules(project: Project, projectRoot: string): Module[] {
  return project.getSourceFiles().map((sf) => {
    const path = relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
    const name = basename(path).replace(/\.[jt]sx?$/, "");
    return {
      id: `ts:${path}`,
      name,
      path,
      language: path.endsWith(".js") || path.endsWith(".jsx") ? "js" : "ts",
      layer: { value: "service" as const, provenance: { source: "static" as const } }, // refined in Task 16
      kind: "component" as const,                                                       // refined in Task 16
      loc: sf.getEndLineNumber(),
      citations: [{ path, line: 1 }],
    };
  });
}
