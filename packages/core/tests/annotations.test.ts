import { describe, it, expect } from "vitest";
import {
  parseAnnotations, applyAnnotations, type Annotations,
} from "../src/annotations.js";
import type { Module, Diagnostic } from "@codewiz/sdk";

const mod = (id: string, path: string, kind: Module["kind"] = "service"): Module => ({
  id, name: id, path, language: "ts",
  layer: { value: "service", provenance: { source: "static" } },
  kind, loc: 1, citations: [{ path, line: 1 }],
});

describe("parseAnnotations", () => {
  it("parses a minimal yaml", () => {
    const yaml = `
classify:
  rules:
    - pattern: "src/**/*.tsx"
      layer: ui
review:
  - { path: "x.ts", level: warn, note: "stale" }
exclude:
  - "tests/**"
`;
    const parsed = parseAnnotations(yaml, ".codewiz.yml");
    expect(parsed.value).not.toBeNull();
    expect(parsed.diagnostics).toEqual([]);
  });

  it("warns on flows section (not yet supported in v0.1)", () => {
    const yaml = `
flows:
  - id: f
    name: Flow
    kind: functional
    entry: x
    steps: []
`;
    const parsed = parseAnnotations(yaml, ".codewiz.yml");
    expect(parsed.value).not.toBeNull();
    expect(parsed.diagnostics.find((d: Diagnostic) =>
      d.message.includes("flows") && d.level === "warn",
    )).toBeTruthy();
  });

  it("errors on invalid layer", () => {
    const yaml = `
classify:
  rules:
    - pattern: "x"
      layer: notalayer
`;
    const parsed = parseAnnotations(yaml, ".codewiz.yml");
    expect(parsed.value).toBeNull();
    expect(parsed.diagnostics.some(d => d.level === "error")).toBe(true);
  });
});

describe("applyAnnotations", () => {
  it("classify.rules overrides layer with annotation provenance", () => {
    const ann: Annotations = {
      classify: {
        rules: [{ pattern: "src/**/*.tsx", layer: "ui" }],
        pin: {},
      },
      review: [],
      exclude: [],
    };
    const out = applyAnnotations(
      [mod("ts:src/App.tsx", "src/App.tsx", "service")],
      ann,
      ".codewiz.yml",
    );
    expect(out[0]!.layer.value).toBe("ui");
    expect(out[0]!.layer.provenance.source).toBe("annotation");
  });

  it("classify.pin overrides classify.rules", () => {
    const ann: Annotations = {
      classify: {
        rules: [{ pattern: "src/**/*.tsx", layer: "ui" }],
        pin: { "src/App.tsx": { layer: "service" } },
      },
      review: [],
      exclude: [],
    };
    const out = applyAnnotations(
      [mod("ts:src/App.tsx", "src/App.tsx")],
      ann,
      ".codewiz.yml",
    );
    expect(out[0]!.layer.value).toBe("service");
  });

  it("review entries set module.notes and annotation tag", () => {
    const ann: Annotations = {
      classify: { rules: [], pin: {} },
      review: [{ path: "x.ts", level: "warn", note: "stale-cache" }],
      exclude: [],
    };
    const out = applyAnnotations(
      [mod("ts:x.ts", "x.ts")],
      ann,
      ".codewiz.yml",
    );
    expect(out[0]!.notes).toBe("stale-cache");
    expect(out[0]!.annotation).toBe("warn");
  });
});
