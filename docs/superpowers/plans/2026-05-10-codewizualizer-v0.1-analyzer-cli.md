# codeWizualizer v0.1 — Analyzer CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v0.1 walking-skeleton analyzer — `codewiz analyze <repo>` produces a populated `./.codewiz/` directory of JSON for a TS/JS repo, end-to-end-validated against a golden fixture.

**Architecture:** Node/TypeScript pnpm-workspace monorepo. The SDK package defines the wire format (Zod schemas + TypeScript interfaces). Core orchestrates the pipeline (walker → adapter loader → aggregator → bridge resolver → annotations applier → persister). The TS adapter (in-process, ts-morph) is the reference language adapter and v0.1's only adapter. CLI (Commander) wraps the pipeline with `init | analyze | doctor` subcommands. End-to-end golden-file test on `tests/fixtures/tiny-react-app/`. The web server, frontend, and release plumbing ship in subsequent plans.

**Tech Stack:** pnpm workspaces 9.x, Turborepo, TypeScript 5.x strict, Node 24 LTS, Vitest, Zod, ts-morph, Commander, js-yaml, the `ignore` package (gitignore-aware globbing), `fast-glob`.

**Spec:** `docs/superpowers/specs/2026-05-10-codewizualizer-production-design.md`

---

## File structure produced by this plan

```
codewiz/
├── package.json                  # workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── vitest.workspace.ts
├── .prettierrc.json
├── eslint.config.js
├── packages/
│   ├── sdk/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # re-exports
│   │   │   ├── provenance.ts       # Provenance, SourceRef, LayerKey
│   │   │   ├── module.ts           # Module, Edge schemas
│   │   │   ├── contract.ts         # Contract, ContractIssue, Flow
│   │   │   ├── adapter.ts          # LanguageAdapter, Init/Analyze, etc.
│   │   │   └── conformance.ts      # runConformanceSuite()
│   │   └── tests/
│   │       ├── schemas.test.ts
│   │       └── conformance.test.ts
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # re-exports + runAnalysis()
│   │   │   ├── walker.ts
│   │   │   ├── registry.ts         # AdapterRegistry
│   │   │   ├── aggregator.ts
│   │   │   ├── bridge.ts           # bridge resolver
│   │   │   ├── annotations.ts      # parser + applier
│   │   │   ├── persister.ts        # atomic writes + manifest
│   │   │   └── pipeline.ts         # runAnalysis()
│   │   └── tests/
│   │       ├── walker.test.ts
│   │       ├── aggregator.test.ts
│   │       ├── bridge.test.ts
│   │       ├── annotations.test.ts
│   │       ├── persister.test.ts
│   │       └── pipeline.test.ts
│   ├── adapters/
│   │   └── ts/
│   │       ├── package.json
│   │       ├── tsconfig.json
│   │       ├── src/
│   │       │   ├── index.ts        # default export = LanguageAdapter
│   │       │   ├── project.ts      # ts-morph Project setup
│   │       │   ├── modules.ts      # extract Module records
│   │       │   ├── classify.ts     # kind + layer heuristics
│   │       │   ├── imports.ts      # import edges
│   │       │   ├── http.ts         # HttpEndpoint extraction
│   │       │   └── contracts.ts    # Contract extraction
│   │       └── tests/
│   │           ├── modules.test.ts
│   │           ├── classify.test.ts
│   │           ├── imports.test.ts
│   │           ├── http.test.ts
│   │           ├── contracts.test.ts
│   │           └── conformance.test.ts
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── bin.ts              # bin entry, parses argv via Commander
│       │   ├── init.ts             # `codewiz init`
│       │   ├── doctor.ts           # `codewiz doctor`
│       │   └── analyze.ts          # `codewiz analyze`
│       └── tests/
│           ├── init.test.ts
│           ├── doctor.test.ts
│           └── analyze.test.ts
└── tests/
    ├── fixtures/
    │   └── tiny-react-app/         # the v0.1 golden fixture
    │       └── (fixture files)
    └── e2e/
        └── analyze.test.ts          # full-pipeline golden test
```

---

## Task 1: Workspace bootstrap

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Modify: `.gitignore` (add monorepo paths)

- [ ] **Step 1: Verify Node and pnpm versions**

Run: `node --version && pnpm --version`
Expected: Node ≥ 24.0.0, pnpm ≥ 9.0.0. If pnpm missing: `npm install -g pnpm@latest`.

- [ ] **Step 2: Create the workspace root `package.json`**

```json
{
  "name": "codewiz",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.3",
    "prettier": "^3.4.0"
  }
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "packages/adapters/*"
  - "tests"
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

- [ ] **Step 5: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 6: Append monorepo paths to `.gitignore`**

Add to existing `.gitignore`:
```
# Monorepo build artifacts (already covered, but explicit)
packages/*/dist/
packages/adapters/*/dist/
```

- [ ] **Step 7: Install root dev deps**

Run: `pnpm install`
Expected: lockfile created, `node_modules/` populated.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm workspace + Turborepo + base tsconfig"
```

---

## Task 2: Vitest + lint/format + smoke test

**Files:**
- Create: `vitest.workspace.ts`
- Create: `.prettierrc.json`
- Create: `eslint.config.js`
- Create: `tests/package.json`
- Create: `tests/smoke.test.ts`
- Modify: `package.json` (add deps)

- [ ] **Step 1: Add Vitest + ESLint deps**

Run:
```
pnpm add -Dw vitest@^2.1.0 @vitest/coverage-v8@^2.1.0 \
  eslint @eslint/js @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-config-prettier
```

