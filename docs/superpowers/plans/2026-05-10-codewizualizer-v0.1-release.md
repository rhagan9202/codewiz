# codeWizualizer v0.1 — Release Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take v0.1 from "works locally on a workspace checkout" to "any user runs `npx codewiz serve <repo>` and it just works." Embed the Vite web bundle into the published CLI tarball, ship a README + MIT license, set up Changesets for versioning, two GitHub Actions workflows (CI on every push + release on Changesets PR merge), and publish v0.1.0 to npm.

**Architecture:** A pre-`tsc` build step in the CLI package copies `@codewiz/web/dist/` into `packages/cli/dist/web/` so the bundle ships inside the `codewiz` npm package itself rather than as a separate runtime dependency. `serve.ts` switches from `require.resolve("@codewiz/web/...")` to `fileURLToPath(new URL("./web/", import.meta.url))` so resolution works identically in workspace and post-install. `@codewiz/web` is removed from CLI runtime deps (stays as a `devDependency` for the build copy step). Changesets manages versioning and changelogs; the release workflow opens a "Version Packages" PR that, when merged, triggers the publish step.

**Tech Stack:** `@changesets/cli` 2.x, GitHub Actions, `pnpm/action-setup`, `actions/setup-node@v4`, `microsoft/playwright-github-action` (or inline `pnpm exec playwright install`), `changesets/action@v1`.

**Predecessor plans:**
- `docs/superpowers/plans/2026-05-10-codewizualizer-v0.1-analyzer-cli.md` (Plan 1, tag `v0.1.0-foundation`)
- `docs/superpowers/plans/2026-05-10-codewizualizer-v0.1-web-ui.md` (Plan 2, tag `v0.1.0-web`)

**Spec:** `docs/superpowers/specs/2026-05-10-codewizualizer-production-design.md` §10 v0.1 ships ("Packaging: published as `codewiz` on npm, MIT license, GitHub Actions release workflow"), §10 acceptance criterion #6 ("Playwright smoke test passes in CI").

---

## File structure produced by this plan

```
codewiz/
├── packages/
│   └── cli/
│       ├── scripts/
│       │   └── copy-web-bundle.mjs    # NEW — runs before tsc
│       ├── src/
│       │   └── serve.ts                # MODIFY — bundled-web resolution
│       └── package.json                # MODIFY — scripts, deps, files
├── .github/
│   └── workflows/
│       ├── ci.yml                      # NEW
│       └── release.yml                 # NEW
├── .changeset/
│   ├── config.json                     # NEW
│   ├── README.md                       # NEW (boilerplate, generated)
│   └── initial-v01.md                  # NEW first changeset entry
├── README.md                           # NEW
├── LICENSE                             # NEW (MIT)
└── CHANGELOG.md                        # auto-generated on first version run
```

---

## Task 1: Embed web bundle in CLI package (Plan-2 follow-up)

