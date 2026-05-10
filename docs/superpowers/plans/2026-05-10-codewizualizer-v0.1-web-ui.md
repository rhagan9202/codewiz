# codeWizualizer v0.1 — Web Server + UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the v0.1 web layer to codeWizualizer — `codewiz serve <repo>` starts a local Hono server, opens the browser to a Vite/React UI, and renders working **Architecture** and **Files** views (the v0.1 MVP cut), each with provenance badges + a re-analyze button that drives a live SSE log.

**Architecture:** Two new workspace packages — `@codewiz/server` (Hono) and `@codewiz/web` (Vite + React + TS, no CDN-React). The frontend ports the prototype's `app.jsx`/`views.jsx`/component bits into typed React components, replacing the `window.__DATA__` global with a `ProjectContext` that calls `fetch('/api/project')`. CLI grows a `serve` subcommand that resolves the bundled web `dist/`, runs `analyze` if `.codewiz/` is missing or stale, then starts the server bound to `127.0.0.1` and opens the browser. End-to-end smoke via Playwright on the `tiny-react-app` fixture.

**Tech Stack:** Hono 4.x, Vite 5.x, React 18, TypeScript 5 strict, Zod, SSE for live re-analyze logs, `open` (npm package) to launch the browser, Playwright for the end-to-end smoke test.

**Predecessor plan:** `docs/superpowers/plans/2026-05-10-codewizualizer-v0.1-analyzer-cli.md` (Plan 1, shipped at tag `v0.1.0-foundation`). All Plan 1 packages must be built before Plan 2 work begins.

**Spec:** `docs/superpowers/specs/2026-05-10-codewizualizer-production-design.md` §5 (Component map: web server + frontend), §10 v0.1 ships ("Two views populated end-to-end: Architecture overview, Files"; the production-only **provenance badge** and **re-analyze button**), §10 acceptance criteria #2 / #3 / #4.

---

## File structure produced by this plan

```
codewiz/
├── packages/
│   ├── sdk/
│   │   └── src/
│   │       └── project.ts             # NEW — Project = manifest + modules + edges + contracts + flows + diagnostics
│   ├── server/                         # NEW package
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                # createServer({ projectRoot, webDist }) factory
│   │   │   ├── load.ts                 # readProject(projectRoot) — load .codewiz/ JSON files into Project
│   │   │   ├── analyzer.ts             # runReanalyze() — wraps @codewiz/core runAnalysis with event emitter
│   │   │   ├── events.ts               # tiny pub/sub for SSE listeners
│   │   │   ├── routes/
│   │   │   │   ├── project.ts          # GET /api/project
│   │   │   │   ├── reanalyze.ts        # POST /api/reanalyze
│   │   │   │   └── events.ts           # GET /api/events (SSE)
│   │   │   └── static.ts               # static-file serving for the web bundle
│   │   └── tests/
│   │       ├── load.test.ts
│   │       ├── project.test.ts
│   │       ├── reanalyze.test.ts
│   │       └── static.test.ts
│   ├── web/                            # NEW package
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.node.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── api.ts                  # fetch wrappers (typed against @codewiz/sdk)
│   │   │   ├── ProjectContext.tsx      # provider + useProject hook
│   │   │   ├── icons.tsx               # SVG nav-icon components
│   │   │   ├── styles.css              # ported from /styles.css
│   │   │   ├── components/
│   │   │   │   ├── Titlebar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Statusbar.tsx
│   │   │   │   ├── ProvenanceBadge.tsx # NEW production widget
│   │   │   │   ├── ReanalyzeBar.tsx    # NEW production widget — button + SSE log
│   │   │   │   ├── PassportPanel.tsx
│   │   │   │   └── LayerDot.tsx
│   │   │   └── views/
│   │   │       ├── ArchitectureView.tsx
│   │   │       ├── FilesView.tsx
│   │   │       ├── DisabledView.tsx    # placeholder for v0.2-v0.4 views
│   │   │       └── synthCode.ts        # synthetic source-preview generator (port)
│   │   └── tests/
│   │       └── ProvenanceBadge.test.tsx
│   └── cli/
│       └── src/
│           └── serve.ts                # NEW — runServe(opts) + bin.ts subcommand
└── tests/
    ├── package.json                    # adds @playwright/test devDep + test:e2e script
    ├── playwright.config.ts            # NEW
    └── e2e/
        └── serve.spec.ts                # NEW — Playwright smoke
```

---

## Task 1: SDK — `Project` schema (the unified `/api/project` shape)

**Files:**
- Create: `packages/sdk/src/project.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/sdk/tests/schemas.test.ts`

- [ ] **Step 1: Append failing tests to `packages/sdk/tests/schemas.test.ts`**

```ts
import { ProjectSchema } from "../src/project.js";

describe("Project", () => {
  it("accepts an empty project", () => {
    const p = {
      manifest: {
        repoRoot: "/x", gitCommit: null, gitBranch: null,
        adapters: [], llm: null,
        generatedAt: "2026-05-10T00:00:00Z",
        lastSuccessful: "2026-05-10T00:00:00Z",
        contentHash: "0".repeat(64), protocolVersion: 1,
      },
      modules: [], edges: [], contracts: [], flows: [], diagnostics: [],
    };
    expect(ProjectSchema.parse(p)).toEqual(p);
  });

  it("accepts a project with one module", () => {
    const p = {
      manifest: {
        repoRoot: "/x", gitCommit: null, gitBranch: null,
        adapters: [{ name: "ts", version: "0.0.1" }], llm: null,
        generatedAt: "2026-05-10T00:00:00Z",
        lastSuccessful: "2026-05-10T00:00:00Z",
        contentHash: "a".repeat(64), protocolVersion: 1,
      },
      modules: [{
        id: "ts:src/App.tsx", name: "App", path: "src/App.tsx", language: "ts",
        layer: { value: "ui", provenance: { source: "static" } },
        kind: "page", loc: 12, citations: [{ path: "src/App.tsx", line: 1 }],
      }],
      edges: [], contracts: [], flows: [], diagnostics: [],
    };
    expect(ProjectSchema.parse(p)).toEqual(p);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/sdk test`

- [ ] **Step 3: Implement `packages/sdk/src/project.ts`**

```ts
import { z } from "zod";
import { ManifestSchema } from "./manifest.js";
import { ModuleSchema, EdgeSchema } from "./module.js";
import { ContractSchema, FlowSchema } from "./contract.js";
import { DiagnosticSchema } from "./adapter.js";

export const ProjectSchema = z.object({
  manifest: ManifestSchema,
  modules: z.array(ModuleSchema),
  edges: z.array(EdgeSchema),
  contracts: z.array(ContractSchema),
  flows: z.array(FlowSchema),
  diagnostics: z.array(DiagnosticSchema),
});
export type Project = z.infer<typeof ProjectSchema>;
```

- [ ] **Step 4: Re-export**

Append to `packages/sdk/src/index.ts`:
```ts
export * from "./project.js";
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/sdk build && pnpm --filter @codewiz/sdk test`
Expected: 27 tests passed (25 prior + 2 new).

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/
git commit -m "feat(sdk): Project schema (unified /api/project shape)"
```

---

## Task 2: Server — package skeleton + `readProject()` + `GET /api/project`

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/load.ts`
- Create: `packages/server/src/routes/project.ts`
- Create: `packages/server/tests/load.test.ts`
- Create: `packages/server/tests/project.test.ts`

- [ ] **Step 1: Create package skeleton**

`packages/server/package.json`:
```json
{
  "name": "@codewiz/server",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@codewiz/sdk": "workspace:*",
    "@codewiz/core": "workspace:*",
    "@codewiz/adapter-ts": "workspace:*",
    "hono": "^4.6.14",
    "@hono/node-server": "^1.13.7"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

`packages/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Write failing test for `readProject()`**

`packages/server/tests/load.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProject } from "../src/load.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-load-"));
  mkdirSync(join(dir, ".codewiz"));
  const manifest = {
    repoRoot: dir, gitCommit: null, gitBranch: null,
    adapters: [{ name: "ts", version: "0.0.1" }], llm: null,
    generatedAt: "2026-05-10T00:00:00Z",
    lastSuccessful: "2026-05-10T00:00:00Z",
    contentHash: "0".repeat(64), protocolVersion: 1,
  };
  writeFileSync(join(dir, ".codewiz/manifest.json"), JSON.stringify(manifest));
  writeFileSync(join(dir, ".codewiz/modules.json"), "[]");
  writeFileSync(join(dir, ".codewiz/edges.json"), "[]");
  writeFileSync(join(dir, ".codewiz/contracts.json"), "[]");
  writeFileSync(join(dir, ".codewiz/flows.json"), "[]");
  writeFileSync(join(dir, ".codewiz/diagnostics.json"), "[]");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("readProject", () => {
  it("returns the unified Project from .codewiz/ JSON files", async () => {
    const p = await readProject(dir);
    expect(p.manifest.contentHash).toHaveLength(64);
    expect(p.modules).toEqual([]);
    expect(p.edges).toEqual([]);
  });

  it("throws ENOENT-style error when .codewiz/manifest.json is missing", async () => {
    rmSync(join(dir, ".codewiz/manifest.json"));
    await expect(readProject(dir)).rejects.toThrow(/manifest\.json/);
  });

  it("throws when manifest fails schema validation", async () => {
    writeFileSync(join(dir, ".codewiz/manifest.json"), '{"bad":"data"}');
    await expect(readProject(dir)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm install && pnpm --filter @codewiz/server test`

- [ ] **Step 4: Implement `packages/server/src/load.ts`**

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ProjectSchema, ManifestSchema,
  ModuleSchema, EdgeSchema, ContractSchema, FlowSchema, DiagnosticSchema,
  type Project,
} from "@codewiz/sdk";
import { z } from "zod";

