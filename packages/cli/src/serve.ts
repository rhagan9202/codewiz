import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { listen } from "@codewiz/server";
import { runAnalyze } from "./analyze.js";
import open from "open";

export interface ServeOptions {
  projectRoot: string;
  port: number;
  noOpen?: boolean;
}

export async function runServe(opts: ServeOptions): Promise<{ url: string; close: () => Promise<void> }> {
  // Run analysis if .codewiz/ doesn't exist yet.
  const codewizDir = join(opts.projectRoot, ".codewiz");
  if (!existsSync(codewizDir)) {
    console.log(`  no .codewiz/ found — running first analysis…`);
    await runAnalyze({ projectRoot: opts.projectRoot });
  }

  // Resolve the bundled web dist via @codewiz/web's package.json.
  const require = createRequire(import.meta.url);
  const webPkg = require.resolve("@codewiz/web/package.json");
  const webDist = resolve(dirname(webPkg), "dist");
  if (!existsSync(join(webDist, "index.html"))) {
    throw new Error(`web bundle missing at ${webDist}/index.html — did you run 'pnpm --filter @codewiz/web build'?`);
  }

  const handle = listen({
    projectRoot: opts.projectRoot,
    webDist,
    port: opts.port,
  });
  const url = `http://127.0.0.1:${handle.port}/`;
  console.log(`  serving codeWizualizer at ${url}`);

  if (!opts.noOpen) {
    try { await open(url); } catch { /* ignore — the URL is printed */ }
  }
  return { url, close: handle.close };
}
