import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walk } from "../src/walker.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-walker-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("walk", () => {
  it("returns files matching globs, repo-relative, sorted", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "");
    writeFileSync(join(dir, "src/b.tsx"), "");
    writeFileSync(join(dir, "README.md"), "");
    const files = await walk(dir, ["**/*.ts", "**/*.tsx"]);
    expect(files).toEqual(["src/a.ts", "src/b.tsx"]);
  });

  it("respects .gitignore", async () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\n*.log\n");
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules/x.ts"), "");
    writeFileSync(join(dir, "app.ts"), "");
    writeFileSync(join(dir, "debug.log"), "");
    const files = await walk(dir, ["**/*"]);
    expect(files).toEqual([".gitignore", "app.ts"]);
  });

  it("respects extra exclude globs", async () => {
    writeFileSync(join(dir, "a.ts"), "");
    writeFileSync(join(dir, "a.test.ts"), "");
    const files = await walk(dir, ["**/*.ts"], { exclude: ["**/*.test.ts"] });
    expect(files).toEqual(["a.ts"]);
  });
});
