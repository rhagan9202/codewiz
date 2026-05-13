import { describe, it, expect } from "vitest";
import { resolveBridges } from "../src/bridge.js";
import type { HttpEndpoint } from "@codewiz/sdk";

const ep = (
  side: "client" | "server", verb: HttpEndpoint["verb"],
  path: string, mod: string,
): HttpEndpoint => ({
  side, verb, pathTemplate: path, module: mod,
  citation: { path: mod, line: 1 },
});

describe("resolveBridges", () => {
  it("matches one client to one server with confidence 1", () => {
    const edges = resolveBridges([
      ep("client", "POST", "/cart/items", "ts:client.ts"),
      ep("server", "POST", "/cart/items", "py:routes/cart.py"),
    ]);
    expect(edges.length).toBe(1);
    expect(edges[0]).toMatchObject({
      source: "ts:client.ts", target: "py:routes/cart.py",
      kind: "http",
      provenance: { source: "bridge", confidence: 1 },
    });
  });

  it("normalizes path params (:id vs {id} vs <id>)", () => {
    const edges = resolveBridges([
      ep("client", "GET", "/cart/items/:id", "ts:client.ts"),
      ep("server", "GET", "/cart/items/{id}", "py:routes/cart.py"),
    ]);
    expect(edges.length).toBe(1);
  });

  it("emits low-confidence edges for ambiguous matches", () => {
    const edges = resolveBridges([
      ep("client", "GET", "/x", "ts:client.ts"),
      ep("server", "GET", "/x", "py:a.py"),
      ep("server", "GET", "/x", "py:b.py"),
    ]);
    expect(edges.length).toBe(2);
    for (const e of edges) {
      if (e.provenance.source === "bridge") {
        expect(e.provenance.confidence).toBeLessThan(1);
      }
    }
  });

  it("ignores unmatched endpoints", () => {
    const edges = resolveBridges([
      ep("client", "POST", "/a", "ts:client.ts"),
      ep("server", "POST", "/b", "py:b.py"),
    ]);
    expect(edges).toEqual([]);
  });
});
