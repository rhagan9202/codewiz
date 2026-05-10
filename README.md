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