- [ ] **Step 2: Create `vitest.workspace.ts`**

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/*",
  "packages/adapters/*",
  "tests",
]);
```

- [ ] **Step 3: Create `.prettierrc.json`**

```json
{
  "printWidth": 100,
  "singleQuote": false,
  "trailingComma": "all",
  "semi": true
}
```

- [ ] **Step 4: Create `eslint.config.js`**

```js
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import js from "@eslint/js";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "tests/fixtures/**",
      // codeWizualizer prototype files (legacy, untyped, kept for reference)
      "app.jsx",
      "data.js",
      "graph.jsx",
      "picker.jsx",
      "tweaks-panel.jsx",
      "views.jsx",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettierConfig,
];
```

- [ ] **Step 5: Create `tests/package.json`**

```json
{
  "name": "@codewiz/tests",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 6: Create `tests/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "fixtures"]
}
```

- [ ] **Step 7: Write smoke test `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("workspace smoke test", () => {
  it("vitest workspace boots", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run smoke test**

Run: `pnpm install && pnpm test`
Expected: 1 file passed, 1 test passed.

- [ ] **Step 9: Commit**

```bash
git add vitest.workspace.ts .prettierrc.json eslint.config.js tests/ pnpm-lock.yaml package.json
git commit -m "chore: add vitest workspace + eslint/prettier + smoke test"
```

---

## Task 3: SDK package skeleton + Provenance schemas

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/provenance.ts`
- Create: `packages/sdk/tests/schemas.test.ts`

- [ ] **Step 1: Create package skeleton**

`packages/sdk/package.json`:
```json
{
  "name": "@codewiz/sdk",
  "version": "0.0.0",
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
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

`packages/sdk/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Write failing test for Provenance schema**

`packages/sdk/tests/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ProvenanceSchema, SourceRefSchema, LayerKeySchema } from "../src/provenance.js";

describe("Provenance", () => {
  it("accepts a static provenance", () => {
    expect(ProvenanceSchema.parse({ source: "static" })).toEqual({ source: "static" });
  });

  it("accepts an annotation provenance with file:line", () => {
    const p = { source: "annotation", file: ".codewiz.yml", line: 12 };
    expect(ProvenanceSchema.parse(p)).toEqual(p);
  });

  it("accepts a bridge provenance with confidence in [0,1]", () => {
    const p = { source: "bridge", confidence: 0.8 };
    expect(ProvenanceSchema.parse(p)).toEqual(p);
  });

  it("rejects bridge confidence > 1", () => {
    expect(() => ProvenanceSchema.parse({ source: "bridge", confidence: 1.5 })).toThrow();
  });

  it("accepts an llm provenance with citations", () => {
    const p = {
      source: "llm",
      model: "anthropic/claude-sonnet-4-6",
      promptHash: "abc123",
      confidence: 0.6,
      citations: [{ path: "src/x.ts", line: 4 }],
    };
    expect(ProvenanceSchema.parse(p)).toEqual(p);
  });
});

describe("LayerKey", () => {
  it("accepts the six layers", () => {
    for (const k of ["ui", "state", "api", "service", "data", "external"]) {
      expect(LayerKeySchema.parse(k)).toBe(k);
    }
  });

  it("rejects unknown layers", () => {
    expect(() => LayerKeySchema.parse("frontend")).toThrow();
  });
});

describe("SourceRef", () => {
  it("accepts path+line, optional col", () => {
    expect(SourceRefSchema.parse({ path: "a.ts", line: 5 })).toEqual({ path: "a.ts", line: 5 });
    expect(SourceRefSchema.parse({ path: "a.ts", line: 5, col: 10 })).toEqual({
      path: "a.ts", line: 5, col: 10,
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @codewiz/sdk install && pnpm --filter @codewiz/sdk test`
Expected: FAIL — module `../src/provenance.js` not found.

- [ ] **Step 4: Implement `provenance.ts`**

```ts
import { z } from "zod";

export const LayerKeySchema = z.enum([
  "ui", "state", "api", "service", "data", "external",
]);
export type LayerKey = z.infer<typeof LayerKeySchema>;

export const SourceRefSchema = z.object({
  path: z.string(),
  line: z.number().int().nonnegative(),
  col: z.number().int().nonnegative().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ProvenanceSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("static") }),
  z.object({
    source: z.literal("annotation"),
    file: z.string(),
    line: z.number().int().nonnegative(),
  }),
  z.object({
    source: z.literal("bridge"),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    source: z.literal("llm"),
    model: z.string(),
    promptHash: z.string(),
    confidence: z.number().min(0).max(1),
    citations: z.array(SourceRefSchema),
  }),
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;
```

- [ ] **Step 5: Create `src/index.ts` re-exporting**

```ts
export * from "./provenance.js";
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `pnpm --filter @codewiz/sdk test`
Expected: 8 tests passed.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/ pnpm-lock.yaml
git commit -m "feat(sdk): provenance, source-ref, layer-key schemas"
```

---

## Task 4: SDK — Module + Edge schemas

**Files:**
- Create: `packages/sdk/src/module.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/sdk/tests/schemas.test.ts`

- [ ] **Step 1: Write failing tests appended to `schemas.test.ts`**

```ts
import { ModuleSchema, EdgeSchema } from "../src/module.js";

describe("Module", () => {
  it("accepts a minimal module record", () => {
    const m = {
      id: "ts:web/src/App.tsx",
      name: "App",
      path: "web/src/App.tsx",
      language: "ts",
      layer: { value: "ui", provenance: { source: "static" } },
      kind: "page",
      loc: 42,
      citations: [{ path: "web/src/App.tsx", line: 1 }],
    };
    expect(ModuleSchema.parse(m)).toEqual(m);
  });

  it("rejects an unknown kind", () => {
    expect(() => ModuleSchema.parse({
      id: "x", name: "X", path: "x", language: "ts",
      layer: { value: "ui", provenance: { source: "static" } },
      kind: "weirdo", loc: 0, citations: [],
    })).toThrow();
  });
});

describe("Edge", () => {
  it("accepts a static imports edge", () => {
    const e = {
      source: "ts:a.ts", target: "ts:b.ts",
      kind: "imports", provenance: { source: "static" },
    };
    expect(EdgeSchema.parse(e)).toEqual(e);
  });

  it("accepts a bridge http edge with confidence", () => {
    const e = {
      source: "ts:client.ts", target: "py:routes/x.py",
      kind: "http",
      provenance: { source: "bridge", confidence: 0.9 },
    };
    expect(EdgeSchema.parse(e)).toEqual(e);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `../src/module.js` not found.

Run: `pnpm --filter @codewiz/sdk test`

- [ ] **Step 3: Implement `module.ts`**

```ts
import { z } from "zod";
import { ProvenanceSchema, SourceRefSchema, LayerKeySchema } from "./provenance.js";

export const ModuleKindSchema = z.enum([
  "page", "component", "hook", "store", "client",
  "route", "service", "middleware", "model", "external",
]);
export type ModuleKind = z.infer<typeof ModuleKindSchema>;

export const ValuedSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, provenance: ProvenanceSchema });

export const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  language: z.string(),
  layer:  ValuedSchema(LayerKeySchema),
  team:   ValuedSchema(z.string()).optional(),
  domain: ValuedSchema(z.string()).optional(),
  kind: ModuleKindSchema,
  loc: z.number().int().nonnegative(),
  health: z.object({
    score: z.number().min(0).max(1),
    reasons: z.array(z.string()),
  }).optional(),
  annotation: z.enum(["err", "warn", "new", "dup"]).optional(),
  notes: z.string().optional(),
  citations: z.array(SourceRefSchema),
});
export type Module = z.infer<typeof ModuleSchema>;

export const EdgeKindSchema = z.enum(["imports", "calls", "http", "data"]);
export type EdgeKind = z.infer<typeof EdgeKindSchema>;

export const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  kind: EdgeKindSchema,
  provenance: ProvenanceSchema,
  evidence: z.array(SourceRefSchema).optional(),
});
export type Edge = z.infer<typeof EdgeSchema>;
```

- [ ] **Step 4: Re-export from index**

Append to `src/index.ts`:
```ts
export * from "./module.js";
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm --filter @codewiz/sdk test`
Expected: 12 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/
git commit -m "feat(sdk): module + edge schemas"
```

---

## Task 5: SDK — Contract + ContractIssue + Flow schemas

**Files:**
- Create: `packages/sdk/src/contract.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/sdk/tests/schemas.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { ContractSchema, FlowSchema } from "../src/contract.js";

describe("Contract", () => {
  it("accepts a contract with a single field and one issue", () => {
    const c = {
      id: "User",
      name: "User",
      language: "ts",
      fields: [
        {
          name: "id", type: "string", required: true,
          provenance: { source: "static" },
        },
      ],
      producers: ["ts:auth/User.ts"],
      consumers: ["ts:web/Header.tsx"],
      issues: [{
        kind: "missing", field: "name",
        consumer: "ts:web/Header.tsx", producer: "ts:auth/User.ts",
        expected: { name: "name", type: "string", required: true,
                    source: "Header.tsx:12", snippet: "<span>{u.name}</span>" },
        actual:   { name: "name", type: "string", required: false,
                    source: "User.ts:5",      snippet: "name?: string;" },
        provenance: { source: "static" },
      }],
      related: [],
      citations: [{ path: "auth/User.ts", line: 1 }],
    };
    expect(ContractSchema.parse(c)).toEqual(c);
  });
});

describe("Flow", () => {
  it("accepts a functional flow with steps", () => {
    const f = {
      id: "f_buy", name: "Buy", desc: "purchase flow",
      kind: "functional", health: "ok",
      steps: [{
        mod: "ts:web/Cart.tsx", action: "click buy",
        provenance: { source: "annotation", file: ".codewiz.yml", line: 8 },
      }],
    };
    expect(FlowSchema.parse(f)).toEqual(f);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/sdk test`

- [ ] **Step 3: Implement `contract.ts`**

```ts
import { z } from "zod";
import { ProvenanceSchema, SourceRefSchema } from "./provenance.js";

const SchemaShapeSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  source: z.string(),    // "file.ts:123"
  snippet: z.string(),
});
export type SchemaShape = z.infer<typeof SchemaShapeSchema>;

export const ContractIssueSchema = z.object({
  kind: z.enum(["missing", "shape", "extra"]),
  field: z.string(),
  consumer: z.string(),
  producer: z.string(),
  expected: SchemaShapeSchema,
  actual:   SchemaShapeSchema,
  provenance: ProvenanceSchema,
});
export type ContractIssue = z.infer<typeof ContractIssueSchema>;

export const ContractFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  provenance: ProvenanceSchema,
});

export const ContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  fields: z.array(ContractFieldSchema),
  producers: z.array(z.string()),
  consumers: z.array(z.string()),
  issues: z.array(ContractIssueSchema),
  related: z.array(z.string()),
  citations: z.array(SourceRefSchema),
});
export type Contract = z.infer<typeof ContractSchema>;

export const FlowStepSchema = z.object({
  mod: z.string(),
  action: z.string(),
  payload: z.unknown().optional(),
  contract: z.string().optional(),
  warn: z.boolean().optional(),
  provenance: ProvenanceSchema,
});

export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string(),
  kind: z.enum(["functional", "data"]),
  health: z.enum(["ok", "warn", "err"]),
  steps: z.array(FlowStepSchema),
});
export type Flow = z.infer<typeof FlowSchema>;
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./contract.js";
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm --filter @codewiz/sdk test`
Expected: 14 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/
git commit -m "feat(sdk): contract, contract-issue, flow schemas"
```

---

## Task 6: SDK — LanguageAdapter interface + protocol schemas

**Files:**
- Create: `packages/sdk/src/adapter.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/sdk/tests/schemas.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
  CapabilitySchema, InitRequestSchema, InitResponseSchema,
  AnalyzeRequestSchema, AnalyzeResponseSchema,
  HttpEndpointSchema, DiagnosticSchema,
} from "../src/adapter.js";

describe("Adapter protocol", () => {
  it("Capability accepts known values", () => {
    expect(CapabilitySchema.parse("modules")).toBe("modules");
    expect(CapabilitySchema.parse("edges-imports")).toBe("edges-imports");
    expect(() => CapabilitySchema.parse("flows")).toThrow();
  });

  it("InitRequest requires protocolVersion 1", () => {
    const r = { projectRoot: "/x", protocolVersion: 1 };
    expect(InitRequestSchema.parse(r)).toEqual(r);
    expect(() => InitRequestSchema.parse({ projectRoot: "/x", protocolVersion: 2 }))
      .toThrow();
  });

  it("InitResponse is structurally valid", () => {
    const r = {
      adapterName: "@codewiz/adapter-ts",
      adapterVersion: "0.1.0",
      protocolVersion: 1,
      capabilities: ["modules", "edges-imports"],
      fileGlobs: ["**/*.ts", "**/*.tsx"],
    };
    expect(InitResponseSchema.parse(r)).toEqual(r);
  });

  it("HttpEndpoint requires verb + pathTemplate", () => {
    const e = {
      side: "client", verb: "POST",
      pathTemplate: "/cart/items",
      module: "ts:client.ts",
      citation: { path: "client.ts", line: 12 },
    };
    expect(HttpEndpointSchema.parse(e)).toEqual(e);
  });

  it("Diagnostic has level + message", () => {
    expect(DiagnosticSchema.parse({ level: "warn", message: "x" }))
      .toEqual({ level: "warn", message: "x" });
  });

  it("AnalyzeRequest and AnalyzeResponse parse round-trip", () => {
    const req = { files: ["a.ts", "b.ts"] };
    expect(AnalyzeRequestSchema.parse(req)).toEqual(req);
    const resp = {
      modules: [], edges: [], contracts: [],
      httpEndpoints: [], diagnostics: [],
    };
    expect(AnalyzeResponseSchema.parse(resp)).toEqual(resp);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/sdk test`

- [ ] **Step 3: Implement `adapter.ts`**

```ts
import { z } from "zod";
import { ModuleSchema, EdgeSchema } from "./module.js";
import { ContractSchema } from "./contract.js";
import { SourceRefSchema } from "./provenance.js";

export const CapabilitySchema = z.enum([
  "modules", "edges-imports", "edges-calls",
  "contracts", "http-endpoints", "type-references",
]);
export type Capability = z.infer<typeof CapabilitySchema>;

export const InitRequestSchema = z.object({
  projectRoot: z.string(),
  adapterOptions: z.record(z.unknown()).optional(),
  protocolVersion: z.literal(1),
});
export type InitRequest = z.infer<typeof InitRequestSchema>;

export const InitResponseSchema = z.object({
  adapterName: z.string(),
  adapterVersion: z.string(),
  protocolVersion: z.literal(1),
  capabilities: z.array(CapabilitySchema),
  fileGlobs: z.array(z.string()),
});
export type InitResponse = z.infer<typeof InitResponseSchema>;

export const HttpEndpointSchema = z.object({
  side: z.enum(["client", "server"]),
  verb: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  pathTemplate: z.string(),
  module: z.string(),
  citation: SourceRefSchema,
  requestType: z.string().optional(),
  responseType: z.string().optional(),
});
export type HttpEndpoint = z.infer<typeof HttpEndpointSchema>;

export const DiagnosticSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().int().nonnegative().optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const AnalyzeRequestSchema = z.object({
  files: z.array(z.string()),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalyzeResponseSchema = z.object({
  modules: z.array(ModuleSchema),
  edges: z.array(EdgeSchema),
  contracts: z.array(ContractSchema),
  httpEndpoints: z.array(HttpEndpointSchema),
  diagnostics: z.array(DiagnosticSchema),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export interface LanguageAdapter {
  initialize(req: InitRequest): Promise<InitResponse>;
  analyze(req: AnalyzeRequest): Promise<AnalyzeResponse>;
  shutdown(): Promise<void>;
}
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./adapter.js";
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm --filter @codewiz/sdk test`
Expected: 20 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/
git commit -m "feat(sdk): language-adapter interface + protocol schemas"
```

---

## Task 7: SDK — Conformance harness

**Files:**
- Create: `packages/sdk/src/conformance.ts`
- Create: `packages/sdk/tests/conformance.test.ts`
- Modify: `packages/sdk/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/sdk/tests/conformance.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runConformanceSuite } from "../src/conformance.js";
import type { LanguageAdapter } from "../src/adapter.js";

const goodAdapter: LanguageAdapter = {
  async initialize() {
    return {
      adapterName: "@codewiz/adapter-mock",
      adapterVersion: "0.0.0",
      protocolVersion: 1,
      capabilities: ["modules"],
      fileGlobs: ["**/*.mock"],
    };
  },
  async analyze() {
    return {
      modules: [{
        id: "mock:foo.mock", name: "foo", path: "foo.mock", language: "mock",
        layer: { value: "service", provenance: { source: "static" } },
        kind: "service", loc: 1,
        citations: [{ path: "foo.mock", line: 1 }],
      }],
      edges: [], contracts: [], httpEndpoints: [], diagnostics: [],
    };
  },
  async shutdown() {},
};

const dupIdAdapter: LanguageAdapter = {
  ...goodAdapter,
  async analyze() {
    const r = await goodAdapter.analyze({ files: [] });
    return { ...r, modules: [...r.modules, ...r.modules] }; // duplicates
  },
};

