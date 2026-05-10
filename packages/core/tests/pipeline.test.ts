import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAnalysis } from "../src/pipeline.js";
import { AdapterRegistry } from "../src/registry.js";
import type { LanguageAdapter } from "@codewiz/sdk";

const fakeAdapter: LanguageAdapter = {
  async initialize() {
    return {
      adapterName: "@codewiz/fake",
      adapterVersion: "0.0.0",
      protocolVersion: 1,
      idNamespace: "fake",
      capabilities: ["modules"],
      fileGlobs: ["**/*.fake"],
    };
  },
  async analyze({ files }) {
    return {
      modules: files.map((f) => ({
        id: `fake:${f}`, name: f, path: f, language: "fake",
        layer: { value: "service" as const, provenance: { source: "static" as const } },
        kind: "service" as const, loc: 1,
        citations: [{ path: f, line: 1 }],
      })),
      edges: [], contracts: [], httpEndpoints: [], diagnostics: [],
    };
  },
  async shutdown() {},
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-pipeline-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runAnalysis", () => {
  it("walks repo, runs adapter, persists results", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.fake"), "");
    writeFileSync(join(dir, "src/b.fake"), "");

    const reg = new AdapterRegistry();
    reg.register("fake", () => fakeAdapter);

    const manifest = await runAnalysis({
      projectRoot: dir,
      adapters: ["fake"],
      registry: reg,
    });
    expect(manifest.contentHash).toHaveLength(64);
    expect(existsSync(join(dir, ".codewiz/modules.json"))).toBe(true);
    const modules = JSON.parse(readFileSync(join(dir, ".codewiz/modules.json"), "utf8"));
    expect(modules.length).toBe(2);
  });

  it("applies .codewiz.yml when present", async () => {
    writeFileSync(join(dir, "x.fake"), "");
    writeFileSync(join(dir, ".codewiz.yml"), `
classify:
  rules:
    - pattern: "*.fake"
      layer: ui
`);
    const reg = new AdapterRegistry();
    reg.register("fake", () => fakeAdapter);
    await runAnalysis({ projectRoot: dir, adapters: ["fake"], registry: reg });
    const modules = JSON.parse(readFileSync(join(dir, ".codewiz/modules.json"), "utf8"));
    expect(modules[0].layer.value).toBe("ui");
    expect(modules[0].layer.provenance.source).toBe("annotation");
  });
});
