import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAnalyze } from "../src/analyze.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-analyze-cli-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runAnalyze", () => {
  it("produces a complete .codewiz/ output for a tiny project", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), `import { B } from "./b"; export const A = B;`);
    writeFileSync(join(dir, "src/b.ts"), `export const B = 1; export interface IB { x: number }`);
    const manifest = await runAnalyze({ projectRoot: dir });
    expect(manifest.contentHash).toHaveLength(64);
    for (const f of ["modules.json", "edges.json", "contracts.json", "manifest.json"]) {
      expect(existsSync(join(dir, ".codewiz", f))).toBe(true);
    }
    const modules = JSON.parse(readFileSync(join(dir, ".codewiz/modules.json"), "utf8"));
    expect(modules.map((m: { id: string }) => m.id).sort()).toEqual([
      "ts:src/a.ts", "ts:src/b.ts",
    ]);
  });
});