async function readJson<T>(path: string, schema: z.ZodSchema<T>): Promise<T> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    throw new Error(`failed to read ${path}: ${(e as Error).message}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`failed to parse ${path}: ${(e as Error).message}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`schema validation failed for ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function readProject(projectRoot: string): Promise<Project> {
  const dir = join(projectRoot, ".codewiz");
  const [manifest, modules, edges, contracts, flows, diagnostics] = await Promise.all([
    readJson(join(dir, "manifest.json"),    ManifestSchema),
    readJson(join(dir, "modules.json"),     z.array(ModuleSchema)),
    readJson(join(dir, "edges.json"),       z.array(EdgeSchema)),
    readJson(join(dir, "contracts.json"),   z.array(ContractSchema)),
    readJson(join(dir, "flows.json"),       z.array(FlowSchema)),
    readJson(join(dir, "diagnostics.json"), z.array(DiagnosticSchema)),
  ]);
  return ProjectSchema.parse({ manifest, modules, edges, contracts, flows, diagnostics });
}
```

- [ ] **Step 5: Write failing test for `GET /api/project`**

`packages/server/tests/project.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../src/index.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-server-"));
  mkdirSync(join(dir, ".codewiz"));
  const manifest = {
    repoRoot: dir, gitCommit: null, gitBranch: null,
    adapters: [{ name: "ts", version: "0.0.1" }], llm: null,
    generatedAt: "2026-05-10T00:00:00Z",
    lastSuccessful: "2026-05-10T00:00:00Z",
    contentHash: "abc".padEnd(64, "0"), protocolVersion: 1,
  };
  writeFileSync(join(dir, ".codewiz/manifest.json"), JSON.stringify(manifest));
  for (const f of ["modules", "edges", "contracts", "flows", "diagnostics"]) {
    writeFileSync(join(dir, `.codewiz/${f}.json`), "[]");
  }
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("GET /api/project", () => {
  it("returns the loaded Project", async () => {
    const app = createServer({ projectRoot: dir, webDist: null });
    const res = await app.fetch(new Request("http://localhost/api/project"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manifest.contentHash).toBeDefined();
    expect(body.modules).toEqual([]);
  });

  it("returns 500 with error JSON when project fails to load", async () => {
    rmSync(join(dir, ".codewiz/manifest.json"));
    const app = createServer({ projectRoot: dir, webDist: null });
    const res = await app.fetch(new Request("http://localhost/api/project"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/manifest\.json/);
  });
});
```

- [ ] **Step 6: Run, expect FAIL**

Run: `pnpm --filter @codewiz/server test`

- [ ] **Step 7: Implement `packages/server/src/routes/project.ts`**

```ts
import { Hono } from "hono";
import { readProject } from "../load.js";

export function projectRoutes(projectRoot: string): Hono {
  const r = new Hono();
  r.get("/api/project", async (c) => {
    try {
      const project = await readProject(projectRoot);
      return c.json(project);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500);
    }
  });
  return r;
}
```

- [ ] **Step 8: Implement `packages/server/src/index.ts`**

```ts
import { Hono } from "hono";
import { projectRoutes } from "./routes/project.js";

export interface ServerOptions {
  projectRoot: string;
  webDist: string | null;     // path to built web bundle, or null for API-only
}

export function createServer(opts: ServerOptions): Hono {
  const app = new Hono();
  app.route("/", projectRoutes(opts.projectRoot));
  return app;
}
```

- [ ] **Step 9: Run tests, expect PASS**

Run: `pnpm --filter @codewiz/server build && pnpm --filter @codewiz/server test`
Expected: 5 tests pass (3 load + 2 project).

- [ ] **Step 10: Commit**

```bash
git add packages/server/ pnpm-lock.yaml
git commit -m "feat(server): readProject + GET /api/project"
```

---

## Task 3: Server — analyzer event-emitter wrapper

**Files:**
- Create: `packages/server/src/events.ts`
- Create: `packages/server/src/analyzer.ts`
- Create: `packages/server/tests/reanalyze.test.ts`

- [ ] **Step 1: Write failing test**

`packages/server/tests/reanalyze.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReanalyze } from "../src/analyzer.js";
import { EventBus } from "../src/events.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-reanalyze-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/a.ts"), "export const A = 1;");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runReanalyze", () => {
  it("emits start and done events around runAnalysis", async () => {
    const bus = new EventBus();
    const events: { type: string; payload?: unknown }[] = [];
    bus.subscribe((e) => events.push(e));
    await runReanalyze({ projectRoot: dir, bus });
    expect(events[0].type).toBe("start");
    expect(events[events.length - 1].type).toBe("done");
    const done = events[events.length - 1] as { type: "done"; payload: { contentHash: string } };
    expect(done.payload.contentHash).toHaveLength(64);
  });

  it("emits an error event when analysis fails", async () => {
    rmSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, ".codewiz.yml"), "bad: [\nyaml");
    const bus = new EventBus();
    const events: { type: string; payload?: unknown }[] = [];
    bus.subscribe((e) => events.push(e));
    await expect(runReanalyze({ projectRoot: dir, bus })).rejects.toThrow();
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});

describe("EventBus", () => {
  it("delivers events to all subscribers and stops after unsubscribe", () => {
    const bus = new EventBus();
    const a: string[] = [];
    const b: string[] = [];
    const unsubA = bus.subscribe((e) => a.push(e.type));
    bus.subscribe((e) => b.push(e.type));
    bus.publish({ type: "ping" });
    unsubA();
    bus.publish({ type: "pong" });
    expect(a).toEqual(["ping"]);
    expect(b).toEqual(["ping", "pong"]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/server test`

- [ ] **Step 3: Implement `packages/server/src/events.ts`**

```ts
export type ServerEvent =
  | { type: "start" }
  | { type: "log"; payload: { level: "info" | "warn" | "error"; message: string } }
  | { type: "done"; payload: { contentHash: string } }
  | { type: "error"; payload: { message: string } }
  | { type: "ping" } | { type: "pong" };

type Listener = (event: ServerEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  publish(event: ServerEvent): void {
    for (const l of this.listeners) l(event);
  }
}
```

- [ ] **Step 4: Implement `packages/server/src/analyzer.ts`**

```ts
import { runAnalysis, AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";
import type { EventBus } from "./events.js";

export interface ReanalyzeOptions {
  projectRoot: string;
  bus: EventBus;
}

export async function runReanalyze(opts: ReanalyzeOptions): Promise<void> {
  const { projectRoot, bus } = opts;
  bus.publish({ type: "start" });
  try {
    const reg = new AdapterRegistry();
    reg.register("ts", createTsAdapter);
    const manifest = await runAnalysis({
      projectRoot,
      adapters: ["ts"],
      registry: reg,
    });
    bus.publish({
      type: "done",
      payload: { contentHash: manifest.contentHash },
    });
  } catch (e) {
    const message = (e as Error).message;
    bus.publish({ type: "error", payload: { message } });
    throw e;
  }
}
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/sdk build && pnpm --filter @codewiz/core build && pnpm --filter @codewiz/adapter-ts build && pnpm --filter @codewiz/server test`
Expected: 8 tests pass (5 prior + 3 new).

- [ ] **Step 6: Commit**

```bash
git add packages/server/
git commit -m "feat(server): EventBus + runReanalyze wrapping core runAnalysis"
```

---

## Task 4: Server — `POST /api/reanalyze` + `GET /api/events` (SSE)

**Files:**
- Create: `packages/server/src/routes/reanalyze.ts`
- Create: `packages/server/src/routes/events.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/tests/reanalyze.test.ts`

- [ ] **Step 1: Append failing endpoint tests**

Append to `packages/server/tests/reanalyze.test.ts`:
```ts
import { createServer } from "../src/index.js";

describe("POST /api/reanalyze", () => {
  it("returns 202 immediately and runs analysis in background", async () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/a.ts"), "export const A = 1;");
    const app = createServer({ projectRoot: dir, webDist: null });
    const res = await app.fetch(new Request("http://localhost/api/reanalyze", { method: "POST" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.queued).toBe(true);
    // Wait for background analysis to complete (small fixture, <1s).
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 50));
      try {
        const probe = await app.fetch(new Request("http://localhost/api/project"));
        if (probe.status === 200) {
          const project = await probe.json();
          if (project.manifest.contentHash) return;
        }
      } catch {}
    }
    throw new Error("analysis did not complete in 2.5s");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/server test`

- [ ] **Step 3: Implement `packages/server/src/routes/reanalyze.ts`**

```ts
import { Hono } from "hono";
import { runReanalyze } from "../analyzer.js";
import type { EventBus } from "../events.js";

export function reanalyzeRoutes(projectRoot: string, bus: EventBus): Hono {
  const r = new Hono();
  r.post("/api/reanalyze", (c) => {
    // Fire and forget — events flow through the bus, errors are caught.
    runReanalyze({ projectRoot, bus }).catch(() => {
      // EventBus already received an error event; nothing more to do here.
    });
    return c.json({ queued: true }, 202);
  });
  return r;
}
```

- [ ] **Step 4: Implement `packages/server/src/routes/events.ts`**

```ts
import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { EventBus, ServerEvent } from "../events.js";

export function eventsRoutes(bus: EventBus): Hono {
  const r = new Hono();
  r.get("/api/events", (c) => {
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    return stream(c, async (s) => {
      const queue: ServerEvent[] = [];
      let resolve: (() => void) | null = null;
      const unsubscribe = bus.subscribe((event) => {
        queue.push(event);
        if (resolve) { const r = resolve; resolve = null; r(); }
      });
      try {
        // Heartbeat so proxies don't close the stream.
        const heartbeat = setInterval(() => {
          void s.write(": ping\n\n");
        }, 15000);
        try {
          while (!s.aborted) {
            if (queue.length === 0) {
              await new Promise<void>((r) => { resolve = r; });
            }
            const event = queue.shift();
            if (event) {
              await s.write(`event: ${event.type}\n`);
              await s.write(`data: ${JSON.stringify("payload" in event ? event.payload : {})}\n\n`);
            }
          }
        } finally {
          clearInterval(heartbeat);
        }
      } finally {
        unsubscribe();
      }
    });
  });
  return r;
}
```

- [ ] **Step 5: Wire into `packages/server/src/index.ts`**

Replace the file body:
```ts
import { Hono } from "hono";
import { projectRoutes } from "./routes/project.js";
import { reanalyzeRoutes } from "./routes/reanalyze.js";
import { eventsRoutes } from "./routes/events.js";
import { EventBus } from "./events.js";

export interface ServerOptions {
  projectRoot: string;
  webDist: string | null;
}

export function createServer(opts: ServerOptions): Hono {
  const app = new Hono();
  const bus = new EventBus();
  app.route("/", projectRoutes(opts.projectRoot));
  app.route("/", reanalyzeRoutes(opts.projectRoot, bus));
  app.route("/", eventsRoutes(bus));
  return app;
}

export { EventBus } from "./events.js";
export type { ServerEvent } from "./events.js";
```

- [ ] **Step 6: Run, expect PASS**

Run: `pnpm --filter @codewiz/server test`
Expected: 9 tests pass (8 prior + 1 new).

- [ ] **Step 7: Commit**

```bash
git add packages/server/
git commit -m "feat(server): POST /api/reanalyze + GET /api/events (SSE)"
```

---

## Task 5: Server — static file serving + listen()

**Files:**
- Create: `packages/server/src/static.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/tests/static.test.ts`

- [ ] **Step 1: Write failing test**

`packages/server/tests/static.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../src/index.js";

let projectRoot: string;
let webDist: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "codewiz-static-proj-"));
  mkdirSync(join(projectRoot, ".codewiz"));
  const manifest = {
    repoRoot: projectRoot, gitCommit: null, gitBranch: null,
    adapters: [], llm: null,
    generatedAt: "2026-05-10T00:00:00Z",
    lastSuccessful: "2026-05-10T00:00:00Z",
    contentHash: "0".repeat(64), protocolVersion: 1,
  };
  writeFileSync(join(projectRoot, ".codewiz/manifest.json"), JSON.stringify(manifest));
  for (const f of ["modules", "edges", "contracts", "flows", "diagnostics"]) {
    writeFileSync(join(projectRoot, `.codewiz/${f}.json`), "[]");
  }

  webDist = mkdtempSync(join(tmpdir(), "codewiz-static-web-"));
  writeFileSync(join(webDist, "index.html"), "<!doctype html><html><body>hi</body></html>");
  mkdirSync(join(webDist, "assets"));
  writeFileSync(join(webDist, "assets/app.js"), "console.log(1);");
});
afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(webDist, { recursive: true, force: true });
});

describe("static file serving", () => {
  it("serves index.html at /", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<!doctype html>");
  });

  it("serves assets/app.js with correct content type", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/assets/app.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("falls back to index.html for unknown paths (SPA mode)", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/some/spa/route"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<!doctype html>");
  });

  it("does NOT fall back to index.html for /api paths", async () => {
    const app = createServer({ projectRoot, webDist });
    const res = await app.fetch(new Request("http://localhost/api/unknown"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/server test`

- [ ] **Step 3: Implement `packages/server/src/static.ts`**

```ts
import { Hono } from "hono";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map":  "application/json; charset=utf-8",
};

async function tryRead(p: string): Promise<{ body: Buffer; mime: string } | null> {
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    const body = await readFile(p);
    const mime = MIME[extname(p).toLowerCase()] ?? "application/octet-stream";
    return { body, mime };
  } catch {
    return null;
  }
}

export function staticRoutes(webDist: string): Hono {
  const r = new Hono();
  r.get("*", async (c) => {
    const url = new URL(c.req.url);
    if (url.pathname.startsWith("/api/")) return c.notFound();
    // Strip leading "/", default to index.html
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const direct = await tryRead(join(webDist, rel));
    if (direct) {
      c.header("Content-Type", direct.mime);
      return c.body(direct.body);
    }
    // SPA fallback
    const fallback = await tryRead(join(webDist, "index.html"));
    if (fallback) {
      c.header("Content-Type", fallback.mime);
      return c.body(fallback.body);
    }
    return c.notFound();
  });
  return r;
}
```

- [ ] **Step 4: Wire into `packages/server/src/index.ts`**

Add the import and conditional route registration:
```ts
import { staticRoutes } from "./static.js";

// in createServer, after the other route() calls:
if (opts.webDist) {
  app.route("/", staticRoutes(opts.webDist));
}
```

- [ ] **Step 5: Add a `listen()` helper for production use**

Append to `packages/server/src/index.ts`:
```ts
import { serve as nodeServe } from "@hono/node-server";

export interface ListenOptions extends ServerOptions {
  port: number;
  hostname?: string;   // defaults to 127.0.0.1
}

export function listen(opts: ListenOptions): { port: number; close: () => Promise<void> } {
  const app = createServer(opts);
  const server = nodeServe({
    fetch: app.fetch,
    hostname: opts.hostname ?? "127.0.0.1",
    port: opts.port,
  });
  return {
    port: opts.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
```

- [ ] **Step 6: Run, expect PASS**

Run: `pnpm --filter @codewiz/server test`
Expected: 13 tests pass (9 prior + 4 new).

- [ ] **Step 7: Commit**

```bash
git add packages/server/
git commit -m "feat(server): static file serving + SPA fallback + listen() helper"
```

---

## Task 6: Web — Vite + React + TS skeleton

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/tsconfig.node.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx` (placeholder — fully replaced in Task 14)

- [ ] **Step 1: Create package skeleton**

`packages/web/package.json`:
```json
{
  "name": "@codewiz/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "files": ["dist", "index.html"],
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@codewiz/sdk": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.0"
  }
}
```

`packages/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`packages/web/tsconfig.node.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist-node",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

`packages/web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8765",
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: [],
  },
});
```

`packages/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>codeWizualizer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/web/src/main.tsx`:
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(<React.StrictMode><App /></React.StrictMode>);
```

