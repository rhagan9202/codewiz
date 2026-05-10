# codeWizualizer — Production Design

**Status:** approved (brainstorming complete, ready for implementation plan)
**Date:** 2026-05-10
**Predecessor:** the prototype in `codeWizualizer.html` and its sibling files at the repo root.

## 1. Overview

codeWizualizer is a codebase-understanding tool that maps a repository into six views — Architecture overview, Dependencies, Functional flow, Data flow, Contracts, Files — and surfaces the cross-cutting story (who imports what, where data shape mismatches across language boundaries, where a user action becomes a database write).

The current `codeWizualizer.html` prototype runs entirely against curated mock data via React-from-CDN with Babel-in-browser. This spec describes the production version: a real, self-hosted, open-source CLI + local web app that analyzes real repositories accurately, with first-class support for **TypeScript / JavaScript and Python** at launch and a plugin SDK that lets the community add more languages without forking core. C/C++ support is post-v1.

The user's primary motivating use case is a **React/TypeScript frontend with a FastAPI Python backend** — both halves must be analyzed at full fidelity, not as syntactic-only second-class citizens.

## 2. Goals and non-goals

### Goals (v1)
- Accurate static analysis of TS/JS and Python repositories using each language's best-in-class tools (`ts-morph`, `libcst`+`jedi`).
- Cross-language understanding: a TS `apiClient.post('/cart/items')` call connects to its FastAPI `@router.post('/cart/items')` handler, and contract diffs span both sides.
- All six prototype views work on real code by v0.5.
- Honest provenance: every datum in the UI is tagged `static | annotation | bridge | llm` so users always know what's a fact vs. what's a guess.
- Hybrid override layers: pure static analysis is the floor, `.codewiz.yml` annotations override anything, optional LLM (Bring Your Own Key — BYOK) fills semantic gaps.
- Distributed via `npx codewiz`, single Node runtime requirement (Python only required for analyzing Python repos).
- A stable plugin SDK published from day one and validated by the v0.2 Python adapter before any external contributors arrive.

### Non-goals (v1)
- Multi-tenant SaaS, hosted product, billing, or sign-up.
- Auth (binds to `127.0.0.1` only).
- Persistent daemon mode / Docker-compose deployment.
- C/C++ language adapter (post-v1).
- LLM integration in v0.1 (arrives in v0.4).
- File-watch incremental analysis (v0.5+).
- SQLite / Postgres storage (filesystem JSON only).

### Non-goals (forever, unless re-scoped)
- Replacing IDE features. codeWizualizer is for *understanding the whole*, not editing.
- Hosting analyses for other people. Self-hosted means *self-hosted*.

## 3. Brainstorming decisions

These are the choices that shaped the rest of this document. Listed here so future readers don't have to re-derive them.

| Question | Decision |
|---|---|
| Audience and distribution | Open-source self-hosted. Optional auth, sensible defaults, published to npm + GitHub. |
| Analysis depth | Hybrid: static analysis as the floor, `.codewiz.yml` annotations override, optional LLM (BYOK) fills gaps. |
| Languages at launch | TypeScript, JavaScript, Python. Plugin SDK from day one for community language adapters. C/C++ post-v1. |
| Distribution / runtime form | CLI plus a local web server invoked on demand. No daemon, no Docker required. |
| MVP cut for v0.1 | Walking skeleton — Architecture + Files views end-to-end on TS/JS, with the full pipeline (CLI, server, parser, storage, plugin loader) wired up. Other views populate in v0.2–v0.4. Python adapter in v0.2. |
| Architecture approach | Approach A′ — Node/TypeScript orchestrator with long-running language workers. The worker protocol *is* the plugin SDK. TS/JS adapter is in-process (shared `ts.Program` state); Python adapter is a long-running subprocess speaking JSON-RPC. |

## 4. Overall architecture

