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
