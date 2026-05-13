import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProject } from "../src/load.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-load-"));
  mkdirSync(join(dir, ".codewiz"));
  const manifest = {
    repoRoot: dir, gitCommit: null, gitBranch: null,
    adapters: [{ name: "ts", version: "0.0.1" }], llm: null,
    generatedAt: "2026-05-10T00:00:00Z",
    lastSuccessful: "2026-05-10T00:00:00Z",
    contentHash: "0".repeat(64), protocolVersion: 1,
  };
  writeFileSync(join(dir, ".codewiz/manifest.json"), JSON.stringify(manifest));
  writeFileSync(join(dir, ".codewiz/modules.json"), "[]");
  writeFileSync(join(dir, ".codewiz/edges.json"), "[]");
  writeFileSync(join(dir, ".codewiz/contracts.json"), "[]");
  writeFileSync(join(dir, ".codewiz/flows.json"), "[]");
  writeFileSync(join(dir, ".codewiz/diagnostics.json"), "[]");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("readProject", () => {
  it("returns the unified Project from .codewiz/ JSON files", async () => {
    const p = await readProject(dir);
    expect(p.manifest.contentHash).toHaveLength(64);
    expect(p.modules).toEqual([]);
    expect(p.edges).toEqual([]);
  });

  it("throws ENOENT-style error when .codewiz/manifest.json is missing", async () => {
    rmSync(join(dir, ".codewiz/manifest.json"));
    await expect(readProject(dir)).rejects.toThrow(/manifest\.json/);
  });

  it("throws when manifest fails schema validation", async () => {
    writeFileSync(join(dir, ".codewiz/manifest.json"), '{"bad":"data"}');
    await expect(readProject(dir)).rejects.toThrow();
  });
});
