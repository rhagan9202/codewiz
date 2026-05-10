import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runAnalyze } from "codewiz/dist/analyze.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(__dirname, "../fixtures/tiny-react-app");
const GOLD = join(FIX, "__golden__");

let workdir: string;

beforeAll(async () => {
  // Copy fixture to a temp dir so the analysis output doesn't pollute the repo.
  workdir = mkdtempSync(join(tmpdir(), "codewiz-e2e-"));
  cpSync(FIX, workdir, {
    recursive: true,
    filter: (src) => !src.includes("__golden__"),
  });
  await runAnalyze({ projectRoot: workdir });
});

afterAll(() => rmSync(workdir, { recursive: true, force: true }));

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(workdir, ".codewiz", rel), "utf8"));
}
function readGold(rel: string): unknown {
  return JSON.parse(readFileSync(join(GOLD, rel), "utf8"));
}
// Strip volatile fields (timestamps, tmp paths) so golden diffs are stable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(x: any): any {
  if (Array.isArray(x)) return x.map(normalize);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) {
      if (k === "generatedAt" || k === "lastSuccessful" || k === "repoRoot") continue;
      o[k] = normalize(v);
    }
    return o;
  }
  return x;
}

describe("e2e: analyze tiny-react-app", () => {
  it("produces the expected output files", () => {
    for (const f of ["modules.json", "edges.json", "contracts.json", "manifest.json"]) {
      expect(existsSync(join(workdir, ".codewiz", f))).toBe(true);
    }
  });

  it("modules.json matches golden", () => {
    expect(normalize(readJson("modules.json"))).toEqual(normalize(readGold("modules.json")));
  });

  it("edges.json matches golden", () => {
    expect(normalize(readJson("edges.json"))).toEqual(normalize(readGold("edges.json")));
  });

  it("contracts.json matches golden", () => {
    expect(normalize(readJson("contracts.json"))).toEqual(normalize(readGold("contracts.json")));
  });

  it("manifest summary matches golden (modules count, edges count, contracts count, hash length, adapter)", () => {
    const m = readJson("manifest.json") as Record<string, unknown>;
    const summary = {
      adapters: (m.adapters as Array<{ name: string }>).map((a) => ({ name: a.name })),
      contentHashLength: (m.contentHash as string).length,
      protocolVersion: m.protocolVersion,
    };
    expect(summary).toEqual(readGold("manifest.summary.json"));
  });
});