```
┌─────────────────────────────────────────────────────────────┐
│  codewiz orchestrator (Node/TS)                             │
│  ┌──────────┐  ┌─────────────┐  ┌────────┐  ┌────────────┐  │
│  │  CLI     │  │  Analysis   │  │  Web   │  │  LLM       │  │
│  │ entry    │──│  pipeline   │──│ server │  │ broker     │  │
│  │          │  │  (TS in-    │  │ (Hono) │  │ (AI SDK)   │  │
│  │          │  │   process)  │  │        │  │            │  │
│  └──────────┘  └──────┬──────┘  └────┬───┘  └─────┬──────┘  │
│                       │              │             │         │
│                       │ JSON-RPC     │ HTTP/SSE    │ HTTPS   │
└───────────────────────┼──────────────┼─────────────┼─────────┘
                        │              │             │
            ┌───────────┴──────┐       │             │
            ▼                  ▼       ▼             ▼
      ┌──────────┐       ┌──────────┐ ┌─────────┐ ┌──────────┐
      │ Python   │       │ C/C++    │ │ Browser │ │ Anthropic│
      │ worker   │       │ worker   │ │ (React) │ │ /OpenAI/ │
      │ (libcst+ │       │ (post-v1)│ │         │ │ local    │
      │  jedi)   │       │          │ │         │ │          │
      └──────────┘       └──────────┘ └─────────┘ └──────────┘
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │ ./.codewiz/  │ ← FS storage
                                  │ (JSON files) │
                                  └──────────────┘
```

**Top-level shape.**
- The **orchestrator** is the only process that talks to the user (CLI), the browser (web server), and the LLM. It owns the unified data model and the cache.
- **Language workers** are dumb servants. The protocol is request/response (orchestrator asks, worker answers). TS/JS is a special case — in-process Node module so it can share `ts.Program` state cheaply — but it implements the *same* `LanguageAdapter` interface as out-of-process workers, so swapping it for a subprocess is mechanical.
- The **LLM broker** is a single chokepoint. Every LLM call goes through it for provider abstraction (Vercel AI SDK), provenance stamping, spend caps, and content-hash caching.
- **Storage** is plain JSON files in `./.codewiz/`. The browser fetches static-served JSON; the orchestrator regenerates files on re-analysis.

## 5. Component map

### Orchestrator core (`packages/core/`)
- **Walker** — filesystem traversal, `.gitignore`-aware, classifies files by extension to route to the right adapter.
- **Adapter loader** — resolves built-in or plugin adapters, starts in-process or subprocess workers, holds them open for the analysis run.
- **Aggregator** — collects per-adapter results, normalizes IDs, merges into one project graph.
- **Bridge resolver** — runs after aggregation; matches cross-language edges (TS `apiClient.post('/x')` ↔ FastAPI `@router.post('/x')`) by HTTP verb + path. Emits edges with `source: "bridge"` and a confidence score.
- **Annotations applier** — loads `.codewiz.yml`, applies overrides last so they always win.
- **LLM enricher** — optional pass; calls the broker to derive functional flows, layer hints, semantic contract diffs. Skipped entirely if no provider is configured.
- **Persister** — writes `./.codewiz/{modules,edges,contracts,flows,manifest,diagnostics}.json` atomically.

### CLI (`packages/cli/`)
Thin Commander wrapper. Subcommands:
- `codewiz init` — drops a starter `.codewiz.yml`, optionally adds `.codewiz/` to `.gitignore`.
- `codewiz analyze [path]` — runs the pipeline, writes JSON.
- `codewiz serve [path]` — runs analyze (if needed), starts the web server, opens the browser.
- `codewiz watch [path]` — `serve` + file-watch incremental re-analysis (v0.5+).
- `codewiz doctor` — verifies environment, declared adapters' `initialize` succeeds, and the LLM provider (if configured) is reachable.

### Web server (`packages/server/`)
Hono. Serves the built React app from `dist/`. Endpoints:
- `GET /api/project` → the unified data bundle.
- `POST /api/reanalyze` → kicks off a fresh run, returns a job ID.
- `GET /api/events` → SSE stream of live diagnostic logs during re-analysis.

No auth in v0.1. Binds to `127.0.0.1` only.

### Language adapters (`packages/adapters/`)
- `adapter-ts/` — in-process Node module, `ts-morph`. Reference implementation of the worker protocol.
- `adapter-python/` — Python subprocess (`libcst` + `jedi`), JSON-RPC over stdio, lazily started. Arrives v0.2.
- Future `adapter-cpp/` and community plugins live as separate npm packages following the same SDK.