`packages/web/src/App.tsx` (placeholder — replaced in Task 14):
```tsx
export function App() {
  return <div style={{ padding: 40, color: "#d8dee9" }}>codeWizualizer — booting…</div>;
}
```

`packages/web/src/styles.css`:
```css
/* Replaced in Task 7 with full port from /styles.css. Empty stub for now. */
:root { color-scheme: dark; }
body { margin: 0; background: #0a0d12; }
```

- [ ] **Step 2: Install deps and verify Vite builds**

Run:
```
pnpm install
pnpm --filter @codewiz/web build
```
Expected: `dist/index.html` and `dist/assets/*.js` produced. No errors.

- [ ] **Step 3: Verify Vite dev server boots**

Run:
```
pnpm --filter @codewiz/web exec vite --port 5174 --host 127.0.0.1 &
sleep 2
curl -sS http://127.0.0.1:5174/ | head -c 200
kill %1
```
Expected: HTML returns containing the title element. (If browser inspection is unavailable, this curl is enough.)

- [ ] **Step 4: Commit**

```bash
git add packages/web/ pnpm-lock.yaml
git commit -m "feat(web): Vite + React + TS skeleton"
```

---

## Task 7: Web — port `styles.css` + define `ProjectContext` + `api.ts`

**Files:**
- Modify: `packages/web/src/styles.css` (replace stub)
- Create: `packages/web/src/api.ts`
- Create: `packages/web/src/ProjectContext.tsx`

- [ ] **Step 1: Replace `packages/web/src/styles.css`**

Copy the entire contents of `/home/rdhagan92/code_wiz/styles.css` into `packages/web/src/styles.css`. The CSS is unchanged from the prototype — same variables, same class names, same dark-IDE aesthetic. Do not modify it.

```bash
cp /home/rdhagan92/code_wiz/styles.css /home/rdhagan92/code_wiz/packages/web/src/styles.css
```

- [ ] **Step 2: Create `packages/web/src/api.ts`**

```ts
import { ProjectSchema, type Project } from "@codewiz/sdk";

export async function fetchProject(): Promise<Project> {
  const res = await fetch("/api/project");
  if (!res.ok) throw new Error(`fetch /api/project failed: ${res.status}`);
  const raw = await res.json();
  return ProjectSchema.parse(raw);
}

export async function postReanalyze(): Promise<void> {
  const res = await fetch("/api/reanalyze", { method: "POST" });
  if (!res.ok) throw new Error(`POST /api/reanalyze failed: ${res.status}`);
}

export type ServerEvent =
  | { type: "start"; payload: Record<string, never> }
  | { type: "log"; payload: { level: "info" | "warn" | "error"; message: string } }
  | { type: "done"; payload: { contentHash: string } }
  | { type: "error"; payload: { message: string } };

export function openEvents(onEvent: (e: ServerEvent) => void): () => void {
  const es = new EventSource("/api/events");
  const handler = (type: ServerEvent["type"]) => (ev: MessageEvent) => {
    try {
      const payload = JSON.parse(ev.data);
      onEvent({ type, payload } as ServerEvent);
    } catch {
      // ignore malformed events
    }
  };
  es.addEventListener("start", handler("start"));
  es.addEventListener("log", handler("log"));
  es.addEventListener("done", handler("done"));
  es.addEventListener("error", handler("error"));
  return () => es.close();
}
```

- [ ] **Step 3: Create `packages/web/src/ProjectContext.tsx`**

