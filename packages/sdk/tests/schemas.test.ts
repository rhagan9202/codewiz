import { describe, it, expect } from "vitest";
import { ProvenanceSchema, SourceRefSchema, LayerKeySchema } from "../src/provenance.js";
import { ModuleSchema, EdgeSchema } from "../src/module.js";

describe("Provenance", () => {
  it("accepts a static provenance", () => {
    expect(ProvenanceSchema.parse({ source: "static" })).toEqual({ source: "static" });
  });

  it("accepts an annotation provenance with file:line", () => {
    const p = { source: "annotation", file: ".codewiz.yml", line: 12 };
    expect(ProvenanceSchema.parse(p)).toEqual(p);
  });

  it("accepts a bridge provenance with confidence in [0,1]", () => {
    const p = { source: "bridge", confidence: 0.8 };
    expect(ProvenanceSchema.parse(p)).toEqual(p);
  });

  it("rejects bridge confidence > 1", () => {
    expect(() => ProvenanceSchema.parse({ source: "bridge", confidence: 1.5 })).toThrow();
  });

  it("accepts an llm provenance with citations", () => {
    const p = {
      source: "llm",
      model: "anthropic/claude-sonnet-4-6",
      promptHash: "abc123",
      confidence: 0.6,
      citations: [{ path: "src/x.ts", line: 4 }],
    };
    expect(ProvenanceSchema.parse(p)).toEqual(p);
  });
});

describe("LayerKey", () => {
  it("accepts the six layers", () => {
    for (const k of ["ui", "state", "api", "service", "data", "external"]) {
      expect(LayerKeySchema.parse(k)).toBe(k);
    }
  });

  it("rejects unknown layers", () => {
    expect(() => LayerKeySchema.parse("frontend")).toThrow();
  });
});

describe("SourceRef", () => {
  it("accepts path+line, optional col", () => {
    expect(SourceRefSchema.parse({ path: "a.ts", line: 5 })).toEqual({ path: "a.ts", line: 5 });
    expect(SourceRefSchema.parse({ path: "a.ts", line: 5, col: 10 })).toEqual({
      path: "a.ts", line: 5, col: 10,
    });
  });
});

describe("Module", () => {
  it("accepts a minimal module record", () => {
    const m = {
      id: "ts:web/src/App.tsx",
      name: "App",
      path: "web/src/App.tsx",
      language: "ts",
      layer: { value: "ui", provenance: { source: "static" } },
      kind: "page",
      loc: 42,
      citations: [{ path: "web/src/App.tsx", line: 1 }],
    };
    expect(ModuleSchema.parse(m)).toEqual(m);
  });

  it("rejects an unknown kind", () => {
    expect(() => ModuleSchema.parse({
      id: "x", name: "X", path: "x", language: "ts",
      layer: { value: "ui", provenance: { source: "static" } },
      kind: "weirdo", loc: 0, citations: [],
    })).toThrow();
  });
});

describe("Edge", () => {
  it("accepts a static imports edge", () => {
    const e = {
      source: "ts:a.ts", target: "ts:b.ts",
      kind: "imports", provenance: { source: "static" },
    };
    expect(EdgeSchema.parse(e)).toEqual(e);
  });

  it("accepts a bridge http edge with confidence", () => {
    const e = {
      source: "ts:client.ts", target: "py:routes/x.py",
      kind: "http",
      provenance: { source: "bridge", confidence: 0.9 },
    };
    expect(EdgeSchema.parse(e)).toEqual(e);
  });
});