### LLM broker (`packages/llm/`)
Single facade over Vercel AI SDK. Owns:
- Provenance stamping (every result tagged with model + prompt-hash + confidence + citations).
- Content-hash cache so re-running analysis on unchanged code costs zero.
- Per-run dollar cap (`--llm-budget $0.50` default) and a daily cap persisted at `~/.codewiz/spend.json`.
- A `--dry-run` mode returning deterministic synthetic LLM results so the rest of the pipeline can be tested without keys.

### Frontend (`packages/web/`)
Vite + React + TypeScript. Ports every prototype component (`app`, `views`, `graph`, `picker`, `tweaks-panel`) off CDN React + Babel-in-browser. Same look, real `fetch('/api/project')` instead of mock data. Adds two production-only UI affordances:
- A **provenance badge** on every datum, with a popover showing the source (static / annotation / bridge / llm), confidence, and citations.
- A **re-analyze button** wired to the SSE endpoint for live progress.

### Plugin SDK (`packages/sdk/`)
The public extensibility surface — TypeScript types, Zod schemas for the wire format, a `createWorker()` helper for subprocess adapters, a Python worker reference template, and a conformance harness that validates any adapter. Specified in §7.

## 6. Data model and provenance

The unified shape every adapter outputs and the persister writes. Three keys to the design: every datum is **provenance-tagged**, every inferred datum carries **confidence** and a **source citation**, and IDs are **stable across languages**.

```ts
type Provenance =
  | { source: "static" }                                  // parser fact
  | { source: "annotation"; file: string; line: number }  // .codewiz.yml override
  | { source: "bridge"; confidence: number }              // cross-language inference
  | { source: "llm"; model: string; promptHash: string;
                     confidence: number; citations: SourceRef[] };

type SourceRef = { path: string; line: number; col?: number };

type Module = {
  id: string;          // "<adapter>:<repo-relative-path>" — globally unique
  name: string;
  path: string;        // repo-relative
  language: "ts" | "js" | "py" | string;
  layer:   { value: LayerKey; provenance: Provenance };
  team?:   { value: string;   provenance: Provenance };
  domain?: { value: string;   provenance: Provenance };
  kind: "page" | "component" | "hook" | "store" | "client"
      | "route" | "service" | "middleware" | "model" | "external";
  loc: number;
  health?: { score: number; reasons: string[] };  // computed, post-MVP
  annotation?: "err" | "warn" | "new" | "dup";
  notes?: string;
  citations: SourceRef[];   // where this module is defined / spans
};

type Edge = {
  source: string;             // Module.id
  target: string;             // Module.id
  kind: "imports" | "calls" | "http" | "data";
  provenance: Provenance;     // bridge edges carry confidence
  evidence?: SourceRef[];     // where the edge was observed
};

type Contract = {
  id: string;
  name: string;
  language: string;           // owning language; consumers may be other langs
  fields: { name: string; type: string; required: boolean;
            provenance: Provenance }[];
  producers: string[];        // Module.ids
  consumers: string[];        // Module.ids
  issues: ContractIssue[];
  related: string[];          // contract ids
  citations: SourceRef[];
};

type ContractIssue = {
  kind: "missing" | "shape" | "extra";
  field: string;
  consumer: string; producer: string;
  expected: SchemaShape;      // { name, type, required, source, snippet }
  actual:   SchemaShape;
  provenance: Provenance;     // structural issues from `bridge`,
                              // semantic issues from `llm` — UI distinguishes
};

type Flow = {
  id: string; name: string; desc: string;
  kind: "functional" | "data";
  health: "ok" | "warn" | "err";
  steps: { mod: string; action: string; payload?: unknown;
           contract?: string; warn?: boolean;
           provenance: Provenance }[];   // per-step, since LLM may infer
};
```

A **manifest** (`./.codewiz/manifest.json`) records: repo URL, commit, branch, run timestamp, adapter versions, LLM provider/model used, total spend, `lastSuccessful` timestamp, and a content hash so the frontend can detect stale data.

