import { Project, SourceFile, SyntaxKind, CallExpression, Node } from "ts-morph";
import { relative } from "node:path";
import type { HttpEndpoint } from "@codewiz/sdk";

const VERB_METHODS = new Set(["get", "post", "put", "delete", "patch"]);

function fileId(sf: SourceFile, projectRoot: string): string {
  return `ts:${relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/")}`;
}

function relPath(sf: SourceFile, projectRoot: string): string {
  return relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
}

export function extractHttpEndpoints(project: Project, projectRoot: string): HttpEndpoint[] {
  const out: HttpEndpoint[] = [];
  for (const sf of project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return;
      const call = node as CallExpression;
      const ep = matchClientCall(call, sf, projectRoot);
      if (ep) out.push(ep);
    });
  }
  return out;
}

function matchClientCall(
  call: CallExpression, sf: SourceFile, projectRoot: string,
): HttpEndpoint | null {
  const expr = call.getExpression();
  // pattern A: <ident>.<verb>("/path", ...)
  if (Node.isPropertyAccessExpression(expr)) {
    const verb = expr.getName().toLowerCase();
    if (VERB_METHODS.has(verb)) {
      const arg0 = call.getArguments()[0];
      if (arg0 && Node.isStringLiteral(arg0)) {
        return {
          side: "client",
          verb: verb.toUpperCase() as HttpEndpoint["verb"],
          pathTemplate: arg0.getLiteralValue(),
          module: fileId(sf, projectRoot),
          citation: { path: relPath(sf, projectRoot), line: call.getStartLineNumber() },
        };
      }
    }
  }
  // pattern B: fetch("/path", { method: "POST" })
  if (Node.isIdentifier(expr) && expr.getText() === "fetch") {
    const [arg0, arg1] = call.getArguments();
    if (arg0 && Node.isStringLiteral(arg0)) {
      let verb: HttpEndpoint["verb"] = "GET";
      if (arg1 && Node.isObjectLiteralExpression(arg1)) {
        const m = arg1.getProperty("method");
        if (m && Node.isPropertyAssignment(m)) {
          const init = m.getInitializer();
          if (init && Node.isStringLiteral(init)) {
            const v = init.getLiteralValue().toUpperCase();
            if (["GET", "POST", "PUT", "DELETE", "PATCH"].includes(v)) {
              verb = v as HttpEndpoint["verb"];
            }
          }
        }
      }
      return {
        side: "client",
        verb,
        pathTemplate: arg0.getLiteralValue(),
        module: fileId(sf, projectRoot),
        citation: { path: relPath(sf, projectRoot), line: call.getStartLineNumber() },
      };
    }
  }
  return null;
}
