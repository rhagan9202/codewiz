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

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
