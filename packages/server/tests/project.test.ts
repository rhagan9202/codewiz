import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../src/index.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-server-"));
  mkdirSync(join(dir, ".codewiz"));
  const manifest = {
    repoRoot: dir, gitCommit: null, gitBranch: null,
    adapters: [{ name: "ts", version: "0.0.1" }], llm: null,
    generatedAt: "2026-05-10T00:00:00Z",
    lastSuccessful: "2026-05-10T00:00:00Z",
    contentHash: "abc".padEnd(64, "0"), protocolVersion: 1,
  };
  writeFileSync(join(dir, ".codewiz/manifest.json"), JSON.stringify(manifest));
  for (const f of ["modules", "edges", "contracts", "flows", "diagnostics"]) {
    writeFileSync(join(dir, `.codewiz/${f}.json`), "[]");
  }
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("GET /api/project", () => {
  it("returns the loaded Project", async () => {
    const app = createServer({ projectRoot: dir, webDist: null });
    const res = await app.fetch(new Request("http://localhost/api/project"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manifest.contentHash).toBeDefined();
    expect(body.modules).toEqual([]);
  });

  it("returns 500 with error JSON when project fails to load", async () => {
    rmSync(join(dir, ".codewiz/manifest.json"));
    const app = createServer({ projectRoot: dir, webDist: null });
    const res = await app.fetch(new Request("http://localhost/api/project"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/manifest\.json/);
  });
});
