import { describe, it, expect } from "vitest";
import { runDoctor } from "../src/doctor.js";
import { AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";

describe("runDoctor", () => {
  it("reports the TS adapter as healthy", async () => {
    const reg = new AdapterRegistry();
    reg.register("ts", createTsAdapter);
    const r = await runDoctor({ projectRoot: "/tmp", registry: reg, adapters: ["ts"] });
    expect(r.results[0]?.name).toBe("ts");
    expect(r.results[0]?.ok).toBe(true);
    expect(r.allOk).toBe(true);
  });

  it("reports a failure when an adapter throws on initialize", async () => {
    const reg = new AdapterRegistry();
    reg.register("bad", () => ({
      async initialize() { throw new Error("nope"); },
      async analyze() { return { modules: [], edges: [], contracts: [], httpEndpoints: [], diagnostics: [] }; },
      async shutdown() {},
    }));
    const r = await runDoctor({ projectRoot: "/tmp", registry: reg, adapters: ["bad"] });
    expect(r.allOk).toBe(false);
    expect(r.results[0]?.error).toMatch(/nope/);
  });
});
