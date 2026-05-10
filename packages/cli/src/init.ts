import { writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";

const STARTER = `# .codewiz.yml — see https://github.com/<repo>/docs/annotations-reference.md
classify:
  rules: []
  pin: {}
review: []
exclude:
  - "**/__generated__/**"
  - "tests/**"
`;

export interface InitOptions {
  projectRoot: string;
  addGitignore: boolean;
}

export interface InitResult {
  created: string[];
  skipped: string[];
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

export async function runInit(opts: InitOptions): Promise<InitResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  const ymlPath = join(opts.projectRoot, ".codewiz.yml");
  if (await exists(ymlPath)) {
    skipped.push(".codewiz.yml");
  } else {
    await writeFile(ymlPath, STARTER, "utf8");
    created.push(".codewiz.yml");
  }

  if (opts.addGitignore) {
    const giPath = join(opts.projectRoot, ".gitignore");
    let cur = "";
    if (await exists(giPath)) cur = await readFile(giPath, "utf8");
    if (!cur.split("\n").some((l) => l.trim() === ".codewiz/")) {
      await writeFile(
        giPath,
        cur + (cur.endsWith("\n") || cur === "" ? "" : "\n") + ".codewiz/\n",
        "utf8",
      );
      created.push(".gitignore");
    } else {
      skipped.push(".gitignore");
    }
  }
  return { created, skipped };
}
