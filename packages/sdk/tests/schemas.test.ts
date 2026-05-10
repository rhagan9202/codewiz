import { describe, it, expect } from "vitest";
import { ProvenanceSchema, SourceRefSchema, LayerKeySchema } from "../src/provenance.js";
import { ModuleSchema, EdgeSchema } from "../src/module.js";
import { ContractSchema, FlowSchema } from "../src/contract.js";
import {
  CapabilitySchema, InitRequestSchema, InitResponseSchema,
  AnalyzeRequestSchema, AnalyzeResponseSchema,
  HttpEndpointSchema, DiagnosticSchema,
} from "../src/adapter.js";

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

describe("Contract", () => {
  it("accepts a contract with a single field and one issue", () => {
    const c = {
      id: "User",
      name: "User",
      language: "ts",
      fields: [
        {
          name: "id", type: "string", required: true,
          provenance: { source: "static" },
        },
      ],
      producers: ["ts:auth/User.ts"],
      consumers: ["ts:web/Header.tsx"],
      issues: [{
        kind: "missing", field: "name",
        consumer: "ts:web/Header.tsx", producer: "ts:auth/User.ts",
        expected: { name: "name", type: "string", required: true,
                    source: "Header.tsx:12", snippet: "<span>{u.name}</span>" },
        actual:   { name: "name", type: "string", required: false,
                    source: "User.ts:5",      snippet: "name?: string;" },
        provenance: { source: "static" },
      }],
      related: [],
      citations: [{ path: "auth/User.ts", line: 1 }],
    };
    expect(ContractSchema.parse(c)).toEqual(c);
  });
});

describe("Flow", () => {
  it("accepts a functional flow with steps", () => {
    const f = {
      id: "f_buy", name: "Buy", desc: "purchase flow",
      kind: "functional", health: "ok",
      steps: [{
        mod: "ts:web/Cart.tsx", action: "click buy",
        provenance: { source: "annotation", file: ".codewiz.yml", line: 8 },
      }],
    };
    expect(FlowSchema.parse(f)).toEqual(f);
  });
});

describe("Adapter protocol", () => {
  it("Capability accepts known values", () => {
    expect(CapabilitySchema.parse("modules")).toBe("modules");
    expect(CapabilitySchema.parse("edges-imports")).toBe("edges-imports");
    expect(() => CapabilitySchema.parse("flows")).toThrow();
  });

  it("InitRequest requires protocolVersion 1", () => {
    const r = { projectRoot: "/x", protocolVersion: 1 };
    expect(InitRequestSchema.parse(r)).toEqual(r);
    expect(() => InitRequestSchema.parse({ projectRoot: "/x", protocolVersion: 2 }))
      .toThrow();
  });

  it("InitResponse is structurally valid", () => {
    const r = {
      adapterName: "@codewiz/adapter-ts",
      adapterVersion: "0.1.0",
      protocolVersion: 1,
      capabilities: ["modules", "edges-imports"],
      fileGlobs: ["**/*.ts", "**/*.tsx"],
    };
    expect(InitResponseSchema.parse(r)).toEqual(r);
  });

  it("HttpEndpoint requires verb + pathTemplate", () => {
    const e = {
      side: "client", verb: "POST",
      pathTemplate: "/cart/items",
      module: "ts:client.ts",
      citation: { path: "client.ts", line: 12 },
    };
    expect(HttpEndpointSchema.parse(e)).toEqual(e);
  });

  it("Diagnostic has level + message", () => {
    expect(DiagnosticSchema.parse({ level: "warn", message: "x" }))
      .toEqual({ level: "warn", message: "x" });
  });

  it("AnalyzeRequest and AnalyzeResponse parse round-trip", () => {
    const req = { files: ["a.ts", "b.ts"] };
    expect(AnalyzeRequestSchema.parse(req)).toEqual(req);
    const resp = {
      modules: [], edges: [], contracts: [],
      httpEndpoints: [], diagnostics: [],
    };
    expect(AnalyzeResponseSchema.parse(resp)).toEqual(resp);
  });
});
