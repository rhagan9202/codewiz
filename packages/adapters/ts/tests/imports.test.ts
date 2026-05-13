import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/project.js";
import { extractImportEdges } from "../src/imports.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-imports-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractImportEdges", () => {
  it("emits an imports edge for relative imports", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), `import { B } from "./b";`);
    writeFileSync(join(dir, "src/b.ts"), `export const B = 1;`);
    const proj = createProject(dir, ["src/a.ts", "src/b.ts"]);
    const edges = extractImportEdges(proj, dir);
    expect(edges.length).toBe(1);
    expect(edges[0]).toMatchObject({
      source: "ts:src/a.ts",
      target: "ts:src/b.ts",
      kind: "imports",
      provenance: { source: "static" },
    });
  });

  it("ignores bare-module (npm) imports", () => {
    writeFileSync(join(dir, "a.ts"), `import React from "react";`);
    const proj = createProject(dir, ["a.ts"]);
    const edges = extractImportEdges(proj, dir);
    expect(edges).toEqual([]);
  });

  it("resolves index files in directory imports", () => {
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "src/lib"));
    writeFileSync(join(dir, "src/a.ts"), `import { L } from "./lib";`);
    writeFileSync(join(dir, "src/lib/index.ts"), `export const L = 1;`);
    const proj = createProject(dir, ["src/a.ts", "src/lib/index.ts"]);
    const edges = extractImportEdges(proj, dir);
    expect(edges.length).toBe(1);
    expect(edges[0].target).toBe("ts:src/lib/index.ts");
  });
});
