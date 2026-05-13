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
