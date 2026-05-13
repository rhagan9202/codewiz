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
