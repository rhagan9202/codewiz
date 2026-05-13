import { describe, it, expect } from "vitest";
import { aggregate } from "../src/aggregator.js";
import type { AnalyzeResponse } from "@codewiz/sdk";

const r1: AnalyzeResponse = {
  modules: [
    { id: "ts:a.ts", name: "a", path: "a.ts", language: "ts",
      layer: { value: "ui", provenance: { source: "static" } },
      kind: "page", loc: 1, citations: [{ path: "a.ts", line: 1 }] },
  ],
  edges: [{ source: "ts:a.ts", target: "ts:b.ts", kind: "imports",
            provenance: { source: "static" } }],
  contracts: [],
  httpEndpoints: [],
  diagnostics: [{ level: "info", message: "from-ts" }],
};

const r2: AnalyzeResponse = {
  modules: [
    { id: "py:b.py", name: "b", path: "b.py", language: "py",
      layer: { value: "service", provenance: { source: "static" } },
      kind: "service", loc: 2, citations: [{ path: "b.py", line: 1 }] },
  ],
  edges: [],
  contracts: [],
  httpEndpoints: [],
  diagnostics: [],
};

describe("aggregate", () => {
  it("merges modules, edges, diagnostics across adapters", () => {
    const out = aggregate([r1, r2]);
    expect(out.modules.map(m => m.id).sort()).toEqual(["py:b.py", "ts:a.ts"]);
    expect(out.edges.length).toBe(1);
    expect(out.diagnostics.length).toBe(1);
  });

  it("rejects duplicate module ids across adapters", () => {
    const dup: AnalyzeResponse = { ...r1 };
    expect(() => aggregate([r1, dup])).toThrow(/duplicate module id/i);
  });
});
