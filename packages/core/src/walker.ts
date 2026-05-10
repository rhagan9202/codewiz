import fg from "fast-glob";
import ignore from "ignore";
import { readFileSync, existsSync } from "node:fs";
import { join, posix, sep } from "node:path";

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
    const gi = ignore();
    const giPath = join(projectRoot, ".gitignore");
    if (existsSync(giPath)) gi.add(readFileSync(giPath, "utf8"));
    kept = matches.filter((p) => !gi.ignores(p.split(sep).join(posix.sep)));
  }
  return kept.sort();
}