**ID strategy.** Adapter-namespaced: `ts:web/src/pages/Cart.tsx`, `py:api/routes/cart.py`. Bridge edges connect across namespaces. No collisions even if two adapters see the same path.

**Why per-field provenance on contracts.** Mixed-language contracts (TS apiClient ↔ FastAPI Pydantic model) get fields from two parsers; per-field tagging is what makes the diff view honest about which side knew what.

## 7. Plugin SDK / worker protocol

Both in-process (TS) and subprocess (Python+) adapters speak the same interface. The wire format is **JSON-RPC 2.0 over stdio** for subprocess workers; in-process adapters implement the matching TypeScript interface directly. **No method drift between transport modes.**

```ts
// packages/sdk/src/index.ts
export interface LanguageAdapter {
  initialize(req: InitRequest): Promise<InitResponse>;
  analyze(req: AnalyzeRequest): Promise<AnalyzeResponse>;
  shutdown(): Promise<void>;
}

interface InitRequest {
  projectRoot: string;
  adapterOptions?: Record<string, unknown>;  // from .codewiz.yml
  protocolVersion: 1;
}

interface InitResponse {
  adapterName: string;          // e.g. "@codewiz/adapter-python"
  adapterVersion: string;
  protocolVersion: 1;
  capabilities: Capability[];
  fileGlobs: string[];          // files this adapter claims (e.g. ["**/*.py"])
}

type Capability =
  | "modules" | "edges-imports" | "edges-calls"
  | "contracts" | "http-endpoints" | "type-references";

interface AnalyzeRequest { files: string[]; }  // pre-filtered by the walker

interface AnalyzeResponse {
  modules:       Module[];
  edges:         Edge[];          // intra-language only
  contracts:     Contract[];
  httpEndpoints: HttpEndpoint[];  // bridge resolver consumes these
  diagnostics:   Diagnostic[];
}

interface HttpEndpoint {
  side: "client" | "server";      // apiClient.post vs FastAPI route
  verb: "GET"|"POST"|"PUT"|"DELETE"|"PATCH";
  pathTemplate: string;           // "/cart/items/:id" — normalized
  module: string;                 // owning Module.id
  citation: SourceRef;
  requestType?: string;           // contract id if known
  responseType?: string;
}

interface Diagnostic {
  level: "info" | "warn" | "error";
  message: string;
  file?: string; line?: number;
}
```

**Lifecycle.** `initialize` once per analysis run → `analyze` once with the file list → `shutdown` (subprocess workers also exit on stdin EOF as a safety net).

**Discovery.** Built-in adapters resolve from `packages/adapters/`. Plugin adapters resolve from npm via a `package.json#codewizAdapter` field — simple convention, no plugin manager needed. The CLI's `doctor` subcommand verifies each declared adapter's `initialize` succeeds.

**Subprocess wrapping.** `packages/sdk/src/runtime/python-worker.py` ships a reference Python harness so a plugin author writes only the analyzer logic, not the JSON-RPC plumbing. Same idea for future C/C++ via a thin C harness.

**Why bulk `analyze` and not per-file streaming for v0.1.** Walking-skeleton scope. Streaming buys file-watch incremental mode later; the protocol can add an `analyzeIncremental(changedFiles, sessionId)` method behind a capability flag without breaking v1 adapters. Reserved for v0.5+.

**Errors.** A worker that crashes during `analyze` is restarted once. If it crashes again on `initialize` or `analyze`, that adapter is dropped for the run; its claimed files appear in the UI flagged as `analyzer-failed` rather than disappearing silently. The diagnostic stream surfaces the stack trace.

## 8. Annotations and LLM

Two override layers above static analysis. Both feed the same provenance pipeline so the UI can always show *who said what*.

### `.codewiz.yml`

Opt-in, repo root, hot-reloaded in `serve` mode. Schema validated by Zod with friendly path-pointed errors.

