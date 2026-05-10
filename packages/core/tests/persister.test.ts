import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { persist, type ManifestInput } from "../src/persister.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-persist-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("persist", () => {
  it("writes manifest + modules.json + edges.json + contracts.json + flows.json + diagnostics.json", async () => {
    const manifest: ManifestInput = {
      repoRoot: dir, gitCommit: null, gitBranch: null,
      adapters: [{ name: "ts", version: "0.1.0" }],
      llm: null,
    };
    await persist(dir, manifest, {
      modules: [], edges: [], contracts: [], flows: [], diagnostics: [],
    });

    expect(existsSync(join(dir, ".codewiz/manifest.json"))).toBe(true);
    for (const f of ["modules.json", "edges.json", "contracts.json", "flows.json", "diagnostics.json"]) {
      expect(existsSync(join(dir, ".codewiz", f))).toBe(true);
    }
    const m = JSON.parse(readFileSync(join(dir, ".codewiz/manifest.json"), "utf8"));
    expect(m.adapters[0].name).toBe("ts");
    expect(typeof m.contentHash).toBe("string");
    expect(m.contentHash).toHaveLength(64); // SHA-256 hex
  });

  it("contentHash changes when modules change", async () => {
    const manifest: ManifestInput = {
      repoRoot: dir, gitCommit: null, gitBranch: null,
      adapters: [], llm: null,
    };
    await persist(dir, manifest, { modules: [], edges: [], contracts: [], flows: [], diagnostics: [] });
    const h1 = JSON.parse(readFileSync(join(dir, ".codewiz/manifest.json"), "utf8")).contentHash;

    await persist(dir, manifest, {
      modules: [{
        id: "x", name: "x", path: "x", language: "ts",
        layer: { value: "ui", provenance: { source: "static" } },
        kind: "page", loc: 1, citations: [{ path: "x", line: 1 }],
      }],
      edges: [], contracts: [], flows: [], diagnostics: [],
    });
    const h2 = JSON.parse(readFileSync(join(dir, ".codewiz/manifest.json"), "utf8")).contentHash;
    expect(h1).not.toBe(h2);
  });
});
