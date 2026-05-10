import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractModules } from "../src/modules.js";
import { createProject } from "../src/project.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-ts-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractModules", () => {
  it("creates a Module per file with stable id and citation", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/App.tsx"), "export default function App(){return null}");
    writeFileSync(join(dir, "src/util.ts"), "export const x = 1;");
    const proj = createProject(dir, ["src/App.tsx", "src/util.ts"]);
    const mods = extractModules(proj, dir);
    expect(mods.map(m => m.id).sort()).toEqual([
      "ts:src/App.tsx",
      "ts:src/util.ts",
    ]);
    expect(mods[0].language).toBe("ts");
    expect(mods[0].citations[0].path).toBe(mods[0].path);
  });
});