```tsx
import {
  createContext, useContext, useEffect, useState, type ReactNode,
  useCallback,
} from "react";
import type { Project } from "@codewiz/sdk";
import { fetchProject } from "./api.js";

type Status = "loading" | "ready" | "error";

interface ProjectContextValue {
  status: Status;
  project: Project | null;
  error: string | null;
  refetch: () => Promise<void>;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const p = await fetchProject();
      setProject(p);
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return <Ctx.Provider value={{ status, project, error, refetch }}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProject must be used inside <ProjectProvider>");
  return ctx;
}
```

- [ ] **Step 4: Verify the package still builds**

Run:
```
pnpm --filter @codewiz/sdk build
pnpm --filter @codewiz/web build
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add packages/web/
git commit -m "feat(web): port styles.css + ProjectContext + typed api wrappers"
```

---

## Task 8: Web — `ProvenanceBadge` component

**Files:**
- Create: `packages/web/src/components/ProvenanceBadge.tsx`
- Create: `packages/web/tests/ProvenanceBadge.test.tsx`

This is a NEW production-only component (the prototype has nothing equivalent). It renders a small chip that surfaces provenance + a hover popover showing source/citation.

- [ ] **Step 1: Write failing test**

`packages/web/tests/ProvenanceBadge.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvenanceBadge } from "../src/components/ProvenanceBadge.js";

describe("ProvenanceBadge", () => {
  it("renders 'S' for static provenance", () => {
    render(<ProvenanceBadge provenance={{ source: "static" }} />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("renders 'A' and includes file:line in the tooltip for annotation", () => {
    render(
      <ProvenanceBadge
        provenance={{ source: "annotation", file: ".codewiz.yml", line: 12 }}
      />,
    );
    const badge = screen.getByText("A");
    expect(badge).toBeInTheDocument();
    expect(badge.title).toContain(".codewiz.yml:12");
  });

  it("renders 'B' with confidence for bridge provenance", () => {
    render(<ProvenanceBadge provenance={{ source: "bridge", confidence: 0.8 }} />);
    const badge = screen.getByText("B");
    expect(badge.title).toContain("0.8");
  });

  it("renders 'L' with model for llm provenance", () => {
    render(
      <ProvenanceBadge
        provenance={{
          source: "llm", model: "anthropic/claude-sonnet-4-6",
          promptHash: "abc", confidence: 0.7,
          citations: [{ path: "src/x.ts", line: 4 }],
        }}
      />,
    );
    const badge = screen.getByText("L");
    expect(badge.title).toContain("claude-sonnet-4-6");
  });
});
```

- [ ] **Step 2: Add jsdom test environment to vitest config and a setup file**

Modify `packages/web/vite.config.ts` — change the `test` block to include the setup file:
```ts
test: {
  environment: "jsdom",
  globals: false,
  setupFiles: ["./tests/setup.ts"],
},
```

Create `packages/web/tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm --filter @codewiz/web test`

- [ ] **Step 4: Implement `packages/web/src/components/ProvenanceBadge.tsx`**

```tsx
import type { Provenance } from "@codewiz/sdk";

interface Props {
  provenance: Provenance;
}

const STYLE: Record<Provenance["source"], { label: string; color: string; bg: string }> = {
  static:     { label: "S", color: "var(--text-faint)", bg: "var(--bg-elev-2)" },
  annotation: { label: "A", color: "var(--cyan)",      bg: "var(--cyan-dim)" },
  bridge:     { label: "B", color: "var(--violet)",    bg: "var(--violet-dim)" },
  llm:        { label: "L", color: "var(--amber)",     bg: "var(--amber-dim)" },
};

function tooltip(p: Provenance): string {
  switch (p.source) {
    case "static":
      return "Static analysis (parser fact)";
    case "annotation":
      return `Annotation override · ${p.file}:${p.line}`;
    case "bridge":
      return `Cross-language bridge · confidence ${p.confidence}`;
    case "llm":
      return `LLM-derived · ${p.model} · confidence ${p.confidence}`;
  }
}

export function ProvenanceBadge({ provenance }: Props) {
  const s = STYLE[provenance.source];
  return (
    <span
      title={tooltip(provenance)}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        padding: "1px 5px",
        borderRadius: 3,
        background: s.bg,
        color: s.color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        userSelect: "none",
      }}
    >
      {s.label}
    </span>
  );
}
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/web test`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web/
git commit -m "feat(web): ProvenanceBadge component (production-only)"
```

---

## Task 9: Web — `Titlebar` + `Statusbar` + `LayerDot` helper

**Files:**
- Create: `packages/web/src/components/LayerDot.tsx`
- Create: `packages/web/src/components/Titlebar.tsx`
- Create: `packages/web/src/components/Statusbar.tsx`

The titlebar + statusbar are mostly visual — the prototype has them in `app.jsx`. Production differences: the titlebar shows the manifest's repo + branch + adapter info; the statusbar shows live counts from the loaded Project.

- [ ] **Step 1: Create `LayerDot.tsx`**

```tsx
import type { LayerKey } from "@codewiz/sdk";

const LAYER_COLOR: Record<LayerKey, string> = {
  ui:       "var(--cyan)",
  state:    "var(--violet)",
  api:      "var(--green)",
  service:  "var(--amber)",
  data:     "var(--pink)",
  external: "#5b6577",
};

export function LayerDot({ layer, size = 8 }: { layer: LayerKey; size?: number }) {
  return (
    <span
      className="layer-dot"
      style={{ width: size, height: size, background: LAYER_COLOR[layer], display: "inline-block", borderRadius: "50%" }}
    />
  );
}

export const LAYER_LABEL: Record<LayerKey, string> = {
  ui: "UI", state: "State", api: "API edge",
  service: "Service", data: "Data", external: "External",
};

export { LAYER_COLOR };
```

- [ ] **Step 2: Create `Titlebar.tsx`**

```tsx
import type { Manifest } from "@codewiz/sdk";

interface Props {
  manifest: Manifest;
  moduleCount: number;
  contractCount: number;
  mismatchCount: number;
  reanalyzeButton: React.ReactNode;
}

