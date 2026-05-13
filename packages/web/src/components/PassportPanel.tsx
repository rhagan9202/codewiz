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
