import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listen } from "@codewiz/server";
import { runAnalyze } from "./analyze.js";
import open from "open";

export interface ServeOptions {
  projectRoot: string;
  port: number;
  noOpen?: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runServe(opts: ServeOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const codewizDir = join(opts.projectRoot, ".codewiz");
  if (!existsSync(codewizDir)) {
    console.log(`  no .codewiz/ found — running first analysis…`);
    await runAnalyze({ projectRoot: opts.projectRoot });
  }

  // The web bundle is embedded next to this file in dist/web/, copied at build time
  // by scripts/copy-web-bundle.mjs.
  const webDist = join(__dirname, "web");
  if (!existsSync(join(webDist, "index.html"))) {
    throw new Error(`web bundle missing at ${webDist}/index.html — did you run 'pnpm --filter codewiz build'?`);
  }

  const handle = listen({
    projectRoot: opts.projectRoot,
    webDist,
    port: opts.port,
  });
  const url = `http://127.0.0.1:${handle.port}/`;
  console.log(`  serving codeWizualizer at ${url}`);

  if (!opts.noOpen) {
    try { await open(url); } catch { /* ignore */ }
  }
  return { url, close: handle.close };
}