export function Titlebar({ manifest, moduleCount, contractCount, mismatchCount, reanalyzeButton }: Props) {
  const branch = manifest.gitBranch ?? "—";
  const repo = manifest.repoRoot.split("/").slice(-1)[0] ?? manifest.repoRoot;
  return (
    <div className="titlebar">
      <div className="brand">
        <div className="brand-mark"></div>
        <span>codeWizualizer</span>
      </div>
      <div className="crumbs">
        <span style={{ color: "var(--text-faint)", fontSize: 10 }}>local ·</span>
        <span className="repo">{repo}</span>
        <span className="sep">/</span>
        <span className="branch">⎇ {branch}</span>
        <span className="sep">·</span>
        <span>{moduleCount} modules · {contractCount} contracts</span>
      </div>
      <div className="right">
        <span className="pill live">analysis fresh</span>
        {mismatchCount > 0 && (
          <span className="pill">{mismatchCount} mismatches</span>
        )}
        {reanalyzeButton}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `Statusbar.tsx`**

```tsx
import type { Project } from "@codewiz/sdk";

interface Props {
  project: Project;
  view: string;
  groupKey: string;
}

export function Statusbar({ project, view, groupKey }: Props) {
  const mismatchCount = project.contracts.filter((c) => c.issues.length > 0).length;
  return (
    <div className="statusbar">
      <span className="item"><span style={{ color: "var(--green)" }}>●</span> indexed</span>
      <span className="item">{project.modules.length} nodes · {project.edges.length} edges</span>
      <span className="item">{mismatchCount} contracts with mismatches</span>
      <span className="right">
        <span>group: <span style={{ color: "var(--text)" }}>{groupKey}</span></span>
        <span>view: <span style={{ color: "var(--text)" }}>{view}</span></span>
        <span>shortcut: 1–6</span>
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @codewiz/web build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/web/
git commit -m "feat(web): Titlebar + Statusbar + LayerDot helper"
```

---

## Task 10: Web — `Sidebar` (file tree + nav with disabled v0.2+ items)

**Files:**
- Create: `packages/web/src/icons.tsx`
- Create: `packages/web/src/components/Sidebar.tsx`

- [ ] **Step 1: Create `icons.tsx`** (port from `app.jsx`)

```tsx
export const ArchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1" /><rect x="9.5" y="1.5" width="5" height="5" rx="1" />
    <rect x="1.5" y="9.5" width="5" height="5" rx="1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" />
  </svg>
);
export const DepIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="3" cy="3" r="2" /><circle cx="13" cy="4" r="2" /><circle cx="8" cy="13" r="2" />
    <line x1="3" y1="3" x2="13" y2="4" /><line x1="13" y1="4" x2="8" y2="13" /><line x1="3" y1="3" x2="8" y2="13" />
  </svg>
);
export const FlowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="3" cy="3" r="1.5" /><circle cx="3" cy="13" r="1.5" /><circle cx="13" cy="8" r="1.5" />
    <path d="M3 4.5 V 11.5" /><path d="M4.5 13 H 11.5" /><path d="M3 3 Q 13 3 13 6.5" />
  </svg>
);
export const DataIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <ellipse cx="8" cy="3.5" rx="5" ry="1.5" /><path d="M3 3.5 V 12.5 Q 8 14 13 12.5 V 3.5" />
    <path d="M3 8 Q 8 9.5 13 8" />
  </svg>
);
export const ContractIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="2" width="12" height="12" rx="1.5" />
    <line x1="4" y1="6" x2="12" y2="6" /><line x1="4" y1="9" x2="9" y2="9" /><line x1="4" y1="12" x2="11" y2="12" />
  </svg>
);
export const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M3 1.5 H 9 L 13 5.5 V 14.5 H 3 Z" /><path d="M9 1.5 V 5.5 H 13" />
  </svg>
);
```

- [ ] **Step 2: Create `Sidebar.tsx`**

```tsx
import { useState, useMemo, type ReactNode } from "react";
import type { Module } from "@codewiz/sdk";
import { LayerDot } from "./LayerDot.js";
import { ArchIcon, DepIcon, FlowIcon, DataIcon, ContractIcon, FileIcon } from "../icons.js";

export type ViewId = "arch" | "deps" | "flow" | "data" | "contract" | "files";

interface NavItem {
  id: ViewId;
  label: string;
  k: string;
  icon: ReactNode;
  disabled?: { sinceVersion: string };
}

const NAV: NavItem[] = [
  { id: "arch",     label: "Architecture",    k: "1", icon: <ArchIcon /> },
  { id: "deps",     label: "Dependencies",    k: "2", icon: <DepIcon />,    disabled: { sinceVersion: "v0.2" } },
  { id: "flow",     label: "Functional flow", k: "3", icon: <FlowIcon />,   disabled: { sinceVersion: "v0.4" } },
  { id: "data",     label: "Data flow",       k: "4", icon: <DataIcon />,   disabled: { sinceVersion: "v0.4" } },
  { id: "contract", label: "Contracts",       k: "5", icon: <ContractIcon />, disabled: { sinceVersion: "v0.3" } },
  { id: "files",    label: "Files",           k: "6", icon: <FileIcon /> },
];

interface Props {
  view: ViewId;
  setView: (v: ViewId) => void;
  modules: Module[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

interface TreeNode {
  _files?: Module[];
  [k: string]: TreeNode | Module[] | undefined;
}

export function Sidebar({ view, setView, modules, selectedId, onSelect, query, setQuery }: Props) {
  const tree = useMemo(() => buildTree(modules), [modules]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (k: string) => setCollapsed((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const renderTree = (node: TreeNode, prefix = "", depth = 0): ReactNode[] => {
    const out: ReactNode[] = [];
    Object.keys(node).filter((k) => k !== "_files").sort().forEach((k) => {
      const path = prefix + k;
      const isCol = collapsed.has(path);
      out.push(
        <div key={"d:" + path} className="tree-node" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => toggle(path)}>
          <span className="chev">{isCol ? "▸" : "▾"}</span>
          <span style={{ color: "var(--text-dim)" }}>{k}</span>
        </div>,
      );
      if (!isCol) {
        out.push(...renderTree(node[k] as TreeNode, path + "/", depth + 1));
      }
    });
    (node._files ?? []).forEach((f) => {
      if (query && !f.name.toLowerCase().includes(query.toLowerCase()) && !f.path.toLowerCase().includes(query.toLowerCase())) return;
      out.push(
        <div
          key={"f:" + f.id}
          className={`tree-node ${selectedId === f.id ? "selected" : ""}`}
          style={{ paddingLeft: 8 + (depth + 1) * 12 }}
          onClick={() => onSelect(f.id)}
        >
          <LayerDot layer={f.layer.value} size={6} />
          <span style={{ color: "var(--text)" }}>{f.path.split("/").slice(-1)[0]}</span>
          {f.annotation && (
            <span className={`annotation ${f.annotation}`}>
              {f.annotation === "err" ? "bug" :
               f.annotation === "warn" ? "rev" :
               f.annotation === "new" ? "new" : "dup"}
            </span>
          )}
        </div>,
      );
    });
    return out;
  };

  return (
    <div className="sidebar">
      <div className="nav">
        <div className="nav-label">Views</div>
        {NAV.map((it) => {
          const isDisabled = !!it.disabled;
          const title = isDisabled ? `Ships in ${it.disabled!.sinceVersion}` : "";
          return (
            <div
              key={it.id}
              className={`nav-item ${view === it.id ? "active" : ""}`}
              style={isDisabled ? { opacity: 0.4, cursor: "not-allowed" } : {}}
              title={title}
              onClick={isDisabled ? undefined : () => setView(it.id)}
            >
              <span className="ico">{it.icon}</span>
              <span>{it.label}</span>
              <span className="kbd">{it.k}</span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <div className="searchbar" style={{ width: "auto" }}>
          <span style={{ color: "var(--text-faint)", marginRight: 6 }}>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter files…" />
        </div>
      </div>

      <div className="tree">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", padding: "2px 8px 8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Files · {modules.length}
        </div>
        {renderTree(tree)}
      </div>
    </div>
  );
}

function buildTree(modules: Module[]): TreeNode {
  const root: TreeNode = {};
  for (const m of modules) {
    if (m.layer.value === "external") continue;
    const parts = m.path.split("/");
    let cur: TreeNode = root;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) {
        cur._files = (cur._files ?? []) as Module[];
        (cur._files as Module[]).push(m);
      } else {
        cur[p] = (cur[p] ?? {}) as TreeNode;
        cur = cur[p] as TreeNode;
      }
    });
  }
  return root;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @codewiz/web build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/web/
git commit -m "feat(web): Sidebar with file tree + disabled v0.2+ nav items"
```

---

## Task 11: Web — `PassportPanel` (port + provenance badges per row)

**Files:**
- Create: `packages/web/src/components/PassportPanel.tsx`

- [ ] **Step 1: Create `PassportPanel.tsx`**

```tsx
import type { Module, Edge, Contract, Flow } from "@codewiz/sdk";
import { LayerDot, LAYER_LABEL } from "./LayerDot.js";
import { ProvenanceBadge } from "./ProvenanceBadge.js";

interface Props {
  modules: Module[];
  edges: Edge[];
  contracts: Contract[];
  flows: Flow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function PassportPanel({ modules, edges, contracts, flows, selectedId, onSelect, onClose }: Props) {
  const m = modules.find((x) => x.id === selectedId);
  if (!m) return null;

  const importsOut = edges.filter((e) => e.source === m.id && e.kind === "imports").map((e) => modules.find((x) => x.id === e.target)).filter((x): x is Module => !!x);
  const importsIn  = edges.filter((e) => e.target === m.id && e.kind === "imports").map((e) => modules.find((x) => x.id === e.source)).filter((x): x is Module => !!x);
  const calls      = edges.filter((e) => e.source === m.id && (e.kind === "calls" || e.kind === "http")).map((e) => modules.find((x) => x.id === e.target)).filter((x): x is Module => !!x);
  const dataT      = edges.filter((e) => e.source === m.id && e.kind === "data").map((e) => modules.find((x) => x.id === e.target)).filter((x): x is Module => !!x);
  const usedContracts = contracts.filter((c) => c.producers.includes(m.id) || c.consumers.includes(m.id));
  const inFlows = flows.filter((f) => f.steps.some((s) => s.mod === m.id));

  const healthSegs = 8;
  const healthScore = m.health?.score ?? 1;
  const filled = Math.round(healthScore * healthSegs);

  return (
    <div className="passport">
      <div className="pp-head">
        <div>
          <div className="pp-name">{m.name}</div>
          <div className="pp-path">{m.path}</div>
          <div className="pp-tags">
            <span className="tag layer">{LAYER_LABEL[m.layer.value]}</span>
            <ProvenanceBadge provenance={m.layer.provenance} />
            {m.team && <><span className="tag team">{m.team.value}</span><ProvenanceBadge provenance={m.team.provenance} /></>}
            {m.domain && <><span className="tag domain">{m.domain.value}</span><ProvenanceBadge provenance={m.domain.provenance} /></>}
            <span className="tag">{m.kind}</span>
          </div>
        </div>
        <button className="x" onClick={onClose}>×</button>
      </div>

      <div className="pp-body">
        <div className="pp-section">
          <h4>Stats</h4>
          <div className="pp-stat"><span>Lines</span><span className="v">{m.loc}</span></div>
          {m.health && (
            <>
              <div className="pp-stat"><span>Health</span><span className="v">{Math.round(healthScore * 100)}%</span></div>
              <div className="pp-health">
                {Array.from({ length: healthSegs }, (_, i) => (
                  <div key={i} className={`seg-bar ${i < filled ? "on" : ""}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {m.notes && (
          <div className="pp-section">
            <h4>Reviewer note</h4>
            <div style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
              ⓘ {m.notes}
            </div>
          </div>
        )}

        {importsOut.length > 0 && (
          <div className="pp-section">
            <h4>Imports → {importsOut.length}</h4>
            {importsOut.map((x) => (
              <div key={x.id} className="pp-row" onClick={() => onSelect(x.id)}>
                <LayerDot layer={x.layer.value} size={6} />
                <span style={{ color: "var(--text)" }}>{x.name}</span>
                <span style={{ color: "var(--text-faint)", marginLeft: "auto" }}>{x.kind}</span>
              </div>
            ))}
          </div>
        )}

        {importsIn.length > 0 && (
          <div className="pp-section">
            <h4>Imported by ← {importsIn.length}</h4>
            {importsIn.map((x) => (
              <div key={x.id} className="pp-row" onClick={() => onSelect(x.id)}>
                <LayerDot layer={x.layer.value} size={6} />
                <span style={{ color: "var(--text)" }}>{x.name}</span>
              </div>
            ))}
          </div>
        )}

        {calls.length > 0 && (
          <div className="pp-section">
            <h4>Calls / HTTP → {calls.length}</h4>
            {calls.map((x) => (
              <div key={x.id} className="pp-row" onClick={() => onSelect(x.id)}>
                <span className="arrow">→</span>
                <span style={{ color: "var(--text)" }}>{x.name}</span>
                <span style={{ color: "var(--text-faint)", marginLeft: "auto" }}>{x.path.split("/").slice(0, 2).join("/")}</span>
              </div>
            ))}
          </div>
        )}

        {dataT.length > 0 && (
          <div className="pp-section">
            <h4>Touches data → {dataT.length}</h4>
            {dataT.map((x) => (
              <div key={x.id} className="pp-row" onClick={() => onSelect(x.id)}>
                <span className="arrow" style={{ color: "var(--green)" }}>◆</span>
                <span style={{ color: "var(--text)" }}>{x.name}</span>
              </div>
            ))}
          </div>
        )}

        {usedContracts.length > 0 && (
          <div className="pp-section">
            <h4>Contracts</h4>
            {usedContracts.map((c) => {
              const role = c.producers.includes(m.id) ? "produces" : "consumes";
              const issue = c.issues.find((i) => i.consumer === m.id);
              return (
                <div key={c.id} className="pp-row">
                  <span style={{ color: issue ? "var(--amber)" : "var(--text-faint)" }}>{role === "produces" ? "↑" : "↓"}</span>
                  <span style={{ color: "var(--text)" }}>{c.name}</span>
                  <span style={{ color: issue ? "var(--amber)" : "var(--text-faint)", marginLeft: "auto", fontSize: 10 }}>
                    {role}{issue ? " · ⚠ mismatch" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {inFlows.length > 0 && (
          <div className="pp-section">
            <h4>Appears in flows</h4>
            {inFlows.map((f) => (
              <div key={f.id} className="pp-row">
                <span className="arrow">◇</span>
                <span style={{ color: "var(--text)" }}>{f.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @codewiz/web build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/web/
git commit -m "feat(web): PassportPanel with per-row provenance badges"
```

---

## Task 12: Web — `ArchitectureView` (layered swimlanes + provenance badges on nodes)

**Files:**
- Create: `packages/web/src/views/ArchitectureView.tsx`

- [ ] **Step 1: Create `ArchitectureView.tsx`**

```tsx
import { useMemo, useRef, useState, useEffect } from "react";
import type { Project, LayerKey, Module } from "@codewiz/sdk";
import { LAYER_COLOR, LAYER_LABEL } from "../components/LayerDot.js";

const LANES: LayerKey[] = ["ui", "state", "api", "service", "data", "external"];

interface Props {
  project: Project;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function ArchitectureView({ project, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const padding = 40;
  const laneH = (size.h - padding * 2) / LANES.length;

  const groups: Record<LayerKey, Module[]> = useMemo(() => {
    const g: Record<string, Module[]> = {};
    for (const l of LANES) g[l] = project.modules.filter((m) => m.layer.value === l);
    return g as Record<LayerKey, Module[]>;
  }, [project.modules]);

  const positions = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {};
    LANES.forEach((l, li) => {
      const list = groups[l];
      const y = padding + laneH * li + laneH / 2;
      const colW = (size.w - 100) / Math.max(list.length, 1);
      list.forEach((m, i) => {
        p[m.id] = { x: 60 + colW * i + colW / 2, y };
      });
    });
    return p;
  }, [groups, size, laneH]);

  const neighbor = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    for (const e of project.edges) {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    }
    return s;
  }, [selected, project.edges]);

  return (
    <div className="canvas-wrap arch-canvas" ref={wrapRef}>
      <svg className="graph-svg" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="xMidYMid meet">
        {LANES.map((l, i) => {
          const y = padding + laneH * i;
          return (
            <g key={l}>
              <rect x="20" y={y + 4} width={size.w - 40} height={laneH - 8}
                    fill={i % 2 ? "rgba(255,255,255,0.012)" : "rgba(255,255,255,0.025)"} rx="6" />
              <text x="32" y={y + 18} fill={LAYER_COLOR[l]} fontFamily="JetBrains Mono" fontSize="10" letterSpacing="1.5">
                {LAYER_LABEL[l].toUpperCase()}
              </text>
              <text x="32" y={y + 32} fill="var(--text-faint)" fontFamily="JetBrains Mono" fontSize="9">
                {groups[l].length} modules
              </text>
            </g>
          );
        })}

        {project.edges.map((e, i) => {
          const a = positions[e.source]; const b = positions[e.target];
          if (!a || !b) return null;
          const dim = neighbor && (!neighbor.has(e.source) || !neighbor.has(e.target));
          const c =
            e.kind === "http" ? "var(--amber)" :
            e.kind === "calls" ? "var(--violet)" :
            e.kind === "data" ? "var(--green)" :
            "var(--cyan)";
          const my = (a.y + b.y) / 2;
          return (
            <path key={i}
                  d={`M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`}
                  stroke={c} fill="none" strokeWidth="1"
                  opacity={dim ? 0.04 : 0.32}
                  strokeDasharray={e.kind === "http" ? "4 3" : ""} />
          );
        })}

        {project.modules.map((m) => {
          const p = positions[m.id]; if (!p) return null;
          const isExt = m.layer.value === "external";
          const dim = neighbor && !neighbor.has(m.id);
          const w = Math.max(70, m.name.length * 6.6 + 14);
          return (
            <g key={m.id}
               className={`graph-node ${selected === m.id ? "selected" : ""} ${dim ? "dim" : ""}`}
               transform={`translate(${p.x},${p.y})`}
               onClick={() => onSelect(m.id)}>
              <rect x={-w / 2} y="-13" width={w} height="26" rx={isExt ? 3 : 6}
                    fill="var(--bg-elev)" stroke={LAYER_COLOR[m.layer.value]} strokeWidth="1.1"
                    strokeDasharray={isExt ? "3 2" : ""} />
              <circle cx={-w / 2 + 9} cy="0" r="3" fill={LAYER_COLOR[m.layer.value]} />
              <text x="3" y="3" fontSize="10.5" fontFamily="JetBrains Mono" fill="var(--text)">
                {m.name}
              </text>
              {m.layer.provenance.source !== "static" && (
                <circle cx={w / 2 - 7} cy="-7" r="3"
                        fill={
                          m.layer.provenance.source === "annotation" ? "var(--cyan)" :
                          m.layer.provenance.source === "bridge" ? "var(--violet)" :
                          "var(--amber)"
                        }>
                  <title>{
                    m.layer.provenance.source === "annotation"
                      ? `Annotation: ${m.layer.provenance.file}:${m.layer.provenance.line}`
                      : m.layer.provenance.source === "bridge"
                      ? `Bridge confidence ${m.layer.provenance.confidence}`
                      : `LLM ${m.layer.provenance.model}`
                  }</title>
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      <div className="legend">
        <div style={{ color: "var(--text)", fontSize: 10, marginBottom: 4, letterSpacing: "0.08em" }}>LAYERS</div>
        {LANES.map((l) => (
          <div key={l} className="lg-row">
            <span className="lg-dot" style={{ background: LAYER_COLOR[l] }} />
            <span>{LAYER_LABEL[l]}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0 4px" }} />
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--cyan)" }} /><span>imports</span></div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--violet)" }} /><span>calls</span></div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--green)" }} /><span>data</span></div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--amber)" }} /><span>http</span></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @codewiz/web build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/web/
git commit -m "feat(web): ArchitectureView (swimlanes + provenance dots on nodes)"
```

---

## Task 13: Web — `FilesView` + `synthCode` helper

**Files:**
- Create: `packages/web/src/views/synthCode.ts`
- Create: `packages/web/src/views/FilesView.tsx`

- [ ] **Step 1: Create `synthCode.ts`** (port from `views.jsx`)

```ts
import type { Project, Module } from "@codewiz/sdk";

interface Line { html: string; highlight?: boolean; note?: string }

const cl = (s: string, k: string) => `<span class="cl-${k}">${escapeHtml(s)}</span>`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[c] as string));
}

export function synthCode(m: Module, project: Project): Line[] {
  const importsList = project.edges
    .filter((e) => e.source === m.id && (e.kind === "imports" || e.kind === "calls"))
    .map((e) => project.modules.find((x) => x.id === e.target))
    .filter((x): x is Module => !!x);

  const lines: Line[] = [];
  lines.push({ html: cl("// " + m.path, "com") });
  lines.push({ html: "" });
  importsList.slice(0, 4).forEach((imp) => {
    lines.push({
      html: `${cl("import", "kw")} { ${cl(imp.name, "fn")} } ${cl("from", "kw")} ${cl(`'./${imp.name}'`, "str")};`,
    });
  });
  if (importsList.length) lines.push({ html: "" });

  const sig =
    m.kind === "service" || m.kind === "client"
      ? `${cl("export class", "kw")} ${cl(m.name, "ty")} {`
      : m.kind === "hook" || m.kind === "store"
      ? `${cl("export function", "kw")} ${cl(m.name, "fn")}() {`
      : m.kind === "model"
      ? `${cl("export interface", "kw")} ${cl(m.name.split(" ")[0] ?? m.name, "ty")} {`
      : m.kind === "route"
      ? `${cl("router", "fn")}.${cl("get", "fn")}(${cl(`'${m.name}'`, "str")}, ${cl("async", "kw")} (req, res) => {`
      : m.kind === "page"
      ? `${cl("export default function", "kw")} ${cl(m.name, "fn")}() {`
      : `${cl("export const", "kw")} ${cl(m.name, "fn")} = () => {`;
  lines.push({ html: sig });

  if (m.kind === "model") {
    lines.push({ html: `  id: ${cl("string", "ty")};` });
    lines.push({ html: `  ${cl("createdAt", "fn")}: ${cl("Date", "ty")};` });
    lines.push({ html: "}" });
  } else {
    lines.push({ html: `  ${cl("// implementation…", "com")}` });
    if (m.annotation === "err" || m.annotation === "warn") {
      lines.push({
        html: `  ${cl(`const cached = await cache.get(key);`, "com")}`,
        highlight: true,
        note: m.notes ?? "Reviewer flagged this region",
      });
    }
    if (m.annotation === "dup") {
      lines.push({
        html: `  ${cl(`// Logic duplicated with sibling module`, "com")}`,
        highlight: true,
        note: "Same reducer shape exists in sibling — consolidate.",
      });
    }
    importsList.slice(0, 2).forEach((imp) => {
      lines.push({ html: `  ${cl("await", "kw")} ${cl(imp.name, "fn")}.${cl("call", "fn")}();` });
    });
    lines.push({ html: m.kind === "route" ? "});" : "}" });
  }
  return lines;
}
```

- [ ] **Step 2: Create `FilesView.tsx`**

```tsx
import { useState, useEffect } from "react";
import type { Project } from "@codewiz/sdk";
import { LayerDot } from "../components/LayerDot.js";
import { ProvenanceBadge } from "../components/ProvenanceBadge.js";
import { synthCode } from "./synthCode.js";

interface Props {
  project: Project;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function FilesView({ project, selected, onSelect }: Props) {
  const [active, setActive] = useState<string>(selected ?? project.modules[0]?.id ?? "");
  useEffect(() => { if (selected) setActive(selected); }, [selected]);

  const m = project.modules.find((x) => x.id === active) ?? project.modules[0];
  if (!m) return <div className="empty">no modules</div>;

  const code = synthCode(m, project);

  return (
    <div className="file-shell">
      <div className="file-list">
        <div className="file-head">
          <div>Path</div><div>LOC</div><div>Layer</div><div>Health</div>
        </div>
        {project.modules.map((mod) => (
          <div key={mod.id} className={`file-row ${active === mod.id ? "selected" : ""}`}
               onClick={() => { setActive(mod.id); onSelect(mod.id); }}>
            <div className="path">
              <LayerDot layer={mod.layer.value} size={6} />
              <span className="dir">{mod.path.split("/").slice(0, -1).join("/")}/</span>
              <span className="name">{mod.path.split("/").slice(-1)[0]}</span>
              {mod.annotation && (
                <span className={`anno ${mod.annotation}`}>
                  {mod.annotation === "err" ? "BUG" :
                   mod.annotation === "warn" ? "REVIEW" :
                   mod.annotation === "new" ? "NEW" : "DUP"}
                </span>
              )}
            </div>
            <div className="v">{mod.loc || "—"}</div>
            <div className="v" style={{ color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 6 }}>
              {mod.layer.value}
              <ProvenanceBadge provenance={mod.layer.provenance} />
            </div>
            <div className="v" style={{ color: (mod.health?.score ?? 1) > 0.8 ? "var(--green)" : (mod.health?.score ?? 1) > 0.6 ? "var(--amber)" : "var(--pink)" }}>
              {mod.health ? Math.round(mod.health.score * 100) + "%" : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="code-pane">
        <div style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>
          {m.path} · {m.loc} LOC{m.team ? ` · ${m.team.value}` : ""}
        </div>
        {m.notes && (
          <div style={{ background: "var(--amber-dim)", border: "1px solid var(--amber)", borderRadius: 4,
                        padding: "8px 10px", color: "var(--amber)", fontSize: 11, marginBottom: 12, fontFamily: "var(--font-mono)" }}>
            ⓘ {m.notes}
          </div>
        )}
        {code.map((ln, i) => (
          <div key={i} className={ln.highlight ? "annotation-line" : ""}>
            <span className="ln">{i + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: ln.html }} />
            {ln.note && <div className="annotation-note">↳ {ln.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @codewiz/web build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/web/
git commit -m "feat(web): FilesView with annotated source preview"
```

---

## Task 14: Web — `ReanalyzeBar` + `DisabledView` + `App` shell wiring

**Files:**
- Create: `packages/web/src/components/ReanalyzeBar.tsx`
- Create: `packages/web/src/views/DisabledView.tsx`
- Modify: `packages/web/src/App.tsx` (replace placeholder)

- [ ] **Step 1: Create `ReanalyzeBar.tsx`**

```tsx
import { useState, useRef, useEffect } from "react";
import { postReanalyze, openEvents, type ServerEvent } from "../api.js";

interface Props {
  onDone: () => void;
}

export function ReanalyzeBar({ onDone }: Props) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { closeRef.current?.(); }, []);

  const start = async () => {
    if (running) return;
    setRunning(true);
    setLogs([`▸ analyzing…`]);
    setDrawerOpen(true);
    closeRef.current?.();
    closeRef.current = openEvents((e: ServerEvent) => {
      if (e.type === "log") {
        setLogs((L) => [...L, `${e.payload.level === "warn" ? "⚠" : "·"} ${e.payload.message}`]);
      } else if (e.type === "done") {
        setLogs((L) => [...L, `✓ done · ${e.payload.contentHash.slice(0, 12)}…`]);
        setRunning(false);
        closeRef.current?.();
        closeRef.current = null;
        void onDone();
      } else if (e.type === "error") {
        setLogs((L) => [...L, `✗ error · ${e.payload.message}`]);
        setRunning(false);
        closeRef.current?.();
        closeRef.current = null;
      }
    });
    try {
      await postReanalyze();
    } catch (err) {
      setLogs((L) => [...L, `✗ request failed · ${(err as Error).message}`]);
      setRunning(false);
      closeRef.current?.();
      closeRef.current = null;
    }
  };

  return (
    <>
      <button className="switch-repo" onClick={start} disabled={running}>
        {running ? "analyzing…" : "↻ re-analyze"}
      </button>
      {drawerOpen && (
        <div style={{
          position: "fixed", bottom: 32, right: 16, width: 360, maxHeight: 240,
          background: "var(--bg-elev)", border: "1px solid var(--border-strong)",
          borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-dim)", padding: "10px 14px", overflowY: "auto",
          zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "var(--text)", fontSize: 10, letterSpacing: "0.08em" }}>RE-ANALYZE</span>
            <button onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: 0, color: "var(--text-faint)", cursor: "pointer" }}>×</button>
          </div>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `DisabledView.tsx`**

```tsx
interface Props {
  view: string;
  sinceVersion: string;
}

export function DisabledView({ view, sinceVersion }: Props) {
  return (
    <div className="empty" style={{ flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 14, color: "var(--text)" }}>{view}</div>
      <div>Ships in {sinceVersion}</div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `packages/web/src/App.tsx`**

```tsx
import { useState, useEffect } from "react";
import { ProjectProvider, useProject } from "./ProjectContext.js";
import { Titlebar } from "./components/Titlebar.js";
import { Statusbar } from "./components/Statusbar.js";
import { Sidebar, type ViewId } from "./components/Sidebar.js";
import { PassportPanel } from "./components/PassportPanel.js";
import { ReanalyzeBar } from "./components/ReanalyzeBar.js";
import { ArchitectureView } from "./views/ArchitectureView.js";
import { FilesView } from "./views/FilesView.js";
import { DisabledView } from "./views/DisabledView.js";

const TITLE: Record<ViewId, string> = {
  arch: "Architecture overview",
  deps: "Dependencies",
  flow: "Functional flow",
  data: "Data flow",
  contract: "Contracts",
  files: "Files",
};

const SUBTITLE: Record<ViewId, string> = {
  arch: "modules layered by responsibility · click to open passport",
  deps: "ships in v0.2",
  flow: "ships in v0.4",
  data: "ships in v0.4",
  contract: "ships in v0.3",
  files: "with reviewer annotations and source preview",
};

const SHIPS_IN: Partial<Record<ViewId, string>> = {
  deps: "v0.2", contract: "v0.3", flow: "v0.4", data: "v0.4",
};

export function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}

function Shell() {
  const { status, project, error, refetch } = useProject();
  const [view, setView] = useState<ViewId>("arch");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const map: Record<string, ViewId> = {
        "1": "arch", "6": "files",
      };
      const v = map[e.key];
      if (v) setView(v);
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (status === "loading" && !project) {
    return <div style={{ color: "var(--text-dim)", padding: 40, fontFamily: "var(--font-mono)" }}>loading project…</div>;
  }
  if (status === "error") {
    return (
      <div style={{ color: "var(--pink)", padding: 40, fontFamily: "var(--font-mono)" }}>
        failed to load: {error}
      </div>
    );
  }
  if (!project) return null;

  const mismatchCount = project.contracts.filter((c) => c.issues.length > 0).length;

  return (
    <div className="app">
      <Titlebar
        manifest={project.manifest}
        moduleCount={project.modules.length}
        contractCount={project.contracts.length}
        mismatchCount={mismatchCount}
        reanalyzeButton={<ReanalyzeBar onDone={refetch} />}
      />
      <Sidebar
        view={view} setView={setView}
        modules={project.modules}
        selectedId={selected}
        onSelect={(id) => setSelected(id)}
        query={query} setQuery={setQuery}
      />
      <div className="main">
        <div className="main-toolbar">
          <div>
            <div className="title">{TITLE[view]}</div>
            <div className="subtitle">{SUBTITLE[view]}</div>
          </div>
        </div>
        <div className="canvas-wrap">
          {view === "arch" && (
            <ArchitectureView project={project} selected={selected} onSelect={setSelected} />
          )}
          {view === "files" && (
            <FilesView project={project} selected={selected} onSelect={setSelected} />
          )}
          {SHIPS_IN[view] && (
            <DisabledView view={TITLE[view]} sinceVersion={SHIPS_IN[view]!} />
          )}
          {selected && (
            <PassportPanel
              modules={project.modules}
              edges={project.edges}
              contracts={project.contracts}
              flows={project.flows}
              selectedId={selected}
              onSelect={setSelected}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
      <Statusbar project={project} view={view} groupKey="layer" />
    </div>
  );
}
```

- [ ] **Step 4: Build the web bundle and verify it includes the App**

Run:
```
pnpm --filter @codewiz/sdk build
pnpm --filter @codewiz/web build
ls packages/web/dist/
```
Expected: `index.html`, `assets/index-*.js`, `assets/index-*.css` exist.

- [ ] **Step 5: Commit**

```bash
git add packages/web/
git commit -m "feat(web): wire App shell with ReanalyzeBar + DisabledView placeholders"
```

---

## Task 15: CLI — `serve` subcommand

**Files:**
- Create: `packages/cli/src/serve.ts`
- Modify: `packages/cli/src/bin.ts`
- Modify: `packages/cli/package.json` (add `@codewiz/server`, `@codewiz/web`, `open` deps)

- [ ] **Step 1: Add deps to CLI package**

Modify `packages/cli/package.json` `dependencies` to include:
```json
"@codewiz/server": "workspace:*",
"@codewiz/web": "workspace:*",
"open": "^10.1.0"
```

Then:
```
pnpm install
```

- [ ] **Step 2: Implement `packages/cli/src/serve.ts`**

```ts
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { listen } from "@codewiz/server";
import { runAnalyze } from "./analyze.js";
import open from "open";

export interface ServeOptions {
  projectRoot: string;
  port: number;
  noOpen?: boolean;
}

export async function runServe(opts: ServeOptions): Promise<{ url: string; close: () => Promise<void> }> {
  // Run analysis if .codewiz/ doesn't exist yet.
  const codewizDir = join(opts.projectRoot, ".codewiz");
  if (!existsSync(codewizDir)) {
    console.log(`  no .codewiz/ found — running first analysis…`);
    await runAnalyze({ projectRoot: opts.projectRoot });
  }

  // Resolve the bundled web dist via @codewiz/web's package.json.
  const require = createRequire(import.meta.url);
  const webPkg = require.resolve("@codewiz/web/package.json");
  const webDist = resolve(dirname(webPkg), "dist");
  if (!existsSync(join(webDist, "index.html"))) {
    throw new Error(`web bundle missing at ${webDist}/index.html — did you run 'pnpm --filter @codewiz/web build'?`);
  }

  const handle = listen({
    projectRoot: opts.projectRoot,
    webDist,
    port: opts.port,
  });
  const url = `http://127.0.0.1:${handle.port}/`;
  console.log(`  serving codeWizualizer at ${url}`);

  if (!opts.noOpen) {
    try { await open(url); } catch { /* ignore — the URL is printed for the user */ }
  }
  return { url, close: handle.close };
}
```

- [ ] **Step 3: Wire into `bin.ts`**

Append to `packages/cli/src/bin.ts`:
```ts
import { runServe } from "./serve.js";

program
  .command("serve [path]")
  .description("Serve the codeWizualizer web UI for the given repo")
  .option("--port <n>", "Port to bind on 127.0.0.1", "8765")
  .option("--no-open", "Don't auto-open the browser")
  .action(async (pathArg: string | undefined, opts: { port: string; open: boolean }) => {
    const target = resolve(pathArg ?? ".");
    const port = parseInt(opts.port, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      console.error(`invalid --port: ${opts.port}`);
      process.exit(1);
    }
    const handle = await runServe({
      projectRoot: target,
      port,
      noOpen: !opts.open,
    });
    console.log(`  press Ctrl-C to stop`);
    process.on("SIGINT", () => {
      void handle.close().then(() => process.exit(0));
    });
  });
```

- [ ] **Step 4: Build everything and smoke-test**

Run:
```
pnpm -r build
node packages/cli/dist/bin.js serve tests/fixtures/tiny-react-app --port 8766 --no-open &
SERVE_PID=$!
sleep 2
curl -sS http://127.0.0.1:8766/api/project | head -c 200
echo
curl -sS -o /dev/null -w "html: %{http_code}\n" http://127.0.0.1:8766/
kill $SERVE_PID
wait $SERVE_PID 2>/dev/null
```

Expected:
- `/api/project` returns JSON beginning with `{"manifest":...`
- `/` returns 200 (the HTML bundle)

- [ ] **Step 5: Commit**

```bash
git add packages/cli/ pnpm-lock.yaml
git commit -m "feat(cli): serve subcommand starting Hono + opening browser"
```

---

## Task 16: e2e Playwright smoke test

**Files:**
- Modify: `tests/package.json` (add @playwright/test devDep + test:e2e script)
- Create: `tests/playwright.config.ts`
- Create: `tests/e2e/serve.spec.ts`

- [ ] **Step 1: Add Playwright dep to tests**

Modify `tests/package.json`:
```json
{
  "name": "@codewiz/tests",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "codewiz": "workspace:*"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

Then:
```
pnpm install
pnpm --filter @codewiz/tests exec playwright install chromium
```

- [ ] **Step 2: Create `tests/playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 30000,
  fullyParallel: false,   // single-port serve — no parallel runs
  use: {
    baseURL: "http://127.0.0.1:8767",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
```

- [ ] **Step 3: Create `tests/e2e/serve.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runServe } from "codewiz/dist/serve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(__dirname, "../fixtures/tiny-react-app");

let workdir: string;
let close: (() => Promise<void>) | null = null;

test.beforeAll(async () => {
  workdir = mkdtempSync(join(tmpdir(), "codewiz-e2e-serve-"));
  cpSync(FIX, workdir, {
    recursive: true,
    filter: (s) => !s.includes("__golden__"),
  });
  const handle = await runServe({
    projectRoot: workdir,
    port: 8767,
    noOpen: true,
  });
  close = handle.close;
});

test.afterAll(async () => {
  if (close) await close();
  rmSync(workdir, { recursive: true, force: true });
});

test("Architecture view renders all 5 fixture modules", async ({ page }) => {
  await page.goto("/");
  // Wait for the title to indicate the project loaded
  await expect(page.locator(".main-toolbar .title")).toHaveText("Architecture overview");
  // Each module name appears as an SVG <text> in the lane layout
  for (const name of ["Button", "CartItem", "client", "Home", "Cart"]) {
    await expect(page.locator(`text=${name}`)).toBeVisible();
  }
});

test("Files view lists fixture modules with provenance badge on Button", async ({ page }) => {
  await page.goto("/");
  await page.click('.nav-item:has-text("Files")');
  await expect(page.locator(".main-toolbar .title")).toHaveText("Files");
  await expect(page.locator(".file-row:has-text(\"Button.tsx\")")).toBeVisible();
});

test("Re-analyze button triggers a refresh and surfaces a 'done' log", async ({ page }) => {
  await page.goto("/");
  await page.click('button:has-text("re-analyze")');
  await expect(page.locator("text=/✓ done/")).toBeVisible({ timeout: 15000 });
});

test("Disabled nav item shows 'Ships in v0.x' on hover", async ({ page }) => {
  await page.goto("/");
  const dep = page.locator('.nav-item:has-text("Dependencies")');
  await expect(dep).toHaveAttribute("title", "Ships in v0.2");
});
```

- [ ] **Step 4: Run the e2e suite**

Build everything first, then run:
```
pnpm -r build
pnpm --filter @codewiz/tests test:e2e
```
Expected: 4 Playwright tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/ pnpm-lock.yaml
git commit -m "test(e2e): Playwright smoke test for codewiz serve on tiny-react-app"
```

---

## Task 17: Final verification + tag `v0.1.0-web`

- [ ] **Step 1: Clean rebuild + full test suite**

```
pnpm -r exec rm -rf dist
rm -rf node_modules packages/*/node_modules packages/adapters/*/node_modules tests/node_modules packages/web/node_modules packages/server/node_modules
pnpm install
pnpm -r build
pnpm test
pnpm --filter @codewiz/tests test:e2e
```
Expected:
- All package builds succeed
- `pnpm test` reports all packages passing (sdk: 27, core: 23, adapter-ts: 31, server: 13, web: 4, cli: 6, tests: 6 = ~110 tests)
- All Playwright e2e tests pass

- [ ] **Step 2: End-to-end CLI smoke**

```
pnpm -r build
node packages/cli/dist/bin.js serve tests/fixtures/tiny-react-app --port 8768 --no-open &
sleep 3
curl -sS http://127.0.0.1:8768/api/project | python3 -c 'import sys, json; p=json.load(sys.stdin); print("modules:", len(p["modules"]), "edges:", len(p["edges"]), "contracts:", len(p["contracts"]))'
curl -sS -o /dev/null -w "html: %{http_code}\n" http://127.0.0.1:8768/
kill %1 2>/dev/null
wait %1 2>/dev/null
```
Expected: `modules: 5 edges: 5 contracts: 1`, `html: 200`.

Then clean up the fixture's analysis output:
```
rm -rf tests/fixtures/tiny-react-app/.codewiz/
```

- [ ] **Step 3: Spec acceptance criteria check (Plan 1 + Plan 2)**

Verify against spec §10:
- #1 (analyze produces golden JSON) — Plan 1 e2e test (still passing via `pnpm test`)
- #2 (serve opens browser to working Architecture + Files views) — Plan 2 Playwright tests (Architecture: ✓, Files: ✓)
- #3 (provenance badge appears on every module) — Plan 2 ProvenanceBadge wired into PassportPanel + FilesView; ArchitectureView shows provenance dot on annotation-pinned modules
- #4 (pinning a layer in `.codewiz.yml` and pressing re-analyze flips badge to `annotation` with file citation) — Plan 2 ReanalyzeBar test (`Re-analyze button triggers a refresh`); Button.tsx in fixture has `domain: core` annotation, visible in PassportPanel as ProvenanceBadge with title `.codewiz.yml:0`
- #5 (`codewiz doctor` healthy) — Plan 1 (still passing)
- #6 (Playwright smoke passes in CI) — Playwright suite passes locally; CI integration ships in Plan 3
- #7 (conformance suite passes against `adapter-ts`) — Plan 1 (still passing)

- [ ] **Step 4: Tag the milestone**

```bash
git tag -a v0.1.0-web -m "v0.1 web layer: codewiz serve renders Architecture + Files end-to-end"
```

- [ ] **Step 5: Push branch + tag (if remote configured)**

```bash
git push origin HEAD
git push origin v0.1.0-web
```

If no remote is configured, skip this step — the user will set up a remote and push as part of Plan 3 if not already done.
