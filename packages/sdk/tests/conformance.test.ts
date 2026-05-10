import { describe, it, expect } from "vitest";
import { runConformanceSuite } from "../src/conformance.js";
import type { LanguageAdapter } from "../src/adapter.js";

const goodAdapter: LanguageAdapter = {
  async initialize() {
    return {
      adapterName: "@codewiz/adapter-mock",
      adapterVersion: "0.0.0",
      protocolVersion: 1,
      idNamespace: "mock",
      capabilities: ["modules"],
      fileGlobs: ["**/*.mock"],
    };
  },
  async analyze() {
    return {
      modules: [{
        id: "mock:foo.mock", name: "foo", path: "foo.mock", language: "mock",
        layer: { value: "service", provenance: { source: "static" } },
        kind: "service", loc: 1,
        citations: [{ path: "foo.mock", line: 1 }],
      }],
      edges: [], contracts: [], httpEndpoints: [], diagnostics: [],
    };
  },
  async shutdown() {},
};

const dupIdAdapter: LanguageAdapter = {
  ...goodAdapter,
  async analyze() {
    const r = await goodAdapter.analyze({ files: [] });
    return { ...r, modules: [...r.modules, ...r.modules] }; // duplicates
  },
};

const badTargetAdapter: LanguageAdapter = {
  async initialize() {
    return {
      adapterName: "@codewiz/adapter-mock",
      adapterVersion: "0.0.0",
      protocolVersion: 1,
      idNamespace: "mock",
      capabilities: ["modules"],
      fileGlobs: ["**/*.mock"],
    };
  },
  async analyze() {
    return {
      modules: [{
        id: "mock:foo.mock", name: "foo", path: "foo.mock", language: "mock",
        layer: { value: "service", provenance: { source: "static" } },
        kind: "service", loc: 1,
        citations: [{ path: "foo.mock", line: 1 }],
      }],
      edges: [{
        source: "mock:foo.mock",
        target: "mock:nonexistent.mock",
        kind: "imports",
        provenance: { source: "static" },
      }],
      contracts: [], httpEndpoints: [], diagnostics: [],
    };
  },
  async shutdown() {},
};

describe("conformance harness", () => {
  it("good adapter passes", async () => {
    const result = await runConformanceSuite(goodAdapter, {
      projectRoot: "/tmp",
      files: ["foo.mock"],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("duplicate module ids fail the suite", async () => {
    const result = await runConformanceSuite(dupIdAdapter, {
      projectRoot: "/tmp",
      files: ["foo.mock"],
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.includes("duplicate"))).toBe(true);
  });

  it("edge with unknown target in adapter namespace fails the suite", async () => {
    const result = await runConformanceSuite(badTargetAdapter, {
      projectRoot: "/tmp",
      files: ["foo.mock"],
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.includes("target") && f.includes("nonexistent"))).toBe(true);
  });
});