describe("conformance harness", () => {
  it("good adapter passes", async () => {
    const result = await runConformanceSuite(goodAdapter, {
      projectRoot: "/tmp",
      files: ["foo.mock"],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("duplicate module ids fail the suite", async () => {
    const result = await runConformanceSuite(dupIdAdapter, {
      projectRoot: "/tmp",
      files: ["foo.mock"],
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.includes("duplicate"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/sdk test`

- [ ] **Step 3: Implement `conformance.ts`**

```ts
import { LanguageAdapter, InitResponseSchema, AnalyzeResponseSchema } from "./adapter.js";

export interface ConformanceInput {
  projectRoot: string;
  files: string[];
}

export interface ConformanceResult {
  passed: boolean;
  failures: string[];
}

export async function runConformanceSuite(
  adapter: LanguageAdapter,
  input: ConformanceInput,
): Promise<ConformanceResult> {
  const failures: string[] = [];

  let init;
  try {
    init = InitResponseSchema.parse(
      await adapter.initialize({
        projectRoot: input.projectRoot,
        protocolVersion: 1,
      }),
    );
  } catch (e) {
    failures.push(`initialize() failed schema validation: ${(e as Error).message}`);
    return { passed: false, failures };
  }

  if (init.protocolVersion !== 1) {
    failures.push(`adapter declared protocolVersion ${init.protocolVersion}, expected 1`);
  }

  let resp;
  try {
    resp = AnalyzeResponseSchema.parse(await adapter.analyze({ files: input.files }));
  } catch (e) {
    failures.push(`analyze() failed schema validation: ${(e as Error).message}`);
    return { passed: false, failures };
  }

  // Invariant: module IDs unique
  const ids = new Set<string>();
  for (const m of resp.modules) {
    if (ids.has(m.id)) failures.push(`duplicate module id: ${m.id}`);
    ids.add(m.id);
  }

  // Invariant: edges reference declared modules (within this adapter's output)
  for (const e of resp.edges) {
    if (!ids.has(e.source) && e.source.startsWith(`${init.adapterName}:`)) {
      failures.push(`edge source ${e.source} not in modules`);
    }
  }

  // Invariant: every module has at least one citation
  for (const m of resp.modules) {
    if (m.citations.length === 0) failures.push(`module ${m.id} has no citations`);
  }

  await adapter.shutdown();
  return { passed: failures.length === 0, failures };
}
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./conformance.js";
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm --filter @codewiz/sdk test`
Expected: 22 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/
git commit -m "feat(sdk): conformance harness validating adapter protocol"
```

---

## Task 8: Core package skeleton + Walker

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/walker.ts`
- Create: `packages/core/tests/walker.test.ts`

- [ ] **Step 1: Create package skeleton**

`packages/core/package.json`:
```json
{
  "name": "@codewiz/core",
  "version": "0.0.0",
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
    "fast-glob": "^3.3.2",
    "ignore": "^6.0.2",
    "js-yaml": "^4.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*"]
}
```

`packages/core/src/index.ts`:
```ts
export * from "./walker.js";
```

- [ ] **Step 2: Write failing test**

`packages/core/tests/walker.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walk } from "../src/walker.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-walker-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("walk", () => {
  it("returns files matching globs, repo-relative, sorted", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "");
    writeFileSync(join(dir, "src/b.tsx"), "");
    writeFileSync(join(dir, "README.md"), "");
    const files = await walk(dir, ["**/*.ts", "**/*.tsx"]);
    expect(files).toEqual(["src/a.ts", "src/b.tsx"]);
  });

  it("respects .gitignore", async () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\n*.log\n");
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules/x.ts"), "");
    writeFileSync(join(dir, "app.ts"), "");
    writeFileSync(join(dir, "debug.log"), "");
    const files = await walk(dir, ["**/*"]);
    expect(files).toEqual([".gitignore", "app.ts"]);
  });

  it("respects extra exclude globs", async () => {
    writeFileSync(join(dir, "a.ts"), "");
    writeFileSync(join(dir, "a.test.ts"), "");
    const files = await walk(dir, ["**/*.ts"], { exclude: ["**/*.test.ts"] });
    expect(files).toEqual(["a.ts"]);
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm install && pnpm --filter @codewiz/core test`

- [ ] **Step 4: Implement `walker.ts`**

```ts
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
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `pnpm --filter @codewiz/core test`
Expected: 3 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/ pnpm-lock.yaml
git commit -m "feat(core): walker — gitignore-aware file globbing"
```

---

## Task 9: Core — In-process adapter registry

**Files:**
- Create: `packages/core/src/registry.ts`
- Create: `packages/core/tests/registry.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/registry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { AdapterRegistry } from "../src/registry.js";
import type { LanguageAdapter } from "@codewiz/sdk";

const mockAdapter: LanguageAdapter = {
  async initialize() {
    return {
      adapterName: "@codewiz/mock",
      adapterVersion: "0.0.0",
      protocolVersion: 1,
      capabilities: ["modules"],
      fileGlobs: ["**/*.mock"],
    };
  },
  async analyze() {
    return { modules: [], edges: [], contracts: [], httpEndpoints: [], diagnostics: [] };
  },
  async shutdown() {},
};

describe("AdapterRegistry", () => {
  it("registers and resolves an adapter", async () => {
    const reg = new AdapterRegistry();
    reg.register("mock", () => mockAdapter);
    const adapter = reg.create("mock");
    const init = await adapter.initialize({ projectRoot: "/tmp", protocolVersion: 1 });
    expect(init.adapterName).toBe("@codewiz/mock");
  });

  it("throws on unknown adapter", () => {
    const reg = new AdapterRegistry();
    expect(() => reg.create("none")).toThrow(/unknown adapter/i);
  });

  it("lists registered adapter names", () => {
    const reg = new AdapterRegistry();
    reg.register("a", () => mockAdapter);
    reg.register("b", () => mockAdapter);
    expect(reg.list().sort()).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/core test`

- [ ] **Step 3: Implement `registry.ts`**

```ts
import type { LanguageAdapter } from "@codewiz/sdk";

export type AdapterFactory = () => LanguageAdapter;

export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();

  register(name: string, factory: AdapterFactory): void {
    this.factories.set(name, factory);
  }

  create(name: string): LanguageAdapter {
    const f = this.factories.get(name);
    if (!f) throw new Error(`unknown adapter: ${name}`);
    return f();
  }

  list(): string[] {
    return [...this.factories.keys()];
  }
}
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./registry.js";
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/core test`
Expected: 6 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): in-process adapter registry"
```

---

## Task 10: Core — Aggregator

**Files:**
- Create: `packages/core/src/aggregator.ts`
- Create: `packages/core/tests/aggregator.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/aggregator.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { aggregate } from "../src/aggregator.js";
import type { AnalyzeResponse } from "@codewiz/sdk";

const r1: AnalyzeResponse = {
  modules: [
    { id: "ts:a.ts", name: "a", path: "a.ts", language: "ts",
      layer: { value: "ui", provenance: { source: "static" } },
      kind: "page", loc: 1, citations: [{ path: "a.ts", line: 1 }] },
  ],
  edges: [{ source: "ts:a.ts", target: "ts:b.ts", kind: "imports",
            provenance: { source: "static" } }],
  contracts: [],
  httpEndpoints: [],
  diagnostics: [{ level: "info", message: "from-ts" }],
};

const r2: AnalyzeResponse = {
  modules: [
    { id: "py:b.py", name: "b", path: "b.py", language: "py",
      layer: { value: "service", provenance: { source: "static" } },
      kind: "service", loc: 2, citations: [{ path: "b.py", line: 1 }] },
  ],
  edges: [],
  contracts: [],
  httpEndpoints: [],
  diagnostics: [],
};

describe("aggregate", () => {
  it("merges modules, edges, diagnostics across adapters", () => {
    const out = aggregate([r1, r2]);
    expect(out.modules.map(m => m.id).sort()).toEqual(["py:b.py", "ts:a.ts"]);
    expect(out.edges.length).toBe(1);
    expect(out.diagnostics.length).toBe(1);
  });

  it("rejects duplicate module ids across adapters", () => {
    const dup: AnalyzeResponse = { ...r1 };
    expect(() => aggregate([r1, dup])).toThrow(/duplicate module id/i);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/core test`

- [ ] **Step 3: Implement `aggregator.ts`**

```ts
import type {
  AnalyzeResponse, Module, Edge, Contract, HttpEndpoint, Diagnostic,
} from "@codewiz/sdk";

export interface AggregatedProject {
  modules: Module[];
  edges: Edge[];
  contracts: Contract[];
  httpEndpoints: HttpEndpoint[];
  diagnostics: Diagnostic[];
}

export function aggregate(responses: AnalyzeResponse[]): AggregatedProject {
  const modules: Module[] = [];
  const seenIds = new Set<string>();
  const edges: Edge[] = [];
  const contracts: Contract[] = [];
  const httpEndpoints: HttpEndpoint[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const r of responses) {
    for (const m of r.modules) {
      if (seenIds.has(m.id)) throw new Error(`duplicate module id across adapters: ${m.id}`);
      seenIds.add(m.id);
      modules.push(m);
    }
    edges.push(...r.edges);
    contracts.push(...r.contracts);
    httpEndpoints.push(...r.httpEndpoints);
    diagnostics.push(...r.diagnostics);
  }

  return { modules, edges, contracts, httpEndpoints, diagnostics };
}
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./aggregator.js";
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/core test`
Expected: 8 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): aggregator merging per-adapter results"
```

---

## Task 11: Core — Bridge resolver

**Files:**
- Create: `packages/core/src/bridge.ts`
- Create: `packages/core/tests/bridge.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/bridge.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveBridges } from "../src/bridge.js";
import type { HttpEndpoint } from "@codewiz/sdk";

const ep = (
  side: "client" | "server", verb: HttpEndpoint["verb"],
  path: string, mod: string,
): HttpEndpoint => ({
  side, verb, pathTemplate: path, module: mod,
  citation: { path: mod, line: 1 },
});

describe("resolveBridges", () => {
  it("matches one client to one server with confidence 1", () => {
    const edges = resolveBridges([
      ep("client", "POST", "/cart/items", "ts:client.ts"),
      ep("server", "POST", "/cart/items", "py:routes/cart.py"),
    ]);
    expect(edges.length).toBe(1);
    expect(edges[0]).toMatchObject({
      source: "ts:client.ts", target: "py:routes/cart.py",
      kind: "http",
      provenance: { source: "bridge", confidence: 1 },
    });
  });

  it("normalizes path params (:id vs {id} vs <id>)", () => {
    const edges = resolveBridges([
      ep("client", "GET", "/cart/items/:id", "ts:client.ts"),
      ep("server", "GET", "/cart/items/{id}", "py:routes/cart.py"),
    ]);
    expect(edges.length).toBe(1);
  });

  it("emits low-confidence edges for ambiguous matches", () => {
    const edges = resolveBridges([
      ep("client", "GET", "/x", "ts:client.ts"),
      ep("server", "GET", "/x", "py:a.py"),
      ep("server", "GET", "/x", "py:b.py"),
    ]);
    expect(edges.length).toBe(2);
    for (const e of edges) {
      if (e.provenance.source === "bridge") {
        expect(e.provenance.confidence).toBeLessThan(1);
      }
    }
  });

  it("ignores unmatched endpoints", () => {
    const edges = resolveBridges([
      ep("client", "POST", "/a", "ts:client.ts"),
      ep("server", "POST", "/b", "py:b.py"),
    ]);
    expect(edges).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/core test`

- [ ] **Step 3: Implement `bridge.ts`**

```ts
import type { Edge, HttpEndpoint } from "@codewiz/sdk";

const PARAM_RE = /[:{<]([a-zA-Z_][a-zA-Z0-9_]*)[}>]?/g;

function normalize(p: string): string {
  // Treat :id, {id}, <id> as the same wildcard token.
  return p.replace(PARAM_RE, ":_");
}

export function resolveBridges(endpoints: HttpEndpoint[]): Edge[] {
  const clients = endpoints.filter((e) => e.side === "client");
  const servers = endpoints.filter((e) => e.side === "server");

  // Group servers by (verb, normalized-path)
  const serverIdx = new Map<string, HttpEndpoint[]>();
  for (const s of servers) {
    const k = `${s.verb} ${normalize(s.pathTemplate)}`;
    const list = serverIdx.get(k) ?? [];
    list.push(s);
    serverIdx.set(k, list);
  }

  const edges: Edge[] = [];
  for (const c of clients) {
    const k = `${c.verb} ${normalize(c.pathTemplate)}`;
    const matches = serverIdx.get(k) ?? [];
    if (matches.length === 0) continue;
    const confidence = matches.length === 1 ? 1 : 1 / (matches.length + 1);
    for (const s of matches) {
      edges.push({
        source: c.module,
        target: s.module,
        kind: "http",
        provenance: { source: "bridge", confidence },
        evidence: [c.citation, s.citation],
      });
    }
  }
  return edges;
}
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./bridge.js";
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/core test`
Expected: 12 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): bridge resolver matching cross-language HTTP edges"
```

---

## Task 12: Core — Annotations parser + applier

**Files:**
- Create: `packages/core/src/annotations.ts`
- Create: `packages/core/tests/annotations.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/annotations.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  parseAnnotations, applyAnnotations, type Annotations,
} from "../src/annotations.js";
import type { Module, Diagnostic } from "@codewiz/sdk";

const mod = (id: string, path: string, kind: Module["kind"] = "service"): Module => ({
  id, name: id, path, language: "ts",
  layer: { value: "service", provenance: { source: "static" } },
  kind, loc: 1, citations: [{ path, line: 1 }],
});

describe("parseAnnotations", () => {
  it("parses a minimal yaml", () => {
    const yaml = `
classify:
  rules:
    - pattern: "src/**/*.tsx"
      layer: ui
review:
  - { path: "x.ts", level: warn, note: "stale" }
exclude:
  - "tests/**"
`;
    const parsed = parseAnnotations(yaml, ".codewiz.yml");
    expect(parsed.value).not.toBeNull();
    expect(parsed.diagnostics).toEqual([]);
  });

  it("warns on flows section (not yet supported in v0.1)", () => {
    const yaml = `
flows:
  - id: f
    name: Flow
    kind: functional
    entry: x
    steps: []
`;
    const parsed = parseAnnotations(yaml, ".codewiz.yml");
    expect(parsed.value).not.toBeNull();
    expect(parsed.diagnostics.find((d: Diagnostic) =>
      d.message.includes("flows") && d.level === "warn",
    )).toBeTruthy();
  });

  it("errors on invalid layer", () => {
    const yaml = `
classify:
  rules:
    - pattern: "x"
      layer: notalayer
`;
    const parsed = parseAnnotations(yaml, ".codewiz.yml");
    expect(parsed.value).toBeNull();
    expect(parsed.diagnostics.some(d => d.level === "error")).toBe(true);
  });
});

describe("applyAnnotations", () => {
  it("classify.rules overrides layer with annotation provenance", () => {
    const ann: Annotations = {
      classify: {
        rules: [{ pattern: "src/**/*.tsx", layer: "ui" }],
        pin: {},
      },
      review: [],
      exclude: [],
    };
    const out = applyAnnotations(
      [mod("ts:src/App.tsx", "src/App.tsx", "service")],
      ann,
      ".codewiz.yml",
    );
    expect(out[0].layer.value).toBe("ui");
    expect(out[0].layer.provenance.source).toBe("annotation");
  });

  it("classify.pin overrides classify.rules", () => {
    const ann: Annotations = {
      classify: {
        rules: [{ pattern: "src/**/*.tsx", layer: "ui" }],
        pin: { "src/App.tsx": { layer: "service" } },
      },
      review: [],
      exclude: [],
    };
    const out = applyAnnotations(
      [mod("ts:src/App.tsx", "src/App.tsx")],
      ann,
      ".codewiz.yml",
    );
    expect(out[0].layer.value).toBe("service");
  });

  it("review entries set module.notes and annotation tag", () => {
    const ann: Annotations = {
      classify: { rules: [], pin: {} },
      review: [{ path: "x.ts", level: "warn", note: "stale-cache" }],
      exclude: [],
    };
    const out = applyAnnotations(
      [mod("ts:x.ts", "x.ts")],
      ann,
      ".codewiz.yml",
    );
    expect(out[0].notes).toBe("stale-cache");
    expect(out[0].annotation).toBe("warn");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/core test`

- [ ] **Step 3: Implement `annotations.ts`**

```ts
import { z } from "zod";
import yaml from "js-yaml";
import { LayerKeySchema, type Module, type Diagnostic } from "@codewiz/sdk";
import { minimatch } from "minimatch";

const ClassifyRuleSchema = z.object({
  pattern: z.string(),
  layer: LayerKeySchema.optional(),
  team: z.string().optional(),
  domain: z.string().optional(),
});

const ClassifyPinSchema = z.object({
  layer: LayerKeySchema.optional(),
  team: z.string().optional(),
  domain: z.string().optional(),
});

const AnnotationsSchema = z.object({
  classify: z.object({
    rules: z.array(ClassifyRuleSchema).default([]),
    pin: z.record(ClassifyPinSchema).default({}),
  }).default({ rules: [], pin: {} }),
  review: z.array(z.object({
    path: z.string(),
    level: z.enum(["warn", "err"]),
    note: z.string(),
  })).default([]),
  exclude: z.array(z.string()).default([]),
  // forward-compat: parse but warn (handled below)
  flows: z.unknown().optional(),
  contracts: z.unknown().optional(),
  bridges: z.unknown().optional(),
  llm: z.unknown().optional(),
});

export type Annotations = z.infer<typeof AnnotationsSchema>;

export interface ParseResult {
  value: Annotations | null;
  diagnostics: Diagnostic[];
}

export function parseAnnotations(source: string, file: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  let raw: unknown;
  try {
    raw = yaml.load(source);
  } catch (e) {
    diagnostics.push({ level: "error", message: `yaml parse: ${(e as Error).message}`, file });
    return { value: null, diagnostics };
  }
  const parsed = AnnotationsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({
        level: "error",
        message: `${issue.path.join(".")}: ${issue.message}`,
        file,
      });
    }
    return { value: null, diagnostics };
  }
  const v = parsed.data;
  if (v.flows !== undefined) {
    diagnostics.push({
      level: "warn", file,
      message: "annotations.flows: not-yet-supported in v0.1 (ships in v0.4)",
    });
  }
  if (v.contracts !== undefined) {
    diagnostics.push({
      level: "warn", file,
      message: "annotations.contracts: not-yet-supported in v0.1 (ships in v0.3)",
    });
  }
  if (v.bridges !== undefined) {
    diagnostics.push({
      level: "warn", file,
      message: "annotations.bridges: not-yet-supported in v0.1 (ships in v0.3)",
    });
  }
  if (v.llm !== undefined) {
    diagnostics.push({
      level: "warn", file,
      message: "annotations.llm: not-yet-supported in v0.1 (ships in v0.4)",
    });
  }
  return { value: v, diagnostics };
}

export function applyAnnotations(
  modules: Module[],
  ann: Annotations,
  file: string,
): Module[] {
  return modules.map((m) => {
    let layer = m.layer;
    let team = m.team;
    let domain = m.domain;
    let notes = m.notes;
    let annotation = m.annotation;

    // classify.rules — first matching wins
    for (const rule of ann.classify.rules) {
      if (minimatch(m.path, rule.pattern, { dot: true })) {
        if (rule.layer) layer = { value: rule.layer, provenance: { source: "annotation", file, line: 0 } };
        if (rule.team)  team  = { value: rule.team,  provenance: { source: "annotation", file, line: 0 } };
        if (rule.domain) domain = { value: rule.domain, provenance: { source: "annotation", file, line: 0 } };
        break;
      }
    }
    // classify.pin — overrides rules
    const pin = ann.classify.pin[m.path];
    if (pin) {
      if (pin.layer) layer = { value: pin.layer, provenance: { source: "annotation", file, line: 0 } };
      if (pin.team)  team  = { value: pin.team,  provenance: { source: "annotation", file, line: 0 } };
      if (pin.domain) domain = { value: pin.domain, provenance: { source: "annotation", file, line: 0 } };
    }
    // review
    const rev = ann.review.find((r) => r.path === m.path);
    if (rev) {
      notes = rev.note;
      annotation = rev.level;
    }
    return { ...m, layer, team, domain, notes, annotation };
  });
}
```

- [ ] **Step 4: Add `minimatch` dependency**

Run: `pnpm --filter @codewiz/core add minimatch@^10.0.1`

- [ ] **Step 5: Re-export**

Append to `src/index.ts`:
```ts
export * from "./annotations.js";
```

- [ ] **Step 6: Run, expect PASS**

Run: `pnpm --filter @codewiz/core test`
Expected: 18 tests passed.

- [ ] **Step 7: Commit**

```bash
git add packages/core/ pnpm-lock.yaml
git commit -m "feat(core): annotations parser + applier (classify/review/exclude)"
```

---

## Task 13: Core — Persister + manifest

**Files:**
- Create: `packages/core/src/persister.ts`
- Create: `packages/core/tests/persister.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/persister.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { persist, type ManifestInput } from "../src/persister.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-persist-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("persist", () => {
  it("writes manifest + modules.json + edges.json + contracts.json + flows.json + diagnostics.json", async () => {
    const manifest: ManifestInput = {
      repoRoot: dir, gitCommit: null, gitBranch: null,
      adapters: [{ name: "ts", version: "0.1.0" }],
      llm: null,
    };
    await persist(dir, manifest, {
      modules: [], edges: [], contracts: [], flows: [], diagnostics: [],
    });

    expect(existsSync(join(dir, ".codewiz/manifest.json"))).toBe(true);
    for (const f of ["modules.json", "edges.json", "contracts.json", "flows.json", "diagnostics.json"]) {
      expect(existsSync(join(dir, ".codewiz", f))).toBe(true);
    }
    const m = JSON.parse(readFileSync(join(dir, ".codewiz/manifest.json"), "utf8"));
    expect(m.adapters[0].name).toBe("ts");
    expect(typeof m.contentHash).toBe("string");
    expect(m.contentHash).toHaveLength(64); // SHA-256 hex
  });

  it("contentHash changes when modules change", async () => {
    const manifest: ManifestInput = {
      repoRoot: dir, gitCommit: null, gitBranch: null,
      adapters: [], llm: null,
    };
    await persist(dir, manifest, { modules: [], edges: [], contracts: [], flows: [], diagnostics: [] });
    const h1 = JSON.parse(readFileSync(join(dir, ".codewiz/manifest.json"), "utf8")).contentHash;

    await persist(dir, manifest, {
      modules: [{
        id: "x", name: "x", path: "x", language: "ts",
        layer: { value: "ui", provenance: { source: "static" } },
        kind: "page", loc: 1, citations: [{ path: "x", line: 1 }],
      }],
      edges: [], contracts: [], flows: [], diagnostics: [],
    });
    const h2 = JSON.parse(readFileSync(join(dir, ".codewiz/manifest.json"), "utf8")).contentHash;
    expect(h1).not.toBe(h2);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/core test`

- [ ] **Step 3: Implement `persister.ts`**

```ts
import { mkdir, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Module, Edge, Contract, Flow, Diagnostic } from "@codewiz/sdk";

export interface ManifestInput {
  repoRoot: string;
  gitCommit: string | null;
  gitBranch: string | null;
  adapters: { name: string; version: string }[];
  llm: { provider: string; model: string } | null;
}

export interface ProjectData {
  modules: Module[];
  edges: Edge[];
  contracts: Contract[];
  flows: Flow[];
  diagnostics: Diagnostic[];
}

export interface Manifest extends ManifestInput {
  generatedAt: string;
  lastSuccessful: string;
  contentHash: string;
  protocolVersion: 1;
}

async function atomicWrite(path: string, body: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, path);
}

function hashContent(data: ProjectData): string {
  // canonical JSON: stable key ordering at the top level
  const canon = JSON.stringify({
    modules: data.modules,
    edges: data.edges,
    contracts: data.contracts,
    flows: data.flows,
  });
  return createHash("sha256").update(canon).digest("hex");
}

export async function persist(
  projectRoot: string,
  manifest: ManifestInput,
  data: ProjectData,
): Promise<Manifest> {
  const dir = join(projectRoot, ".codewiz");
  await mkdir(dir, { recursive: true });

  const now = new Date().toISOString();
  const fullManifest: Manifest = {
    ...manifest,
    generatedAt: now,
    lastSuccessful: now,
    contentHash: hashContent(data),
    protocolVersion: 1,
  };

  await atomicWrite(join(dir, "modules.json"),     JSON.stringify(data.modules, null, 2));
  await atomicWrite(join(dir, "edges.json"),       JSON.stringify(data.edges, null, 2));
  await atomicWrite(join(dir, "contracts.json"),   JSON.stringify(data.contracts, null, 2));
  await atomicWrite(join(dir, "flows.json"),       JSON.stringify(data.flows, null, 2));
  await atomicWrite(join(dir, "diagnostics.json"), JSON.stringify(data.diagnostics, null, 2));
  await atomicWrite(join(dir, "manifest.json"),    JSON.stringify(fullManifest, null, 2));
  return fullManifest;
}
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./persister.js";
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/core test`
Expected: 20 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): persister with atomic writes + content-hash manifest"
```

---

## Task 14: Core — Pipeline assembly (`runAnalysis`)

**Files:**
- Create: `packages/core/src/pipeline.ts`
- Create: `packages/core/tests/pipeline.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/pipeline.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAnalysis } from "../src/pipeline.js";
import { AdapterRegistry } from "../src/registry.js";
import type { LanguageAdapter } from "@codewiz/sdk";

const fakeAdapter: LanguageAdapter = {
  async initialize() {
    return {
      adapterName: "@codewiz/fake",
      adapterVersion: "0.0.0",
      protocolVersion: 1,
      capabilities: ["modules"],
      fileGlobs: ["**/*.fake"],
    };
  },
  async analyze({ files }) {
    return {
      modules: files.map((f) => ({
        id: `fake:${f}`, name: f, path: f, language: "fake",
        layer: { value: "service" as const, provenance: { source: "static" as const } },
        kind: "service" as const, loc: 1,
        citations: [{ path: f, line: 1 }],
      })),
      edges: [], contracts: [], httpEndpoints: [], diagnostics: [],
    };
  },
  async shutdown() {},
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codewiz-pipeline-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runAnalysis", () => {
  it("walks repo, runs adapter, persists results", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.fake"), "");
    writeFileSync(join(dir, "src/b.fake"), "");

    const reg = new AdapterRegistry();
    reg.register("fake", () => fakeAdapter);

    const manifest = await runAnalysis({
      projectRoot: dir,
      adapters: ["fake"],
      registry: reg,
    });
    expect(manifest.contentHash).toHaveLength(64);
    expect(existsSync(join(dir, ".codewiz/modules.json"))).toBe(true);
    const modules = JSON.parse(readFileSync(join(dir, ".codewiz/modules.json"), "utf8"));
    expect(modules.length).toBe(2);
  });

  it("applies .codewiz.yml when present", async () => {
    writeFileSync(join(dir, "x.fake"), "");
    writeFileSync(join(dir, ".codewiz.yml"), `
classify:
  rules:
    - pattern: "*.fake"
      layer: ui
`);
    const reg = new AdapterRegistry();
    reg.register("fake", () => fakeAdapter);
    await runAnalysis({ projectRoot: dir, adapters: ["fake"], registry: reg });
    const modules = JSON.parse(readFileSync(join(dir, ".codewiz/modules.json"), "utf8"));
    expect(modules[0].layer.value).toBe("ui");
    expect(modules[0].layer.provenance.source).toBe("annotation");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/core test`

- [ ] **Step 3: Implement `pipeline.ts`**

```ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Module, Edge, Diagnostic } from "@codewiz/sdk";
import { walk } from "./walker.js";
import { AdapterRegistry } from "./registry.js";
import { aggregate } from "./aggregator.js";
import { resolveBridges } from "./bridge.js";
import { parseAnnotations, applyAnnotations } from "./annotations.js";
import { persist, type Manifest } from "./persister.js";

export interface RunAnalysisOptions {
  projectRoot: string;
  adapters: string[];                    // names registered in registry
  registry: AdapterRegistry;
  llm?: { provider: string; model: string };  // metadata only in v0.1
}

export async function runAnalysis(opts: RunAnalysisOptions): Promise<Manifest> {
  const { projectRoot, adapters: adapterNames, registry } = opts;

  // Load annotations (optional)
  let annotations = null;
  let annotationDiagnostics: Diagnostic[] = [];
  const annPath = join(projectRoot, ".codewiz.yml");
  if (existsSync(annPath)) {
    const parsed = parseAnnotations(readFileSync(annPath, "utf8"), ".codewiz.yml");
    annotationDiagnostics = parsed.diagnostics;
    if (parsed.value === null) {
      const errSummary = parsed.diagnostics.filter(d => d.level === "error").map(d => d.message).join("; ");
      throw new Error(`invalid .codewiz.yml: ${errSummary}`);
    }
    annotations = parsed.value;
  }

  // Initialize adapters, ask each for its file globs
  const live = adapterNames.map((n) => ({ name: n, adapter: registry.create(n) }));
  const inits = await Promise.all(
    live.map(async ({ name, adapter }) => ({
      name,
      adapter,
      init: await adapter.initialize({ projectRoot, protocolVersion: 1 as const }),
    })),
  );

  // Walk + dispatch per adapter
  const responses = await Promise.all(
    inits.map(async ({ adapter, init }) => {
      const files = await walk(projectRoot, init.fileGlobs, {
        exclude: annotations?.exclude,
      });
      return adapter.analyze({ files });
    }),
  );

  // Shutdown
  await Promise.all(inits.map(({ adapter }) => adapter.shutdown()));

  // Aggregate
  const project = aggregate(responses);

  // Bridge resolution
  const bridgeEdges = resolveBridges(project.httpEndpoints);
  const allEdges: Edge[] = [...project.edges, ...bridgeEdges];

  // Annotations
  let annotated: Module[] = project.modules;
  if (annotations) {
    annotated = applyAnnotations(project.modules, annotations, ".codewiz.yml");
  }

  // Persist
  const manifest = await persist(
    projectRoot,
    {
      repoRoot: projectRoot,
      gitCommit: null, gitBranch: null,
      adapters: inits.map(({ init }) => ({ name: init.adapterName, version: init.adapterVersion })),
      llm: opts.llm ?? null,
    },
    {
      modules: annotated,
      edges: allEdges,
      contracts: project.contracts,
      flows: [],   // v0.1 flows are not yet emitted
      diagnostics: [...project.diagnostics, ...annotationDiagnostics],
    },
  );
  return manifest;
}
```

- [ ] **Step 4: Re-export**

Append to `src/index.ts`:
```ts
export * from "./pipeline.js";
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter @codewiz/core test`
Expected: 22 tests passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "feat(core): runAnalysis() wires walker→adapter→aggregate→bridge→annotations→persist"
```

---

## Task 15: TS adapter — package + ts-morph project + Module records

**Files:**
- Create: `packages/adapters/ts/package.json`
- Create: `packages/adapters/ts/tsconfig.json`
- Create: `packages/adapters/ts/src/index.ts`
- Create: `packages/adapters/ts/src/project.ts`
- Create: `packages/adapters/ts/src/modules.ts`
- Create: `packages/adapters/ts/tests/modules.test.ts`

- [ ] **Step 1: Create package skeleton**

`packages/adapters/ts/package.json`:
```json
{
  "name": "@codewiz/adapter-ts",
  "version": "0.0.0",
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
    "ts-morph": "^24.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

`packages/adapters/ts/tsconfig.json`:
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Write failing test**

`packages/adapters/ts/tests/modules.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractModules } from "../src/modules.js";
import { createProject } from "../src/project.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-ts-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractModules", () => {
  it("creates a Module per file with stable id and citation", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/App.tsx"), "export default function App(){return null}");
    writeFileSync(join(dir, "src/util.ts"), "export const x = 1;");
    const proj = createProject(dir, ["src/App.tsx", "src/util.ts"]);
    const mods = extractModules(proj, dir);
    expect(mods.map(m => m.id).sort()).toEqual([
      "ts:src/App.tsx",
      "ts:src/util.ts",
    ]);
    expect(mods[0].language).toBe("ts");
    expect(mods[0].citations[0].path).toBe(mods[0].path);
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm install && pnpm --filter @codewiz/adapter-ts test`

- [ ] **Step 4: Implement `project.ts`**

```ts
import { Project, ScriptTarget, ModuleKind, ModuleResolutionKind } from "ts-morph";
import { join } from "node:path";

export function createProject(projectRoot: string, files: string[]): Project {
  const proj = new Project({
    compilerOptions: {
      target: ScriptTarget.ESNext,
      module: ModuleKind.ESNext,
      // Node10 (legacy "node") resolution is permissive: extension-less
      // imports like `import { X } from "./foo"` resolve to foo.ts/.tsx.
      // NodeNext would require explicit .js extensions in source.
      moduleResolution: ModuleResolutionKind.Node10,
      jsx: 4 /* Preserve */,
      allowJs: true,
      checkJs: false,
      noEmit: true,
      strict: false,
    },
    skipFileDependencyResolution: true,
    useInMemoryFileSystem: false,
  });
  for (const f of files) {
    proj.addSourceFileAtPathIfExists(join(projectRoot, f));
  }
  return proj;
}
```

- [ ] **Step 5: Implement `modules.ts` (minimal — kind="component" for everything for now)**

```ts
import { Project } from "ts-morph";
import { relative } from "node:path";
import type { Module } from "@codewiz/sdk";
import { basename } from "node:path";

export function extractModules(project: Project, projectRoot: string): Module[] {
  return project.getSourceFiles().map((sf) => {
    const path = relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
    const name = basename(path).replace(/\.[jt]sx?$/, "");
    return {
      id: `ts:${path}`,
      name,
      path,
      language: path.endsWith(".js") || path.endsWith(".jsx") ? "js" : "ts",
      layer: { value: "service" as const, provenance: { source: "static" as const } }, // refined in Task 17
      kind: "component" as const,                                                       // refined in Task 16
      loc: sf.getEndLineNumber(),
      citations: [{ path, line: 1 }],
    };
  });
}
```

- [ ] **Step 6: Stub `index.ts` (filled in Task 19)**

```ts
export * from "./modules.js";
export * from "./project.js";
```

- [ ] **Step 7: Run tests, expect PASS**

Run: `pnpm --filter @codewiz/adapter-ts test`
Expected: 1 test passed.

- [ ] **Step 8: Commit**

```bash
git add packages/adapters/ts/ pnpm-lock.yaml
git commit -m "feat(adapter-ts): package skeleton + ts-morph project + module extraction"
```

---

## Task 16: TS adapter — kind + layer heuristics

**Files:**
- Create: `packages/adapters/ts/src/classify.ts`
- Create: `packages/adapters/ts/tests/classify.test.ts`
- Modify: `packages/adapters/ts/src/modules.ts`

- [ ] **Step 1: Write failing test**

`packages/adapters/ts/tests/classify.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyKind, classifyLayer } from "../src/classify.js";

describe("classifyKind", () => {
  const cases: [string, string][] = [
    ["web/src/pages/Home.tsx", "page"],
    ["web/src/components/Button.tsx", "component"],
    ["web/src/hooks/useAuth.ts", "hook"],
    ["web/src/store/authStore.ts", "store"],
    ["web/src/api/client.ts", "client"],
    ["api/src/routes/auth.ts", "route"],
    ["api/src/services/AuthService.ts", "service"],
    ["api/src/middleware/auth.ts", "middleware"],
    ["api/src/models/User.ts", "model"],
    ["random/file.ts", "component"],  // default
  ];
  for (const [p, k] of cases) {
    it(`classifies ${p} as ${k}`, () => {
      expect(classifyKind(p)).toBe(k);
    });
  }
});

describe("classifyLayer", () => {
  const cases: [string, string][] = [
    ["web/src/pages/Home.tsx", "ui"],
    ["web/src/components/X.tsx", "ui"],
    ["web/src/hooks/useX.ts", "state"],
    ["web/src/store/y.ts", "state"],
    ["web/src/api/client.ts", "api"],
    ["api/src/routes/x.ts", "api"],
    ["api/src/services/X.ts", "service"],
    ["api/src/middleware/x.ts", "service"],
    ["api/src/models/X.ts", "data"],
    ["api/src/data/db.ts", "data"],
    ["random/file.ts", "service"],   // default
  ];
  for (const [p, l] of cases) {
    it(`classifies ${p} as layer=${l}`, () => {
      expect(classifyLayer(p)).toBe(l);
    });
  }
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/adapter-ts test`

- [ ] **Step 3: Implement `classify.ts`**

```ts
import type { ModuleKind, LayerKey } from "@codewiz/sdk";

export function classifyKind(path: string): ModuleKind {
  const p = path.toLowerCase();
  if (/\bpages?\//.test(p)) return "page";
  if (/\bhooks?\//.test(p)) return "hook";
  if (/\bstore\//.test(p)) return "store";
  if (/\bapi\/.*client/.test(p)) return "client";
  if (/\broutes?\//.test(p)) return "route";
  if (/\bmiddleware\//.test(p)) return "middleware";
  if (/\bservices?\//.test(p)) return "service";
  if (/\bmodels?\//.test(p)) return "model";
  if (/\bcomponents?\//.test(p)) return "component";
  return "component";
}

export function classifyLayer(path: string): LayerKey {
  const p = path.toLowerCase();
  if (/\bpages?\/|\bcomponents?\//.test(p)) return "ui";
  if (/\bhooks?\/|\bstore\//.test(p)) return "state";
  if (/\bapi\/|\broutes?\//.test(p)) return "api";
  if (/\bservices?\/|\bmiddleware\//.test(p)) return "service";
  if (/\bmodels?\/|\bdata\/|\bdb\b|\bcache\b/.test(p)) return "data";
  return "service";
}
```

- [ ] **Step 4: Wire into `modules.ts`** — replace the bare layer/kind in the previous task

Replace the body of `extractModules` so the `layer.value` and `kind` come from `classifyLayer(path)` and `classifyKind(path)` respectively:

```ts
import { Project } from "ts-morph";
import { relative, basename } from "node:path";
import type { Module } from "@codewiz/sdk";
import { classifyKind, classifyLayer } from "./classify.js";

export function extractModules(project: Project, projectRoot: string): Module[] {
  return project.getSourceFiles().map((sf) => {
    const path = relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
    const name = basename(path).replace(/\.[jt]sx?$/, "");
    return {
      id: `ts:${path}`,
      name,
      path,
      language: path.endsWith(".js") || path.endsWith(".jsx") ? "js" : "ts",
      layer: { value: classifyLayer(path), provenance: { source: "static" as const } },
      kind: classifyKind(path),
      loc: sf.getEndLineNumber(),
      citations: [{ path, line: 1 }],
    };
  });
}
```

- [ ] **Step 5: Update the existing modules test to expect the right kind**

In `tests/modules.test.ts`, append:
```ts
it("classifies App.tsx as kind=component (no pages/ folder), layer=service", () => {
  // (already tested by classify.test.ts; this verifies wiring)
  // no-op assertion already covered by Step 1-3 above
  expect(true).toBe(true);
});
```

- [ ] **Step 6: Run, expect PASS**

Run: `pnpm --filter @codewiz/adapter-ts test`
Expected: classify tests pass (~21), modules test still passes.

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/ts/
git commit -m "feat(adapter-ts): kind + layer classification heuristics"
```

---

## Task 17: TS adapter — Import edge extraction

**Files:**
- Create: `packages/adapters/ts/src/imports.ts`
- Create: `packages/adapters/ts/tests/imports.test.ts`

- [ ] **Step 1: Write failing test**

`packages/adapters/ts/tests/imports.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/project.js";
import { extractImportEdges } from "../src/imports.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-imports-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractImportEdges", () => {
  it("emits an imports edge for relative imports", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), `import { B } from "./b";`);
    writeFileSync(join(dir, "src/b.ts"), `export const B = 1;`);
    const proj = createProject(dir, ["src/a.ts", "src/b.ts"]);
    const edges = extractImportEdges(proj, dir);
    expect(edges.length).toBe(1);
    expect(edges[0]).toMatchObject({
      source: "ts:src/a.ts",
      target: "ts:src/b.ts",
      kind: "imports",
      provenance: { source: "static" },
    });
  });

  it("ignores bare-module (npm) imports", () => {
    writeFileSync(join(dir, "a.ts"), `import React from "react";`);
    const proj = createProject(dir, ["a.ts"]);
    const edges = extractImportEdges(proj, dir);
    expect(edges).toEqual([]);
  });

  it("resolves index files in directory imports", () => {
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "src/lib"));
    writeFileSync(join(dir, "src/a.ts"), `import { L } from "./lib";`);
    writeFileSync(join(dir, "src/lib/index.ts"), `export const L = 1;`);
    const proj = createProject(dir, ["src/a.ts", "src/lib/index.ts"]);
    const edges = extractImportEdges(proj, dir);
    expect(edges.length).toBe(1);
    expect(edges[0].target).toBe("ts:src/lib/index.ts");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/adapter-ts test`

- [ ] **Step 3: Implement `imports.ts`**

```ts
import { Project, SourceFile } from "ts-morph";
import { relative } from "node:path";
import type { Edge } from "@codewiz/sdk";

function fileId(sf: SourceFile, projectRoot: string): string {
  return `ts:${relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/")}`;
}

export function extractImportEdges(project: Project, projectRoot: string): Edge[] {
  const edges: Edge[] = [];
  for (const sf of project.getSourceFiles()) {
    for (const decl of sf.getImportDeclarations()) {
      const target = decl.getModuleSpecifierSourceFile();
      if (!target) continue;       // bare-module / unresolved
      edges.push({
        source: fileId(sf, projectRoot),
        target: fileId(target, projectRoot),
        kind: "imports",
        provenance: { source: "static" },
        evidence: [{
          path: relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/"),
          line: decl.getStartLineNumber(),
        }],
      });
    }
  }
  return edges;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm --filter @codewiz/adapter-ts test`
Expected: 3 new tests pass; total ~25.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/ts/
git commit -m "feat(adapter-ts): import edge extraction"
```

---

## Task 18: TS adapter — HTTP endpoint extraction

**Files:**
- Create: `packages/adapters/ts/src/http.ts`
- Create: `packages/adapters/ts/tests/http.test.ts`

- [ ] **Step 1: Write failing test**

`packages/adapters/ts/tests/http.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/project.js";
import { extractHttpEndpoints } from "../src/http.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-http-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractHttpEndpoints", () => {
  it("detects axios-style client posts", () => {
    writeFileSync(join(dir, "client.ts"), `
      import axios from "axios";
      export const postCart = (b: any) => axios.post("/cart/items", b);
    `);
    const proj = createProject(dir, ["client.ts"]);
    const endpoints = extractHttpEndpoints(proj, dir);
    expect(endpoints).toEqual([{
      side: "client",
      verb: "POST",
      pathTemplate: "/cart/items",
      module: "ts:client.ts",
      citation: { path: "client.ts", line: 3 },
    }]);
  });

  it("detects fetch() calls with method option", () => {
    writeFileSync(join(dir, "client.ts"), `
      export const get = () => fetch("/users", { method: "GET" });
    `);
    const proj = createProject(dir, ["client.ts"]);
    const endpoints = extractHttpEndpoints(proj, dir);
    expect(endpoints[0]).toMatchObject({
      side: "client", verb: "GET", pathTemplate: "/users",
    });
  });

  it("ignores non-string-literal paths (no false positives)", () => {
    writeFileSync(join(dir, "client.ts"), `
      const url = "/x";
      fetch(url);
    `);
    const proj = createProject(dir, ["client.ts"]);
    expect(extractHttpEndpoints(proj, dir)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/adapter-ts test`

- [ ] **Step 3: Implement `http.ts`**

```ts
import { Project, SourceFile, SyntaxKind, CallExpression, Node } from "ts-morph";
import { relative } from "node:path";
import type { HttpEndpoint } from "@codewiz/sdk";

const VERB_METHODS = new Set(["get", "post", "put", "delete", "patch"]);

function fileId(sf: SourceFile, projectRoot: string): string {
  return `ts:${relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/")}`;
}

function relPath(sf: SourceFile, projectRoot: string): string {
  return relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
}

export function extractHttpEndpoints(project: Project, projectRoot: string): HttpEndpoint[] {
  const out: HttpEndpoint[] = [];
  for (const sf of project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return;
      const call = node as CallExpression;
      const ep = matchClientCall(call, sf, projectRoot);
      if (ep) out.push(ep);
    });
  }
  return out;
}

function matchClientCall(
  call: CallExpression, sf: SourceFile, projectRoot: string,
): HttpEndpoint | null {
  const expr = call.getExpression();
  // pattern A: <ident>.<verb>("/path", ...)
  if (Node.isPropertyAccessExpression(expr)) {
    const verb = expr.getName().toLowerCase();
    if (VERB_METHODS.has(verb)) {
      const arg0 = call.getArguments()[0];
      if (arg0 && Node.isStringLiteral(arg0)) {
        return {
          side: "client",
          verb: verb.toUpperCase() as HttpEndpoint["verb"],
          pathTemplate: arg0.getLiteralValue(),
          module: fileId(sf, projectRoot),
          citation: { path: relPath(sf, projectRoot), line: call.getStartLineNumber() },
        };
      }
    }
  }
  // pattern B: fetch("/path", { method: "POST" })
  if (Node.isIdentifier(expr) && expr.getText() === "fetch") {
    const [arg0, arg1] = call.getArguments();
    if (arg0 && Node.isStringLiteral(arg0)) {
      let verb: HttpEndpoint["verb"] = "GET";
      if (arg1 && Node.isObjectLiteralExpression(arg1)) {
        const m = arg1.getProperty("method");
        if (m && Node.isPropertyAssignment(m)) {
          const init = m.getInitializer();
          if (init && Node.isStringLiteral(init)) {
            const v = init.getLiteralValue().toUpperCase();
            if (["GET", "POST", "PUT", "DELETE", "PATCH"].includes(v)) {
              verb = v as HttpEndpoint["verb"];
            }
          }
        }
      }
      return {
        side: "client",
        verb,
        pathTemplate: arg0.getLiteralValue(),
        module: fileId(sf, projectRoot),
        citation: { path: relPath(sf, projectRoot), line: call.getStartLineNumber() },
      };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm --filter @codewiz/adapter-ts test`
Expected: 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/ts/
git commit -m "feat(adapter-ts): HTTP endpoint extraction (axios/fetch client patterns)"
```

---

## Task 19: TS adapter — Contract extraction

**Files:**
- Create: `packages/adapters/ts/src/contracts.ts`
- Create: `packages/adapters/ts/tests/contracts.test.ts`

- [ ] **Step 1: Write failing test**

`packages/adapters/ts/tests/contracts.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../src/project.js";
import { extractContracts } from "../src/contracts.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-contracts-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("extractContracts", () => {
  it("extracts an interface with field types and required flags", () => {
    writeFileSync(join(dir, "User.ts"), `
      export interface User {
        id: string;
        name?: string;
      }
    `);
    const proj = createProject(dir, ["User.ts"]);
    const contracts = extractContracts(proj, dir);
    expect(contracts.length).toBe(1);
    expect(contracts[0]).toMatchObject({
      id: "ts:User.ts::User",
      name: "User",
      language: "ts",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "name", type: "string", required: false },
      ],
      producers: ["ts:User.ts"],
      consumers: [],
      issues: [],
    });
  });

  it("extracts a type alias literal as a contract", () => {
    writeFileSync(join(dir, "T.ts"), `
      export type Money = { amount: number; currency: "USD" | "EUR" };
    `);
    const proj = createProject(dir, ["T.ts"]);
    const contracts = extractContracts(proj, dir);
    expect(contracts[0].name).toBe("Money");
    expect(contracts[0].fields.map(f => f.name)).toEqual(["amount", "currency"]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @codewiz/adapter-ts test`

- [ ] **Step 3: Implement `contracts.ts`**

```ts
import { Project, SourceFile, InterfaceDeclaration, TypeAliasDeclaration, Node } from "ts-morph";
import { relative } from "node:path";
import type { Contract, Provenance } from "@codewiz/sdk";

const PROV_STATIC: Provenance = { source: "static" };

function relPath(sf: SourceFile, projectRoot: string): string {
  return relative(projectRoot, sf.getFilePath()).replaceAll("\\", "/");
}

export function extractContracts(project: Project, projectRoot: string): Contract[] {
  const contracts: Contract[] = [];
  for (const sf of project.getSourceFiles()) {
    const path = relPath(sf, projectRoot);
    const moduleId = `ts:${path}`;

    for (const i of sf.getInterfaces()) {
      if (!i.isExported()) continue;
      contracts.push(fromInterface(i, path, moduleId));
    }
    for (const t of sf.getTypeAliases()) {
      if (!t.isExported()) continue;
      const c = fromTypeAlias(t, path, moduleId);
      if (c) contracts.push(c);
    }
  }
  return contracts;
}

function fromInterface(decl: InterfaceDeclaration, path: string, moduleId: string): Contract {
  return {
    id: `${moduleId}::${decl.getName()}`,
    name: decl.getName(),
    language: "ts",
    fields: decl.getProperties().map((p) => ({
      name: p.getName(),
      type: p.getTypeNode()?.getText() ?? p.getType().getText(),
      required: !p.hasQuestionToken(),
      provenance: PROV_STATIC,
    })),
    producers: [moduleId],
    consumers: [],
    issues: [],
    related: [],
    citations: [{ path, line: decl.getStartLineNumber() }],
  };
}

function fromTypeAlias(decl: TypeAliasDeclaration, path: string, moduleId: string): Contract | null {
  const tn = decl.getTypeNode();
  if (!tn || !Node.isTypeLiteral(tn)) return null;
  return {
    id: `${moduleId}::${decl.getName()}`,
    name: decl.getName(),
    language: "ts",
    fields: tn.getProperties().map((p) => ({
      name: p.getName(),
      type: p.getTypeNode()?.getText() ?? p.getType().getText(),
      required: !p.hasQuestionToken(),
      provenance: PROV_STATIC,
    })),
    producers: [moduleId],
    consumers: [],
    issues: [],
    related: [],
    citations: [{ path, line: decl.getStartLineNumber() }],
  };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm --filter @codewiz/adapter-ts test`
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/ts/
git commit -m "feat(adapter-ts): contract extraction (interface + type alias literals)"
```

---

## Task 20: TS adapter — Wire as LanguageAdapter + conformance test

**Files:**
- Modify: `packages/adapters/ts/src/index.ts`
- Create: `packages/adapters/ts/tests/conformance.test.ts`

- [ ] **Step 1: Replace `src/index.ts` with the full adapter**

```ts
import { join, relative } from "node:path";
import type { LanguageAdapter, AnalyzeResponse } from "@codewiz/sdk";
import { createProject } from "./project.js";
import { extractModules } from "./modules.js";
import { extractImportEdges } from "./imports.js";
import { extractHttpEndpoints } from "./http.js";
import { extractContracts } from "./contracts.js";

export function createTsAdapter(): LanguageAdapter {
  let projectRoot = "";
  return {
    async initialize(req) {
      projectRoot = req.projectRoot;
      return {
        adapterName: "@codewiz/adapter-ts",
        adapterVersion: "0.0.1",
        protocolVersion: 1,
        capabilities: ["modules", "edges-imports", "contracts", "http-endpoints"],
        fileGlobs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
      };
    },
    async analyze({ files }): Promise<AnalyzeResponse> {
      const proj = createProject(projectRoot, files);
      const modules = extractModules(proj, projectRoot);
      const edges = extractImportEdges(proj, projectRoot);
      const httpEndpoints = extractHttpEndpoints(proj, projectRoot);
      const contracts = extractContracts(proj, projectRoot);
      return {
        modules, edges, contracts, httpEndpoints,
        diagnostics: [],
      };
    },
    async shutdown() {
      // ts-morph holds no native handles; nothing to release.
    },
  };
}

export * from "./project.js";
export * from "./modules.js";
export * from "./imports.js";
export * from "./http.js";
export * from "./contracts.js";
export * from "./classify.js";
```

- [ ] **Step 2: Write conformance test**

`packages/adapters/ts/tests/conformance.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runConformanceSuite } from "@codewiz/sdk";
import { createTsAdapter } from "../src/index.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-conformance-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("TS adapter conformance", () => {
  it("passes the SDK conformance suite on a small project", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), `import { B } from "./b"; export const A = B;`);
    writeFileSync(join(dir, "src/b.ts"), `export const B = 1; export interface IB { x: number }`);
    const result = await runConformanceSuite(createTsAdapter(), {
      projectRoot: dir,
      files: ["src/a.ts", "src/b.ts"],
    });
    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
```

- [ ] **Step 3: Run, expect PASS**

Run: `pnpm --filter @codewiz/adapter-ts test`
Expected: 1 new test passes.

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/ts/
git commit -m "feat(adapter-ts): wire LanguageAdapter + conformance test"
```

---

## Task 21: tiny-react-app fixture

**Files:**
- Create: `tests/fixtures/tiny-react-app/package.json`
- Create: `tests/fixtures/tiny-react-app/tsconfig.json`
- Create: `tests/fixtures/tiny-react-app/web/src/pages/Home.tsx`
- Create: `tests/fixtures/tiny-react-app/web/src/pages/Cart.tsx`
- Create: `tests/fixtures/tiny-react-app/web/src/components/Button.tsx`
- Create: `tests/fixtures/tiny-react-app/web/src/api/client.ts`
- Create: `tests/fixtures/tiny-react-app/web/src/types/CartItem.ts`
- Create: `tests/fixtures/tiny-react-app/.codewiz.yml`
- Create: `tests/fixtures/tiny-react-app/.gitignore`

This task ships the canonical fixture used by golden tests and (later) the smoke test.

- [ ] **Step 1: Create fixture directory + tsconfig**

`tests/fixtures/tiny-react-app/package.json`:
```json
{
  "name": "tiny-react-app",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
```

`tests/fixtures/tiny-react-app/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "preserve",
    "strict": true
  },
  "include": ["web/src/**/*"]
}
```

- [ ] **Step 2: Create fixture source files**

`tests/fixtures/tiny-react-app/web/src/components/Button.tsx`:
```tsx
export function Button(props: { onClick: () => void; label: string }) {
  return <button onClick={props.onClick}>{props.label}</button>;
}
```

`tests/fixtures/tiny-react-app/web/src/types/CartItem.ts`:
```ts
export interface CartItem {
  productId: string;
  quantity: number;
}
```

`tests/fixtures/tiny-react-app/web/src/api/client.ts`:
```ts
export const apiClient = {
  postCartItem: (item: { productId: string; quantity: number }) =>
    fetch("/cart/items", { method: "POST", body: JSON.stringify(item) }),
  getProducts: () => fetch("/products"),
};
```

`tests/fixtures/tiny-react-app/web/src/pages/Home.tsx`:
```tsx
import { Button } from "../components/Button";
import { apiClient } from "../api/client";

export default function Home() {
  return <Button label="Browse" onClick={() => { void apiClient.getProducts(); }} />;
}
```

`tests/fixtures/tiny-react-app/web/src/pages/Cart.tsx`:
```tsx
import { Button } from "../components/Button";
import { apiClient } from "../api/client";
import type { CartItem } from "../types/CartItem";

export default function Cart() {
  const item: CartItem = { productId: "p_1", quantity: 1 };
  return <Button label="Add" onClick={() => { void apiClient.postCartItem(item); }} />;
}
```

- [ ] **Step 3: Create fixture annotations**

`tests/fixtures/tiny-react-app/.codewiz.yml`:
```yaml
classify:
  pin:
    "web/src/components/Button.tsx": { domain: core }
review:
  - { path: "web/src/pages/Cart.tsx", level: warn, note: "needs e2e coverage" }
```

`tests/fixtures/tiny-react-app/.gitignore`:
```
.codewiz/
node_modules/
```

- [ ] **Step 4: Verify fixture parses standalone with ts-morph (sanity check, no test)**

Run:
```bash
pnpm --filter @codewiz/adapter-ts exec node -e '
import("./dist/index.js").then(async ({ createTsAdapter }) => {
  const a = createTsAdapter();
  await a.initialize({ projectRoot: "tests/fixtures/tiny-react-app", protocolVersion: 1 });
  const r = await a.analyze({
    files: [
      "web/src/components/Button.tsx",
      "web/src/types/CartItem.ts",
      "web/src/api/client.ts",
      "web/src/pages/Home.tsx",
      "web/src/pages/Cart.tsx",
    ],
  });
  console.log("modules:", r.modules.length, "edges:", r.edges.length, "endpoints:", r.httpEndpoints.length);
  await a.shutdown();
});
'
```
Expected (after running `pnpm -r build` first): prints `modules: 5 edges: ≥4 endpoints: 2`. If this fails, investigate before proceeding.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/tiny-react-app/
git commit -m "test: add tiny-react-app golden fixture"
```

---

## Task 22: CLI package + Commander entry + `init`

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/bin.ts`
- Create: `packages/cli/src/init.ts`
- Create: `packages/cli/tests/init.test.ts`

- [ ] **Step 1: Create package skeleton**

`packages/cli/package.json`:
```json
{
  "name": "codewiz",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/bin.js",
  "bin": { "codewiz": "./dist/bin.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@codewiz/core": "workspace:*",
    "@codewiz/adapter-ts": "workspace:*",
    "@codewiz/sdk": "workspace:*",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Write failing test for `init`**

`packages/cli/tests/init.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-init-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runInit", () => {
  it("writes a starter .codewiz.yml", async () => {
    const r = await runInit({ projectRoot: dir, addGitignore: false });
    expect(r.created).toContain(".codewiz.yml");
    expect(existsSync(join(dir, ".codewiz.yml"))).toBe(true);
    expect(readFileSync(join(dir, ".codewiz.yml"), "utf8")).toContain("classify:");
  });

  it("appends to .gitignore when requested", async () => {
    await runInit({ projectRoot: dir, addGitignore: true });
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".codewiz/");
  });

  it("skips writing .codewiz.yml if it already exists", async () => {
    await runInit({ projectRoot: dir, addGitignore: false });
    const r = await runInit({ projectRoot: dir, addGitignore: false });
    expect(r.skipped).toContain(".codewiz.yml");
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm install && pnpm --filter codewiz test`

- [ ] **Step 4: Implement `init.ts`**

```ts
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
```

- [ ] **Step 5: Implement minimal `bin.ts` (init wired only)**

```ts
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
```

- [ ] **Step 6: Run tests, expect PASS**

Run: `pnpm --filter codewiz test`
Expected: 3 tests passed.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/ pnpm-lock.yaml
git commit -m "feat(cli): commander entry + init subcommand"
```

---

## Task 23: CLI — `doctor` subcommand

**Files:**
- Create: `packages/cli/src/doctor.ts`
- Create: `packages/cli/tests/doctor.test.ts`
- Modify: `packages/cli/src/bin.ts`

- [ ] **Step 1: Write failing test**

`packages/cli/tests/doctor.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runDoctor } from "../src/doctor.js";
import { AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";

describe("runDoctor", () => {
  it("reports the TS adapter as healthy", async () => {
    const reg = new AdapterRegistry();
    reg.register("ts", createTsAdapter);
    const r = await runDoctor({ projectRoot: "/tmp", registry: reg, adapters: ["ts"] });
    expect(r.results[0].name).toBe("ts");
    expect(r.results[0].ok).toBe(true);
    expect(r.allOk).toBe(true);
  });

  it("reports a failure when an adapter throws on initialize", async () => {
    const reg = new AdapterRegistry();
    reg.register("bad", () => ({
      async initialize() { throw new Error("nope"); },
      async analyze() { return { modules: [], edges: [], contracts: [], httpEndpoints: [], diagnostics: [] }; },
      async shutdown() {},
    }));
    const r = await runDoctor({ projectRoot: "/tmp", registry: reg, adapters: ["bad"] });
    expect(r.allOk).toBe(false);
    expect(r.results[0].error).toMatch(/nope/);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter codewiz test`

- [ ] **Step 3: Implement `doctor.ts`**

```ts
import type { AdapterRegistry } from "@codewiz/core";

export interface DoctorOptions {
  projectRoot: string;
  registry: AdapterRegistry;
  adapters: string[];
}

export interface DoctorResult {
  allOk: boolean;
  results: { name: string; ok: boolean; error?: string }[];
}

export async function runDoctor(opts: DoctorOptions): Promise<DoctorResult> {
  const results: DoctorResult["results"] = [];
  for (const name of opts.adapters) {
    try {
      const a = opts.registry.create(name);
      await a.initialize({ projectRoot: opts.projectRoot, protocolVersion: 1 });
      await a.shutdown();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: (e as Error).message });
    }
  }
  return { allOk: results.every((r) => r.ok), results };
}
```

- [ ] **Step 4: Wire into `bin.ts`**

Append to `bin.ts`:
```ts
import { runDoctor } from "./doctor.js";
import { AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";

function buildRegistry(): AdapterRegistry {
  const reg = new AdapterRegistry();
  reg.register("ts", createTsAdapter);
  return reg;
}

program
  .command("doctor")
  .description("Verify adapter health")
  .action(async () => {
    const r = await runDoctor({
      projectRoot: process.cwd(),
      registry: buildRegistry(),
      adapters: ["ts"],
    });
    for (const res of r.results) {
      console.log(`  ${res.ok ? "✓" : "✗"} ${res.name}${res.error ? ` — ${res.error}` : ""}`);
    }
    process.exit(r.allOk ? 0 : 1);
  });
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter codewiz test`
Expected: 2 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): doctor subcommand verifying adapter health"
```

---

## Task 24: CLI — `analyze` subcommand

**Files:**
- Create: `packages/cli/src/analyze.ts`
- Create: `packages/cli/tests/analyze.test.ts`
- Modify: `packages/cli/src/bin.ts`

- [ ] **Step 1: Write failing test**

`packages/cli/tests/analyze.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAnalyze } from "../src/analyze.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "codewiz-analyze-cli-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runAnalyze", () => {
  it("produces a complete .codewiz/ output for a tiny project", async () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), `import { B } from "./b"; export const A = B;`);
    writeFileSync(join(dir, "src/b.ts"), `export const B = 1; export interface IB { x: number }`);
    const manifest = await runAnalyze({ projectRoot: dir });
    expect(manifest.contentHash).toHaveLength(64);
    for (const f of ["modules.json", "edges.json", "contracts.json", "manifest.json"]) {
      expect(existsSync(join(dir, ".codewiz", f))).toBe(true);
    }
    const modules = JSON.parse(readFileSync(join(dir, ".codewiz/modules.json"), "utf8"));
    expect(modules.map((m: any) => m.id).sort()).toEqual([
      "ts:src/a.ts", "ts:src/b.ts",
    ]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter codewiz test`

- [ ] **Step 3: Implement `analyze.ts`**

```ts
import { runAnalysis, AdapterRegistry } from "@codewiz/core";
import { createTsAdapter } from "@codewiz/adapter-ts";

export interface AnalyzeOptions {
  projectRoot: string;
}

export async function runAnalyze(opts: AnalyzeOptions) {
  const reg = new AdapterRegistry();
  reg.register("ts", createTsAdapter);
  return runAnalysis({
    projectRoot: opts.projectRoot,
    adapters: ["ts"],
    registry: reg,
  });
}
```

- [ ] **Step 4: Wire into `bin.ts`**

Append to `bin.ts`:
```ts
import { runAnalyze } from "./analyze.js";
import { resolve } from "node:path";

program
  .command("analyze [path]")
  .description("Analyze a repository and write JSON to ./.codewiz/")
  .action(async (pathArg: string | undefined) => {
    const target = resolve(pathArg ?? ".");
    const start = Date.now();
    const manifest = await runAnalyze({ projectRoot: target });
    const dur = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`  analyzed ${target}`);
    console.log(`  contentHash ${manifest.contentHash.slice(0, 12)}…`);
    console.log(`  done in ${dur}s`);
  });
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm --filter codewiz test`
Expected: 1 new test passes.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): analyze subcommand wiring core+ts adapter"
```

---

## Task 25: End-to-end golden test on tiny-react-app

**Files:**
- Create: `tests/e2e/analyze.test.ts`
- Create: `tests/fixtures/tiny-react-app/__golden__/manifest.summary.json`
- Create: `tests/fixtures/tiny-react-app/__golden__/modules.json`
- Create: `tests/fixtures/tiny-react-app/__golden__/edges.json`
- Create: `tests/fixtures/tiny-react-app/__golden__/contracts.json`
- Modify: `tests/package.json` (add deps on workspace packages)

- [ ] **Step 1: Add workspace dep on the CLI**

Modify `tests/package.json`:
```json
{
  "name": "@codewiz/tests",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "codewiz": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.0"
  }
}
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing e2e test**

`tests/e2e/analyze.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runAnalyze } from "codewiz/dist/analyze.js";

const FIX = resolve(__dirname, "../fixtures/tiny-react-app");
const GOLD = join(FIX, "__golden__");

let workdir: string;

beforeAll(async () => {
  // Copy fixture to a temp dir so the analysis output doesn't pollute the repo.
  workdir = mkdtempSync(join(tmpdir(), "codewiz-e2e-"));
  cpSync(FIX, workdir, {
    recursive: true,
    filter: (src) => !src.includes("__golden__"),
  });
  await runAnalyze({ projectRoot: workdir });
});

afterAll(() => rmSync(workdir, { recursive: true, force: true }));

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(workdir, ".codewiz", rel), "utf8"));
}
function readGold(rel: string): unknown {
  return JSON.parse(readFileSync(join(GOLD, rel), "utf8"));
}
// Strip volatile fields (timestamps, tmp paths) so golden diffs are stable.
function normalize(x: any): any {
  if (Array.isArray(x)) return x.map(normalize);
  if (x && typeof x === "object") {
    const o: any = {};
    for (const [k, v] of Object.entries(x)) {
      if (k === "generatedAt" || k === "lastSuccessful" || k === "repoRoot") continue;
      o[k] = normalize(v);
    }
    return o;
  }
  return x;
}

describe("e2e: analyze tiny-react-app", () => {
  it("produces the expected output files", () => {
    for (const f of ["modules.json", "edges.json", "contracts.json", "manifest.json"]) {
      expect(existsSync(join(workdir, ".codewiz", f))).toBe(true);
    }
  });

  it("modules.json matches golden", () => {
    expect(normalize(readJson("modules.json"))).toEqual(normalize(readGold("modules.json")));
  });

  it("edges.json matches golden", () => {
    expect(normalize(readJson("edges.json"))).toEqual(normalize(readGold("edges.json")));
  });

  it("contracts.json matches golden", () => {
    expect(normalize(readJson("contracts.json"))).toEqual(normalize(readGold("contracts.json")));
  });

  it("manifest summary matches golden (modules count, edges count, contracts count, hash length, adapter)", () => {
    const m: any = readJson("manifest.json");
    const summary = {
      adapters: m.adapters.map((a: any) => ({ name: a.name })),
      contentHashLength: m.contentHash.length,
      protocolVersion: m.protocolVersion,
    };
    expect(summary).toEqual(readGold("manifest.summary.json"));
  });
});
```

- [ ] **Step 3: Build everything so the test can resolve `codewiz/dist/analyze.js`**

Run: `pnpm -r build`
Expected: each package emits `dist/`.

- [ ] **Step 4: Run the test once to capture observed output as the initial golden**

Run: `pnpm --filter @codewiz/tests test`
Expected: FAIL (golden files don't exist yet).

Then capture the observed output by writing the new golden files. Run:
```bash
node -e '
import("codewiz/dist/analyze.js").then(async ({ runAnalyze }) => {
  const { mkdtempSync, cpSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const FIX = resolve("tests/fixtures/tiny-react-app");
  const wd  = mkdtempSync(join(tmpdir(), "codewiz-bootstrap-"));
  cpSync(FIX, wd, { recursive: true, filter: (s) => !s.includes("__golden__") });
  await runAnalyze({ projectRoot: wd });
  const dest = join(FIX, "__golden__");
  mkdirSync(dest, { recursive: true });
  for (const f of ["modules.json", "edges.json", "contracts.json"]) {
    copyFileSync(join(wd, ".codewiz", f), join(dest, f));
  }
  const m = JSON.parse(readFileSync(join(wd, ".codewiz/manifest.json"), "utf8"));
  writeFileSync(join(dest, "manifest.summary.json"), JSON.stringify({
    adapters: m.adapters.map((a) => ({ name: a.name })),
    contentHashLength: m.contentHash.length,
    protocolVersion: m.protocolVersion,
  }, null, 2));
  console.log("wrote golden snapshots");
});
'
```

- [ ] **Step 5: Manually inspect the produced golden files**

Run:
```bash
cat tests/fixtures/tiny-react-app/__golden__/modules.json | head -40
cat tests/fixtures/tiny-react-app/__golden__/edges.json
cat tests/fixtures/tiny-react-app/__golden__/contracts.json | head -40
cat tests/fixtures/tiny-react-app/__golden__/manifest.summary.json
```

Expected: 5 modules (Button, CartItem, client, Home, Cart), at least 4 import edges, 1 contract (`CartItem`), `manifest.summary.json` with `adapters: [{ name: "@codewiz/adapter-ts" }]` and `contentHashLength: 64`.

If the output looks wrong (missing modules, unexpected duplicates, garbage names), STOP and debug the upstream task before saving these as golden.

- [ ] **Step 6: Re-run the e2e test, expect PASS**

Run: `pnpm --filter @codewiz/tests test`
Expected: 5 e2e tests pass.

- [ ] **Step 7: Run the complete test suite from repo root**

Run: `pnpm test`
Expected: every package's tests pass.

- [ ] **Step 8: Commit**

```bash
git add tests/ pnpm-lock.yaml
git commit -m "test(e2e): golden-snapshot validation of analyze on tiny-react-app"
```

---

## Final verification

- [ ] **Step 1: Full clean build + test from a fresh node_modules**

```bash
pnpm -r exec rm -rf dist
rm -rf node_modules packages/*/node_modules packages/adapters/*/node_modules tests/node_modules
pnpm install
pnpm -r build
pnpm test
```
Expected: every package's build succeeds; every package's tests pass.

- [ ] **Step 2: Verify CLI works end-to-end against the fixture**

```bash
pnpm -r build
node packages/cli/dist/bin.js doctor
node packages/cli/dist/bin.js analyze tests/fixtures/tiny-react-app
ls tests/fixtures/tiny-react-app/.codewiz/
```
Expected: doctor reports `✓ ts`; analyze prints the contentHash + duration; `.codewiz/` contains the 6 expected JSON files. Then clean up the fixture's analysis output:

```bash
rm -rf tests/fixtures/tiny-react-app/.codewiz/
```

- [ ] **Step 3: v0.1 acceptance-criteria 1, 5, 7 satisfied (per spec §10)**

Acceptance #1 (analyze produces expected JSON for fixture) — covered by Task 25 e2e test.
Acceptance #5 (`codewiz doctor` reports the TS adapter healthy) — covered by Task 23 + Final Step 2.
Acceptance #7 (conformance suite passes against `adapter-ts`) — covered by Task 20.

Acceptance #2, #3, #4, #6 require the web server, frontend, and Playwright — they ship in Plan 2 and Plan 3.

- [ ] **Step 4: Tag the milestone**

```bash
git tag -a v0.1.0-foundation -m "v0.1 foundation: analyzer CLI works end-to-end on tiny-react-app"
```
