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

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