```yaml
# Layer / team / domain assignment, glob-based or per-file.
classify:
  rules:
    - pattern: "web/src/pages/**/*.tsx"
      layer: ui
      team: web
      domain: catalog          # default; per-file overrides below
    - pattern: "api/services/**/*.py"
      layer: service
      team: platform
  pin:
    "web/src/components/Header.tsx": { domain: core }

# Manually authored flows (entry point + steps).
# These are first-class — no LLM needed for them to work.
flows:
  - id: f_buy
    name: "Customer purchases item"
    kind: functional
    entry: "web/src/pages/Product.tsx::onAddToCart"
    steps:
      - { mod: "ts:web/src/hooks/useCart.ts", action: "Optimistic update" }
      - { mod: "ts:web/src/api/client.ts",    action: "POST /cart/items" }
      - { mod: "py:api/routes/cart.py",       action: "validate + persist" }

# Cross-language contract bindings the bridge resolver couldn't infer.
contracts:
  bind:
    - ts:    "web/src/types/CartItem.ts::CartItem"
      py:    "api/models/cart.py::CartItemModel"
      relation: equivalent      # or: subset | superset

# Bridge edge pins for ambiguous HTTP routing.
bridges:
  - client: "ts:web/src/api/client.ts::postCartItem"
    server: "py:api/routes/cart.py::add_item"

# Suppressions / annotations.
review:
  - { path: "api/services/CartService.py", level: warn,
      note: "Stale-cache bug found 2026-05-08" }
exclude:
  - "**/__generated__/**"
  - "tests/**"
```

### LLM broker

Single facade over **Vercel AI SDK**, BYOK. Provider strings (`anthropic/claude-sonnet-4-6`, `openai/gpt-4o`, `ollama/llama3.2`) configured via env or `.codewiz.yml#llm`. Skipped entirely if unconfigured — every view that *can* fall back to static-only does.

What the LLM is allowed to do (and only this):
1. **Layer classification** for files where no annotation matched and the heuristic confidence is low (`< 0.6`).
2. **Semantic contract diffs** beyond structural (e.g. "consumer treats `role: string` but producer emits the literal `'admin'|'user'` union; cosmetic but worth flagging.").
3. **Functional flow scaffolding** (v0.4) — given an entry point, propose a step list the user can edit into `.codewiz.yml#flows`.
4. **Per-module summaries** for the passport panel hover (v0.4+).

Hard constraints:
- Every LLM output is **stamped with model + prompt-hash + confidence + source citations**, persisted alongside its input hash. The frontend renders LLM-derived data with a visible `LLM` badge and a popover showing its citations and confidence.
- **Cache** is keyed by `(promptTemplateHash, inputContentHash)` — re-runs cost zero on unchanged code.
- **Spend caps**: per-run cap (`--llm-budget $0.50` default), daily cap (`~/.codewiz/spend.json`), and a `--dry-run` mode that returns deterministic synthetic LLM results so the rest of the pipeline can be tested without keys or money.
- **Annotations always win.** If `.codewiz.yml` pins a layer, the LLM is never asked about it.

## 9. Storage, error handling, testing

### Storage layout

```
./.codewiz/
├── manifest.json          # repo url, commit, branch, run timestamp,
│                          # adapter versions, llm provider+model,
│                          # data-content hash (frontend stale-check),
│                          # lastSuccessful timestamp
├── modules.json
├── edges.json
├── contracts.json
├── flows.json
├── diagnostics.json       # parse errors, skipped files, worker crashes
└── cache/
    ├── parse/             # per-file parsed-AST cache, keyed by content hash
    ├── llm/               # keyed by (promptTemplateHash, inputContentHash)
    └── bridge/            # cross-language match table
```

Writes are atomic (temp file + rename, never a half-written `modules.json`). The CLI's `init` subcommand offers to add `.codewiz/` to `.gitignore` (recommended default) or commit it (for sharing snapshots in PRs).

### Error handling

