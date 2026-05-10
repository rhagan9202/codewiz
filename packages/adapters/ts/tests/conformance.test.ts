import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runConformanceSuite } from "@codewiz/sdk";
import { createTsAdapter } from "../src/index.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-conformance-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("TS adapter conformance", () => {
  it("passes the SDK conformance suite on a small project", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), `import { B } from "./b"; export const A = B;`);
    writeFileSync(join(dir, "src/b.ts"), `export const B = 1; export interface IB { x: number }`);
    const result = await runConformanceSuite(createTsAdapter(), {
      projectRoot: dir,
      files: ["src/a.ts", "src/b.ts"],
    });
    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
