import { describe, it, expect } from "vitest";
import { AdapterRegistry } from "../src/registry.js";
import type { LanguageAdapter } from "@codewiz/sdk";

const mockAdapter: LanguageAdapter = {
  async initialize() {
    return {
      adapterName: "@codewiz/mock",
      adapterVersion: "0.0.0",
      protocolVersion: 1,
      idNamespace: "mock",
      capabilities: ["modules"],
      fileGlobs: ["**/*.mock"],
    };
  },
  async analyze() {
    return { modules: [], edges: [], contracts: [], httpEndpoints: [], diagnostics: [] };
  },
  async shutdown() {},
};

describe("AdapterRegistry", () => {
  it("registers and resolves an adapter", async () => {
    const reg = new AdapterRegistry();
    reg.register("mock", () => mockAdapter);
    const adapter = reg.create("mock");
    const init = await adapter.initialize({ projectRoot: "/tmp", protocolVersion: 1 });
    expect(init.adapterName).toBe("@codewiz/mock");
  });

  it("throws on unknown adapter", () => {
    const reg = new AdapterRegistry();
    expect(() => reg.create("none")).toThrow(/unknown adapter/i);
  });

  it("lists registered adapter names", () => {
    const reg = new AdapterRegistry();
    reg.register("a", () => mockAdapter);
    reg.register("b", () => mockAdapter);
    expect(reg.list().sort()).toEqual(["a", "b"]);
  });
});
