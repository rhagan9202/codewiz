import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-init-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runInit", () => {
  it("writes a starter .codewiz.yml", async () => {
    const r = await runInit({ projectRoot: dir, addGitignore: false });
    expect(r.created).toContain(".codewiz.yml");
    expect(existsSync(join(dir, ".codewiz.yml"))).toBe(true);
    expect(readFileSync(join(dir, ".codewiz.yml"), "utf8")).toContain("classify:");
  });

  it("appends to .gitignore when requested", async () => {
    await runInit({ projectRoot: dir, addGitignore: true });
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".codewiz/");
  });

  it("skips writing .codewiz.yml if it already exists", async () => {
    await runInit({ projectRoot: dir, addGitignore: false });
    const r = await runInit({ projectRoot: dir, addGitignore: false });
    expect(r.skipped).toContain(".codewiz.yml");
  });
});
