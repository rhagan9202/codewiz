#!/usr/bin/env node
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliRoot = resolve(__dirname, "..");
const repoRoot = resolve(cliRoot, "..", "..");
const webDist = resolve(repoRoot, "packages", "web", "dist");
const target = resolve(cliRoot, "dist", "web");

if (!existsSync(join(webDist, "index.html"))) {
  console.error(`web bundle not found at ${webDist}/index.html`);
  console.error(`run 'pnpm --filter @codewiz/web build' first`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
cpSync(webDist, target, { recursive: true });
console.log(`copied web bundle: ${webDist} → ${target}`);
