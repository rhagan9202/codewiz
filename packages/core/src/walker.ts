import fg from "fast-glob";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join, posix, sep } from "node:path";

const _require = createRequire(import.meta.url);
// ignore is a CommonJS module; createRequire gives us the raw factory function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _ignore = _require("ignore") as any;
type IgnoreInstance = { add(p: string): void; ignores(p: string): boolean };
function createIgnoreInstance(): IgnoreInstance {
  // Depending on the CJS/ESM interop path, the module may be the factory itself
  // or wrap it under a `.default` key.
  return typeof _ignore === "function" ? (_ignore() as IgnoreInstance) : ((_ignore.default as () => IgnoreInstance)());
}

export interface WalkOptions {
  exclude?: string[];   // additional glob excludes
  honorGitignore?: boolean; // default true
}

export async function walk(
  projectRoot: string,
  globs: string[],
  opts: WalkOptions = {},
): Promise<string[]> {
  const { exclude = [], honorGitignore = true } = opts;

  const matches = await fg(globs, {
    cwd: projectRoot,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ["**/node_modules/**", "**/.git/**", ...exclude],
  });

  let kept = matches;
  if (honorGitignore) {
    const gi = createIgnoreInstance();
    const giPath = join(projectRoot, ".gitignore");
    if (existsSync(giPath)) gi.add(readFileSync(giPath, "utf8"));
    kept = matches.filter((p) => !gi.ignores(p.split(sep).join(posix.sep)));
  }
  return kept.sort();
}
