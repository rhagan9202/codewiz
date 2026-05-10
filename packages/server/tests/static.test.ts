import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../src/index.js";

let projectRoot: string;
let webDist: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "codewiz-static-proj-"));
  mkdirSync(join(projectRoot, ".codewiz"));
  const manifest = {
    repoRoot: projectRoot, gitCommit: null, gitBranch: null,
    adapters: [], llm: null,
    generatedAt: "2026-05-10T00:00:00Z",
    lastSuccessful: "2026-05-10T00:00:00Z",
    contentHash: "0".repeat(64), protocolVersion: 1,
  };
  writeFileSync(join(projectRoot, ".codewiz/manifest.json"), JSON.stringify(manifest));
  for (const f of ["modules", "edges", "contracts", "flows", "diagnostics"]) {
    writeFileSync(join(projectRoot, `.codewiz/${f}.json`), "[]");
  }

  webDist = mkdtempSync(join(tmpdir(), "codewiz-static-web-"));
  writeFileSync(join(webDist, "index.html"), "<!doctype html><html><body>hi</body></html>");
  mkdirSync(join(webDist, "assets"));
  writeFileSync(join(webDist, "assets/app.js"), "console.log(1);");
});
afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(webDist, { recursive: true, force: true });
});

describe("static file serving", () => {
  it("serves index.html at /", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<!doctype html>");
  });

  it("serves assets/app.js with correct content type", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/assets/app.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("falls back to index.html for unknown paths (SPA mode)", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/some/spa/route"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<!doctype html>");
  });

  it("does NOT fall back to index.html for /api paths", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/api/unknown"));
    expect(res.status).toBe(404);
  });
});