| Failure | Behavior |
|---|---|
| Single-file parse error | Diagnostic emitted; file appears in UI with a `parse-error` badge; downstream views render around it. Run still succeeds. |
| Worker process crash | Restart once. If it crashes again on `initialize` or `analyze`, the adapter is dropped for the run; its claimed files appear as `analyzer-failed`. Run still succeeds (degraded). The diagnostic stream surfaces the stack trace. |
| Invalid `.codewiz.yml` | Fail fast before any worker starts. Zod error rendered with file:line:col and the exact JSON path. No partial run, no silent ignore. |
| LLM provider error / timeout | Skip enrichment for that input, continue, log to diagnostics, do not retry within the run (no spend surprises). UI shows the un-enriched view; user can re-run with `--llm-retry`. |
| Bridge resolver ambiguity | Emit all candidate edges with `confidence < 1`, surface as a "needs annotation" hint in the Contracts view. |
| Web server | Serves stale data from `./.codewiz/` even if the most recent re-analyze failed; manifest's `lastSuccessful` field tells the UI when. SSE disconnects close cleanly. |
| File-watch (post-MVP) | Debounced 300ms; re-analyze only changed files + their dependents (per the import graph from the previous run). If incremental fails, fall back to full re-analyze. |

### Testing

- **Unit tests** per package — `vitest` for TS packages, `pytest` for the Python adapter.
- **Golden-file integration tests** — fixture repos under `tests/fixtures/` (`tiny-react-app/`, `tiny-fastapi/`, `mixed-stack/`). Assert exact `modules.json` / `edges.json` / `contracts.json` output. Snapshots regenerated by `pnpm test:update-golden` only on intentional schema changes — never auto-updated on diff.
- **Adapter conformance suite** — `packages/sdk/conformance/` runs every adapter (built-in or plugin) against a canonical fixture set and asserts protocol compliance: capabilities are honest, IDs are stable across runs, citations resolve, no duplicate edges. The Python adapter's first job is to pass this suite; same for any community language adapter.
- **LLM in tests** uses `--dry-run` (deterministic synthetic responses). Real-LLM tests are gated behind `RUN_LLM_TESTS=1` and skipped in CI; a small set runs nightly.
- **Frontend** — component tests via Vitest + Testing Library on the prototype's components, plus one Playwright smoke test that runs `analyze` on `tiny-react-app` and verifies the Architecture view loads with the expected node count. No broader e2e in v0.1.
- **CI** — GitHub Actions. Single `pnpm test` job for the JS side; separate matrix job for the Python adapter once it lands in v0.2.

## 10. v0.1 scope — the walking skeleton

**Ships.**
- **CLI**: `codewiz init | analyze | serve | doctor`.
- **Orchestrator core** with the pipeline stages wired (walker → adapter loader → aggregator → bridge resolver → annotations applier → persister). The LLM enricher slot exists in the pipeline so v0.4 can drop in without restructuring, but **no LLM passes are implemented in v0.1** — calling the slot is a no-op.
- **TS/JS adapter** in-process, `ts-morph`-based, full fidelity for imports + interfaces. Reference implementation of the worker protocol.
- **Plugin SDK** published as `@codewiz/sdk`. Stable from day one — Python adapter in v0.2 is the proof.
- **Web server** (Hono) and **frontend** (Vite + React) — prototype components ported off CDN React, real `fetch('/api/project')`, plus the production-only **provenance badge** and **re-analyze button**.
- **Two views populated end-to-end**: Architecture overview, Files (with annotations + source preview). The other four nav items appear, disabled, with a "ships in v0.x" tooltip.
- **Storage**: `./.codewiz/` JSON layout + atomic writes + manifest with content hash.
- **Annotations**: `.codewiz.yml` parser shipped, with **only** the `classify`, `review`, and `exclude` sections wired into the pipeline. The `flows`, `contracts.bind`, and `bridges` sections parse without erroring (forward-compatibility) but emit a `not-yet-supported` warning to diagnostics until the views that consume them ship in v0.3–v0.4. Users can write a complete annotations file from day one and have it work as later versions land.
- **Testing**: golden-file fixtures for `tiny-react-app`, conformance suite, one Playwright smoke test.
- **Packaging**: published as `codewiz` on npm, MIT license, GitHub Actions release workflow with semver-tagged binaries.

**Explicit non-goals for v0.1.** Python adapter (v0.2). Dependencies / Contracts / Functional flow / Data flow views (v0.2–v0.4). LLM integration (v0.4). File-watch incremental mode (v0.5+). SQLite storage. Auth. Docker daemon mode. C/C++ adapter (post-v1).

