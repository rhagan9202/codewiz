import { describe, it, expect } from "vitest";
import { ProvenanceSchema, SourceRefSchema, LayerKeySchema } from "../src/provenance.js";

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
