# @codewiz/server

## 0.1.0

### Minor Changes

- aa0130e: Initial v0.1 release: codeWizualizer walking-skeleton analyzer-CLI + web UI.
  - `@codewiz/sdk`: wire-format Zod schemas (Provenance, Module, Edge, Contract, Flow, Manifest, Project) + `LanguageAdapter` interface + conformance harness.
  - `@codewiz/core`: walker, adapter registry, aggregator, bridge resolver, annotations parser/applier, atomic persister with content-hash manifest, `runAnalysis` pipeline.
  - `@codewiz/adapter-ts`: in-process TypeScript/JavaScript adapter via ts-morph. Module, import-edge, HTTP-endpoint, and contract extraction.
  - `@codewiz/server`: Hono server with `GET /api/project`, `POST /api/reanalyze`, `GET /api/events` (SSE), static file serving (path-traversal contained), and `listen()` helper.
  - `codewiz`: CLI entry with `init | analyze | serve | doctor` subcommands. Web bundle embedded into dist/ for npm distribution.

  End-to-end: `npx codewiz serve <repo>` analyzes a TS/JS project and renders Architecture + Files views in the browser at 127.0.0.1.

### Patch Changes

- Updated dependencies [aa0130e]
  - @codewiz/sdk@0.1.0
  - @codewiz/core@0.1.0
  - @codewiz/adapter-ts@0.1.0
