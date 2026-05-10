import { Project, SourceFile, InterfaceDeclaration, TypeAliasDeclaration, Node } from "ts-morph";
import { relative } from "node:path";
import type { Contract, Provenance } from "@codewiz/sdk";

const PROV_STATIC: Provenance = { source: "static" };

function relPath(sf: SourceFile, projectRoot: string): string {
  return relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
}

export function extractContracts(project: Project, projectRoot: string): Contract[] {
  const contracts: Contract[] = [];
  for (const sf of project.getSourceFiles()) {
    const path = relPath(sf, projectRoot);
    const moduleId = `ts:${path}`;

    for (const i of sf.getInterfaces()) {
      if (!i.isExported()) continue;
      contracts.push(fromInterface(i, path, moduleId));
    }
    for (const t of sf.getTypeAliases()) {
      if (!t.isExported()) continue;
      const c = fromTypeAlias(t, path, moduleId);
      if (c) contracts.push(c);
    }
  }
  return contracts;
}

function fromInterface(decl: InterfaceDeclaration, path: string, moduleId: string): Contract {
  return {
    id: `${moduleId}::${decl.getName()}`,
    name: decl.getName(),
    language: "ts",
    fields: decl.getProperties().map((p) => ({
      name: p.getName(),
      type: p.getTypeNode()?.getText() ?? p.getType().getText(),
      required: !p.hasQuestionToken(),
      provenance: PROV_STATIC,
    })),
    producers: [moduleId],
    consumers: [],
    issues: [],
    related: [],
    citations: [{ path, line: decl.getStartLineNumber() }],
  };
}

function fromTypeAlias(decl: TypeAliasDeclaration, path: string, moduleId: string): Contract | null {
  const tn = decl.getTypeNode();
  if (!tn || !Node.isTypeLiteral(tn)) return null;
  return {
    id: `${moduleId}::${decl.getName()}`,
    name: decl.getName(),
    language: "ts",
    fields: tn.getProperties().map((p) => ({
      name: p.getName(),
      type: p.getTypeNode()?.getText() ?? p.getType().getText(),
      required: !p.hasQuestionToken(),
      provenance: PROV_STATIC,
    })),
    producers: [moduleId],
    consumers: [],
    issues: [],
    related: [],
    citations: [{ path, line: decl.getStartLineNumber() }],
  };
}