### v0.1 acceptance criteria

The walking skeleton is "done" when, on a freshly-cloned repo:

1. `npx codewiz analyze .` exits 0 on `tests/fixtures/tiny-react-app/`, producing `./.codewiz/manifest.json` and `modules.json` whose contents match the golden snapshot.
2. `npx codewiz serve .` opens a browser to a working Architecture view showing the fixture's modules in their layered swimlanes, and a working Files view with selectable source preview.
3. The provenance badge appears on every module and shows `static` for everything not pinned in `.codewiz.yml`.
4. Pinning a module's layer in `.codewiz.yml` and pressing "re-analyze" updates the UI and the badge flips to `annotation` with file:line citation.
5. `npx codewiz doctor` reports the TS adapter as healthy.
6. The Playwright smoke test passes in CI.
7. The conformance suite passes against `adapter-ts`.

## 11. Repo layout

pnpm workspace monorepo, Turborepo for task orchestration:

```
codewiz/
├── packages/
│   ├── core/         # walker, aggregator, bridge resolver, annotations,
│   │                 # persister, LLM broker integration
│   ├── cli/          # commander entry; depends on core + server
│   ├── server/       # Hono app; depends on core
│   ├── sdk/          # public adapter interface, schemas, conformance
│   ├── llm/          # Vercel AI SDK facade, cache, spend caps
│   ├── adapters/
│   │   ├── ts/       # in-process, ts-morph (v0.1)
│   │   └── python/   # subprocess, libcst+jedi (v0.2)
│   └── web/          # Vite + React app (built into server's static dir)
├── tests/
│   ├── fixtures/
│   │   ├── tiny-react-app/
│   │   ├── tiny-fastapi/         # arrives with v0.2
│   │   └── mixed-stack/          # arrives with v0.3
│   └── e2e/                      # Playwright smoke test
├── docs/
│   ├── adapter-authoring.md      # how to write a language plugin
│   ├── annotations-reference.md  # .codewiz.yml schema
│   └── architecture.md           # this design doc, kept current
├── .github/workflows/            # ci, release
├── package.json                  # workspace root, pnpm
├── turbo.json
├── tsconfig.base.json
├── README.md
└── LICENSE                       # MIT
```

**Tooling.** pnpm, Turborepo, TypeScript strict mode, Vite, React 18, Hono, ts-morph, Zod, Commander, Vitest, Playwright, Vercel AI SDK. Prettier + ESLint. Conventional Commits + Changesets for releases.

## 12. Phasing roadmap

| Version | Adds | Validates |
|---|---|---|
| v0.1 | Walking skeleton — CLI, orchestrator, TS adapter, plugin SDK, web server, frontend, Architecture + Files views, annotations applier, golden fixtures, smoke test. | The pipeline works end-to-end. The SDK is real. |
| v0.2 | Python adapter (`adapter-python`), Dependencies view, `tiny-fastapi` fixture. | The plugin SDK survives a real second consumer. Cross-language IDs and adapter loading work. |
| v0.3 | Contracts view with cross-language bridging (TS apiClient ↔ FastAPI routes), `mixed-stack` fixture, annotations file format finalized for contract bindings. | Bridge resolver works on a realistic mixed-language repo. |
| v0.4 | LLM broker (Vercel AI SDK, BYOK, spend caps, content-hash cache, dry-run mode), Functional flow + Data flow views, layer-classification LLM hints. | The full LLM facade, provenance UI for `source: "llm"` data. |
| v0.5 | File-watch incremental mode (`codewiz watch`), `analyzeIncremental` capability on the worker protocol. | Streaming partial updates and incremental re-parse without breaking v1 adapters. |
| v1.0 | Plugin SDK declared stable. Adapter authoring docs polished. Community language adapters welcomed. | API stability commitment. |
| post-v1 | C/C++ adapter (clang-based), optional Docker daemon mode. | Polyglot beyond the launch trio. |

Each version is a separate spec/plan/implementation cycle. This document is the v0.1 spec and the v1.0 north-star; later versions get their own design docs as their constraints sharpen.
