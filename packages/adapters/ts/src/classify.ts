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
  if (/\bservices?\/|\bmiddleware\//.test(p)) return "service";
  if (/\bmodels?\/|\bdata\/|\bdb\b|\bcache\b/.test(p)) return "data";
  if (/\bapi\/|\broutes?\//.test(p)) return "api";
  return "service";
}
