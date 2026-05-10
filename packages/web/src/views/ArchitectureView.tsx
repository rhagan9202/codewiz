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
            <path key={`${e.source}|${e.target}|${e.kind}|${i}`}
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
