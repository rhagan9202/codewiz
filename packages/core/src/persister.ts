import { mkdir, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Module, Edge, Contract, Flow, Diagnostic } from "@codewiz/sdk";

export interface ManifestInput {
  repoRoot: string;
  gitCommit: string | null;
  gitBranch: string | null;
  adapters: { name: string; version: string }[];
  llm: { provider: string; model: string } | null;
}

export interface ProjectData {
  modules: Module[];
  edges: Edge[];
  contracts: Contract[];
  flows: Flow[];
  diagnostics: Diagnostic[];
}

export interface Manifest extends ManifestInput {
  generatedAt: string;
  lastSuccessful: string;
  contentHash: string;
  protocolVersion: 1;
}

async function atomicWrite(path: string, body: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, path);
}

function hashContent(data: ProjectData): string {
  // canonical JSON: stable key ordering at the top level
  const canon = JSON.stringify({
    modules: data.modules,
    edges: data.edges,
    contracts: data.contracts,
    flows: data.flows,
  });
  return createHash("sha256").update(canon).digest("hex");
}

export async function persist(
  projectRoot: string,
  manifest: ManifestInput,
  data: ProjectData,
): Promise<Manifest> {
  const dir = join(projectRoot, ".codewiz");
  await mkdir(dir, { recursive: true });

  const now = new Date().toISOString();
  const fullManifest: Manifest = {
    ...manifest,
    generatedAt: now,
    lastSuccessful: now,
    contentHash: hashContent(data),
    protocolVersion: 1,
  };

  await atomicWrite(join(dir, "modules.json"),     JSON.stringify(data.modules, null, 2));
  await atomicWrite(join(dir, "edges.json"),       JSON.stringify(data.edges, null, 2));
  await atomicWrite(join(dir, "contracts.json"),   JSON.stringify(data.contracts, null, 2));
  await atomicWrite(join(dir, "flows.json"),       JSON.stringify(data.flows, null, 2));
  await atomicWrite(join(dir, "diagnostics.json"), JSON.stringify(data.diagnostics, null, 2));
  await atomicWrite(join(dir, "manifest.json"),    JSON.stringify(fullManifest, null, 2));
  return fullManifest;
}
