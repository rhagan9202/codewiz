import { Project } from "ts-morph";
import { relative, basename } from "node:path";
import type { Module } from "@codewiz/sdk";
import { classifyKind, classifyLayer } from "./classify.js";

export function extractModules(project: Project, projectRoot: string): Module[] {
  return project.getSourceFiles().map((sf) => {
    const path = relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
    const name = basename(path).replace(/\.[jt]sx?$/, "");
    return {
      id: `ts:${path}`,
      name,
      path,
      language: path.endsWith(".js") || path.endsWith(".jsx") ? "js" : "ts",
      layer: { value: classifyLayer(path), provenance: { source: "static" as const } },
      kind: classifyKind(path),
      loc: sf.getEndLineNumber(),
      citations: [{ path, line: 1 }],
    };
  });
}
