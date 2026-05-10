#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./init.js";

const program = new Command();
program.name("codewiz").description("Codebase visualization CLI").version("0.0.1");

program
  .command("init")
  .description("Drop a starter .codewiz.yml in the current directory")
  .option("--no-gitignore", "Do not add .codewiz/ to .gitignore")
  .action(async (opts: { gitignore: boolean }) => {
    const result = await runInit({
      projectRoot: process.cwd(),
      addGitignore: opts.gitignore,
    });
    for (const f of result.created) console.log(`  created  ${f}`);
    for (const f of result.skipped) console.log(`  skipped  ${f} (already exists)`);
  });

import { runDoctor } from "./doctor.js";
import { AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";

function buildRegistry(): AdapterRegistry {
  const reg = new AdapterRegistry();
  reg.register("ts", createTsAdapter);
  return reg;
}

program
  .command("doctor")
  .description("Verify adapter health")
  .action(async () => {
    const r = await runDoctor({
      projectRoot: process.cwd(),
      registry: buildRegistry(),
      adapters: ["ts"],
    });
    for (const res of r.results) {
      console.log(`  ${res.ok ? "✓" : "✗"} ${res.name}${res.error ? ` — ${res.error}` : ""}`);
    }
    process.exit(r.allOk ? 0 : 1);
  });

import { runAnalyze } from "./analyze.js";
import { resolve } from "node:path";

program
  .command("analyze [path]")
  .description("Analyze a repository and write JSON to ./.codewiz/")
  .action(async (pathArg: string | undefined) => {
    const target = resolve(pathArg ?? ".");
    const start = Date.now();
    const manifest = await runAnalyze({ projectRoot: target });
    const dur = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`  analyzed ${target}`);
    console.log(`  contentHash ${manifest.contentHash.slice(0, 12)}…`);
    console.log(`  done in ${dur}s`);
  });

import { runServe } from "./serve.js";

program
  .command("serve [path]")
  .description("Serve the codeWizualizer web UI for the given repo")
  .option("--port <n>", "Port to bind on 127.0.0.1", "8765")
  .option("--no-open", "Don't auto-open the browser")
  .action(async (pathArg: string | undefined, opts: { port: string; open: boolean }) => {
    const target = resolve(pathArg ?? ".");
    const port = parseInt(opts.port, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      console.error(`invalid --port: ${opts.port}`);
      process.exit(1);
    }
    const handle = await runServe({
      projectRoot: target,
      port,
      noOpen: !opts.open,
    });
    console.log(`  press Ctrl-C to stop`);
    process.on("SIGINT", () => {
      void handle.close().then(() => process.exit(0));
    });
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
