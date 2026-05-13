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