**Files:**
- Create: `packages/cli/scripts/copy-web-bundle.mjs`
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/serve.ts`

This is the Plan-2 known issue: `@codewiz/web` is `private: true` (correct — it should never publish standalone) but the CLI's runtime resolution depends on it being installable. Fix by embedding the built bundle inside the CLI's own `dist/`.

- [ ] **Step 1: Create the copy script**

`packages/cli/scripts/copy-web-bundle.mjs`:
```js
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
```

- [ ] **Step 2: Update `packages/cli/package.json`**

Replace the file with:
```json
{
  "name": "codewiz",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/bin.js",
  "bin": { "codewiz": "./dist/bin.js" },
  "files": ["dist"],
  "scripts": {
    "build": "node scripts/copy-web-bundle.mjs && tsc",
    "test": "vitest run",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@codewiz/core": "workspace:*",
    "@codewiz/adapter-ts": "workspace:*",
    "@codewiz/server": "workspace:*",
    "@codewiz/sdk": "workspace:*",
    "commander": "^12.1.0",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "@codewiz/web": "workspace:*",
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

Key changes from Plan 2:
- `@codewiz/web` moved from `dependencies` to `devDependencies` (only needed at build time for the copy step).
- `build` script runs `copy-web-bundle.mjs` before `tsc`.
- `files: ["dist"]` already includes the copied web bundle since it lives inside `dist/`.

Then run: `pnpm install` (re-resolves the workspace deps).

- [ ] **Step 3: Update `packages/cli/src/serve.ts`**

Find the `serve.ts` block that does `createRequire` + `require.resolve("@codewiz/web/package.json")` and replace with bundled-relative resolution.

Replace the entire `runServe` function body. Full new file content:
```ts
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
  // Run analysis if .codewiz/ doesn't exist yet.
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
```

- [ ] **Step 4: Build everything**

```
source ~/.nvm/nvm.sh && nvm use 24
pnpm -r build
ls packages/cli/dist/web/
```
Expected: `packages/cli/dist/web/index.html`, `packages/cli/dist/web/assets/...` exist.

- [ ] **Step 5: Smoke-test the embedded resolution**

```
node packages/cli/dist/bin.js serve tests/fixtures/tiny-react-app --port 8770 --no-open &
sleep 3
curl -sS -o /dev/null -w "html: %{http_code}\n" http://127.0.0.1:8770/
curl -sS http://127.0.0.1:8770/api/project | head -c 80
echo
kill %1 2>/dev/null
wait %1 2>/dev/null
rm -rf tests/fixtures/tiny-react-app/.codewiz/
```
Expected: `html: 200` and JSON beginning `{"manifest":...`.

- [ ] **Step 6: Re-run Playwright e2e to confirm nothing broke**

```
pnpm --filter @codewiz/tests test:e2e
```
Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```
git add packages/cli/ pnpm-lock.yaml
git commit -m "feat(cli): embed web bundle into dist/ for npm distribution"
```

---

## Task 2: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `README.md` at the repo root:

````markdown
# codeWizualizer

> Open-source codebase visualization CLI. Maps your repository into Architecture, Dependencies, Functional flow, Data flow, Contracts, and Files views — with honest provenance on every datum.

[![npm version](https://img.shields.io/npm/v/codewiz.svg)](https://www.npmjs.com/package/codewiz)
[![CI](https://github.com/rhagan9202/codewiz/actions/workflows/ci.yml/badge.svg)](https://github.com/rhagan9202/codewiz/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## What it does

Run it on a TypeScript / JavaScript repo and you get:

- **Architecture overview** — modules laid out in swimlanes by layer (UI / State / API / Service / Data / External), with curved edges showing how they connect.
- **Files** — annotated source list with a synthetic code preview and per-row provenance badges.
- **Provenance everywhere** — every datum is tagged `static` (parser fact), `annotation` (`.codewiz.yml` override), `bridge` (cross-language inference), or `llm` (model-derived). You always know what's a fact vs. a guess.
- **Live re-analysis** — a button in the UI re-runs the analyzer and streams progress over Server-Sent Events.

The other four views (Dependencies, Functional flow, Data flow, Contracts) are wired into the navigation but disabled in v0.1 — they ship in v0.2–v0.4. See the [phasing roadmap](docs/superpowers/specs/2026-05-10-codewizualizer-production-design.md#12-phasing-roadmap).

## Install

```bash
npx codewiz analyze .
npx codewiz serve .
```

Or install globally:
```bash
npm install -g codewiz
codewiz analyze /path/to/repo
codewiz serve /path/to/repo
```

Requires Node.js 24 or newer.

## Quick start

```bash
# In a TypeScript / JavaScript project:
npx codewiz init       # writes a starter .codewiz.yml (optional)
npx codewiz analyze .  # produces ./.codewiz/{modules,edges,...}.json
npx codewiz serve .    # opens the browser to the UI
```

## Annotations (`.codewiz.yml`)

Override or supplement the analyzer's classifications by dropping a `.codewiz.yml` at the repo root. v0.1 supports `classify` (layer/team/domain rules and pins), `review` (warn/err notes), and `exclude` (file globs). The `flows`, `contracts`, `bridges`, and `llm` sections are parsed for forward compatibility but ship in later versions.

```yaml
classify:
  rules:
    - pattern: "web/src/pages/**/*.tsx"
      layer: ui
      team: web
  pin:
    "web/src/components/Header.tsx": { domain: core }
review:
  - { path: "api/services/CartService.ts", level: warn,
      note: "Stale-cache bug found 2026-05-08" }
exclude:
  - "**/__generated__/**"
  - "tests/**"
```

## CLI subcommands

| Command | What it does |
|---|---|
| `codewiz init` | Drops a starter `.codewiz.yml` (optionally adds `.codewiz/` to `.gitignore`). |
| `codewiz analyze [path]` | Analyzes the repo, writes JSON to `./.codewiz/`. |
| `codewiz serve [path]` | Runs analyze if needed, starts a local server (default port 8765), opens the browser. |
| `codewiz doctor` | Verifies adapter health. |

## Architecture

codeWizualizer is a [pnpm](https://pnpm.io/) workspace with five packages:

| Package | Purpose |
|---|---|
| `@codewiz/sdk` | Wire-format Zod schemas (Module, Edge, Contract, Flow, Manifest, Project) + `LanguageAdapter` interface + conformance harness. Browser-importable. |
| `@codewiz/core` | Orchestrator pipeline: walker → adapter loader → aggregator → bridge resolver → annotations applier → persister. |
| `@codewiz/adapter-ts` | TypeScript / JavaScript language adapter, in-process via [ts-morph](https://ts-morph.com/). |
| `@codewiz/server` | Local Hono server with `GET /api/project`, `POST /api/reanalyze`, `GET /api/events` (SSE). 127.0.0.1-only. |
| `@codewiz/web` | Vite + React + TS frontend. |
| `codewiz` (this) | CLI entry point that ties it all together. |

The full spec is in [`docs/superpowers/specs/`](docs/superpowers/specs/).

## Roadmap

- **v0.1** (current) — TypeScript/JavaScript only, Architecture + Files views.
- **v0.2** — Python adapter, Dependencies view.
- **v0.3** — Contracts view with cross-language bridging (TS apiClient ↔ FastAPI routes).
- **v0.4** — Functional flow + Data flow views, optional LLM enrichment (BYOK).
- **v0.5** — File-watch incremental mode.
- **v1.0** — Plugin SDK declared stable; community language adapters welcomed.
- **post-v1** — C/C++ adapter (clang-based).

## License

[MIT](LICENSE) — Copyright (c) 2026 codeWizualizer contributors.
````

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "docs: add README"
```

---

## Task 3: LICENSE (MIT)

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Write the LICENSE**

Create `LICENSE` at the repo root:
```
MIT License

Copyright (c) 2026 codeWizualizer contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

- [ ] **Step 2: Add `license` field to publishable package.json files**

Add `"license": "MIT"` after `"version"` in each of:
- `packages/cli/package.json`
- `packages/sdk/package.json`
- `packages/core/package.json`
- `packages/server/package.json`
- `packages/adapters/ts/package.json`

Do NOT add to `packages/web/package.json` (it's `private: true`).

- [ ] **Step 3: Commit**

```
git add LICENSE packages/cli/package.json packages/sdk/package.json packages/core/package.json packages/server/package.json packages/adapters/ts/package.json
git commit -m "docs: add MIT LICENSE + license field on publishable packages"
```

---

## Task 4: Changesets setup + initial v0.1.0 changeset

**Files:**
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`
- Create: `.changeset/initial-v01.md`
- Modify: `package.json` (add changeset scripts + devDep)

- [ ] **Step 1: Add `@changesets/cli` to workspace root**

```
source ~/.nvm/nvm.sh && nvm use 24
pnpm add -Dw @changesets/cli
```

- [ ] **Step 2: Initialize Changesets**

```
pnpm exec changeset init
```

This creates `.changeset/config.json` and `.changeset/README.md`. Then edit `.changeset/config.json` to:
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [
    [
      "codewiz",
      "@codewiz/sdk",
      "@codewiz/core",
      "@codewiz/server",
      "@codewiz/adapter-ts"
    ]
  ],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@codewiz/web", "@codewiz/tests"]
}
```

Key choices:
- All five publishable packages are **fixed** (lockstep versioning) so they always release at the same version (v0.1.0 across the board). `linked` would let them drift on different bump types; `fixed` is stricter and matches the spec's "single product, multiple packages" intent.
- `@codewiz/web` and `@codewiz/tests` are ignored (private; never publish).
- `access: public` so npm publishes them without a paid private-package plan.
- `baseBranch: main` so `pnpm changeset status` compares against main.

**IMPORTANT — Pre-flight: verify the package names are publishable on npm.**

Before proceeding, run:
```
for name in codewiz @codewiz/sdk @codewiz/core @codewiz/server @codewiz/adapter-ts; do
  echo -n "$name: "
  if npm view "$name" name 2>/dev/null >/dev/null; then
    echo "ALREADY EXISTS — needs rename or scope change"
  else
    echo "available"
  fi
done
```

If `codewiz` (unscoped) is taken: rename CLI to `@rhagan9202/codewiz` (or another available scope you own). If the `@codewiz` scope is taken or you don't own it: rename all five packages to use a scope you DO own (e.g. `@rhagan9202/codewiz-sdk`, `@rhagan9202/codewiz-core`, etc., and CLI to `@rhagan9202/codewiz`).

If renaming is required, do it BEFORE Step 4 below (the changeset references the package names by string and won't work if they're renamed afterward). Update:
- The `name` field in each affected `package.json`
- Workspace dep references (`"@codewiz/sdk": "workspace:*"` → `"@rhagan9202/codewiz-sdk": "workspace:*"`)
- Imports in source code (`from "@codewiz/sdk"` → `from "@rhagan9202/codewiz-sdk"`)
- This Changesets config's `fixed` and `ignore` arrays
- The README's package table
- Run `pnpm install` to refresh the lockfile

If you have to rename, report DONE_WITH_CONCERNS and surface the new name mapping in the report so subsequent tasks reference the right names.

- [ ] **Step 3: Add changeset scripts to root `package.json`**

Add to root `package.json`'s `scripts` block:
```json
"changeset": "changeset",
"version-packages": "changeset version",
"release": "pnpm -r build && changeset publish"
```

- [ ] **Step 4: Create the initial v0.1.0 changeset**

`.changeset/initial-v01.md`:
```markdown
---
"codewiz": minor
"@codewiz/sdk": minor
"@codewiz/core": minor
"@codewiz/server": minor
"@codewiz/adapter-ts": minor
---

Initial v0.1 release: codeWizualizer walking-skeleton analyzer-CLI + web UI.

- `@codewiz/sdk`: wire-format Zod schemas (Provenance, Module, Edge, Contract, Flow, Manifest, Project) + `LanguageAdapter` interface + conformance harness.
- `@codewiz/core`: walker, adapter registry, aggregator, bridge resolver, annotations parser/applier, atomic persister with content-hash manifest, `runAnalysis` pipeline.
- `@codewiz/adapter-ts`: in-process TypeScript/JavaScript adapter via ts-morph. Module, import-edge, HTTP-endpoint, and contract extraction.
- `@codewiz/server`: Hono server with `GET /api/project`, `POST /api/reanalyze`, `GET /api/events` (SSE), static file serving (path-traversal contained), and `listen()` helper.
- `codewiz`: CLI entry with `init | analyze | serve | doctor` subcommands. Web bundle embedded into dist/ for npm distribution.

End-to-end: `npx codewiz serve <repo>` analyzes a TS/JS project and renders Architecture + Files views in the browser at 127.0.0.1.
```

`minor` (not `major`) because we're going from `0.0.1` → `0.1.0`. Changesets treats `0.x` semver as: `minor` = breaking-feature, `patch` = bugfix.

- [ ] **Step 5: Verify Changesets sees the changeset**

```
pnpm exec changeset status
```
Expected output: lists the 5 packages each going to `0.1.0`.

- [ ] **Step 6: Commit**

```
git add .changeset/ package.json pnpm-lock.yaml
git commit -m "chore: setup Changesets + initial v0.1.0 changeset"
```

---

## Task 5: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    name: Build + test (Node ${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: ["24"]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm -r build

      - name: Run unit + integration tests
        run: pnpm test

      - name: Install Playwright browser
        run: pnpm --filter @codewiz/tests exec playwright install --with-deps chromium

      - name: Run Playwright e2e
        run: pnpm --filter @codewiz/tests test:e2e

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: tests/playwright-report/
          retention-days: 7
```

Key choices:
- Pinned `pnpm@9.15.0` (matches root `packageManager` field).
- Node 24 only (matrix kept open for future versions).
- `--frozen-lockfile` enforces lockfile integrity.
- Playwright browser install uses `--with-deps` so Linux system libraries (chromium needs them) are pulled too.
- On e2e failure, the `playwright-report/` artifact is uploaded for debugging.

- [ ] **Step 2: Commit**

```
git add .github/
git commit -m "ci: GitHub Actions workflow for build + test + e2e on PR/main"
```

- [ ] **Step 3: Push the branch and verify CI runs**

(The actual push happens in Task 7; for this step, just confirm the workflow file is syntactically valid.)

```
yamllint .github/workflows/ci.yml || true
```

If `yamllint` isn't installed, skip — GitHub will validate on push. The structure follows the official Actions YAML spec.

---

## Task 6: GitHub Actions release workflow + NPM_TOKEN docs

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `README.md` (add Releasing section)

- [ ] **Step 1: Create the release workflow**

`.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    branches: [main]

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    name: Version + publish
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: "pnpm"
          registry-url: "https://registry.npmjs.org"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm -r build

      - name: Create release PR or publish
        uses: changesets/action@v1
        with:
          version: pnpm version-packages
          publish: pnpm release
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

How this workflow behaves:
1. On every push to main, run `changesets/action@v1`.
2. If there are unconsumed `.changeset/*.md` files, the action opens (or updates) a PR titled "chore: version packages" that consumes them, bumps versions, and writes `CHANGELOG.md`.
3. When that "Version Packages" PR is merged into main, the next workflow run finds no pending changesets and instead runs `pnpm release` (which builds + publishes).
4. `id-token: write` enables npm provenance attestations (the `--provenance` flag, which `pnpm publish` honors automatically when run via Actions).

- [ ] **Step 2: Add a "Releasing" section to README.md**

Append to `README.md`:
```markdown

## Releasing

This project uses [Changesets](https://github.com/changesets/changesets) for versioning.

1. Make changes on a feature branch.
2. Run `pnpm changeset` to add a changeset entry describing the change (`patch` / `minor` / `major`).
3. Open a PR. CI runs build + tests + Playwright e2e.
4. After PR merges to `main`, the **Release** workflow opens a "chore: version packages" PR that consumes pending changesets, bumps versions, and writes `CHANGELOG.md`.
5. Merging that PR triggers `pnpm release`, which builds and publishes to npm with provenance.

### One-time setup (maintainer)

The release workflow requires an `NPM_TOKEN` repo secret with publish access to the `codewiz` and `@codewiz/*` packages.

1. Create an automation token at https://www.npmjs.com/settings/<your-username>/tokens (type: **Automation**).
2. Add it to the repo secrets at `https://github.com/<owner>/codewiz/settings/secrets/actions` named `NPM_TOKEN`.
```

- [ ] **Step 3: Commit**

```
git add .github/workflows/release.yml README.md
git commit -m "ci: release workflow via changesets/action + npm publish"
```

---

## Task 7: Final verification + tag v0.1.0 + push

This task does NOT publish to npm. Publishing happens automatically when the user merges the auto-opened "Version Packages" PR after this branch lands on main. We just verify everything builds, tag the milestone, and push.

- [ ] **Step 1: Clean rebuild + full test suite + e2e**

```
source ~/.nvm/nvm.sh && nvm use 24
pnpm -r exec rm -rf dist
rm -rf node_modules packages/*/node_modules packages/adapters/*/node_modules tests/node_modules packages/web/node_modules packages/server/node_modules
pnpm install
pnpm -r build
pnpm test
pnpm --filter @codewiz/tests test:e2e
```

Expected:
- All packages build, including `packages/cli/dist/web/` containing the embedded bundle.
- All vitest packages green (~112 tests).
- Playwright: 4 e2e pass.

- [ ] **Step 2: Verify the embedded-web smoke**

```
node packages/cli/dist/bin.js serve tests/fixtures/tiny-react-app --port 8771 --no-open &
sleep 3
curl -sS -o /dev/null -w "html: %{http_code}\n" http://127.0.0.1:8771/
curl -sS http://127.0.0.1:8771/api/project | python3 -c 'import sys, json; p=json.load(sys.stdin); print("modules:", len(p["modules"]), "edges:", len(p["edges"]), "contracts:", len(p["contracts"]))'
kill %1 2>/dev/null
wait %1 2>/dev/null
rm -rf tests/fixtures/tiny-react-app/.codewiz/
```

Expected: `html: 200`, `modules: 5 edges: 5 contracts: 1`.

- [ ] **Step 3: Verify Changesets is in a publish-ready state**

```
pnpm exec changeset status
```

Expected: lists the initial-v01 changeset and shows the 5 packages each going to `0.1.0`.

- [ ] **Step 4: Tag the milestone**

```
git tag -a v0.1.0-release-ready -m "v0.1 release plumbing: web bundle embedded, README/LICENSE, Changesets, CI + release workflows ready"
```

Note: We tag `v0.1.0-release-ready`, not `v0.1.0`, because the Changesets release workflow will bump versions and `pnpm release` will create the actual `v0.1.0` release on npm. The `v0.1.0` git tag is created by Changesets, not by hand.

- [ ] **Step 5: Push branch + tag**

```
git push -u origin feat/v0.1-release
git push origin v0.1.0-release-ready
```

- [ ] **Step 6: Open the PR**

```
gh pr create --base feat/v0.1-web-ui --head feat/v0.1-release \
  --title "v0.1 release plumbing: embed web bundle, README/LICENSE, Changesets, CI" \
  --body "$(cat <<'EOF'
## Summary

Stacks on #2 (Plan 2 web UI). After this PR + #1 + #2 all merge to main, the Changesets release workflow opens a "chore: version packages" PR; merging that publishes v0.1.0 to npm.

- **Embed web bundle in CLI** — `packages/cli/scripts/copy-web-bundle.mjs` copies `@codewiz/web/dist/` into `packages/cli/dist/web/` before tsc. `serve.ts` resolves the bundle relative to its own location via `import.meta.url` instead of `require.resolve("@codewiz/web")`. `@codewiz/web` moved from runtime to devDep so the published `codewiz` package has no broken `private: true` dependency.
- **README** — install / quick start / `.codewiz.yml` / subcommand reference / architecture overview / roadmap.
- **LICENSE** — MIT. `license: "MIT"` field added to the five publishable packages.
- **Changesets** — `.changeset/config.json` linking the five publishable packages, `@codewiz/web` and `@codewiz/tests` ignored. Initial `initial-v01.md` changeset for the v0.1.0 minor bump.
- **CI workflow** — build + vitest + Playwright e2e on every push and PR. Uploads Playwright report on failure.
- **Release workflow** — `changesets/action@v1` opens a "version packages" PR; merging it triggers `pnpm release` (build + publish with provenance).

## Test Plan

- [x] `pnpm test` — all packages green (~112 vitest tests)
- [x] `pnpm --filter @codewiz/tests test:e2e` — 4 Playwright tests pass
- [x] `node packages/cli/dist/bin.js serve tests/fixtures/tiny-react-app --no-open` — works with the embedded web bundle (no workspace symlink dependency)
- [x] `pnpm exec changeset status` — reports initial-v01 changeset, 5 packages → 0.1.0
- [x] CI workflow YAML validates structurally

## Maintainer setup before first release

The release workflow needs an `NPM_TOKEN` repo secret. See README's "Releasing > One-time setup".

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If the predecessor PRs (#1, #2) have not yet been merged, the base for this PR is `feat/v0.1-web-ui`. Once Plan 2's PR (#2) merges, GitHub auto-rebases this PR's base to `main`. If that doesn't happen automatically, the human can re-base manually.
