// All views for codeWizualizer
const { useState: useStateV, useMemo: useMemoV, useEffect: useEffectV, useRef: useRefV } = React;

// ───────── Layer dot helper ─────────
function LayerDot({ layer, size = 8 }) {
  const layers = window.__DATA__.LAYERS;
  const c = layers[layer]?.color || "var(--text-faint)";
  return <span className="layer-dot" style={{ width: size, height: size, background: c }} />;
}

// ───────── Architecture overview (hero) ─────────
function ArchitectureView({ data, selected, onSelect, groupKey }) {
  const layers = data.LAYERS;
  const wrapRef = useRefV(null);
  const [size, setSize] = useStateV({ w: 800, h: 600 });
  useEffectV(() => {
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Layered, swimlane-ish layout
  const lanes = ["ui", "state", "api", "service", "data", "external"];
  const padding = 40;
  const laneH = (size.h - padding * 2) / lanes.length;
  const groups = useMemoV(() => {
    const g = {};
    lanes.forEach(l => g[l] = data.modules.filter(m => m.layer === l));
    return g;
  }, [data]);

  const positions = useMemoV(() => {
    const p = {};
    lanes.forEach((l, li) => {
      const list = groups[l];
      const y = padding + laneH * li + laneH / 2;
      const colW = (size.w - 100) / Math.max(list.length, 1);
      list.forEach((m, i) => {
        p[m.id] = { x: 60 + colW * i + colW / 2, y };
      });
    });
    return p;
  }, [groups, size]);

  const neighbor = useMemoV(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    data.edges.forEach(e => {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    });
    return s;
  }, [selected, data.edges]);

  return (
    <div className="canvas-wrap arch-canvas" ref={wrapRef}>
      <svg className="graph-svg" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="xMidYMid meet">
        {/* Lane backgrounds + labels */}
        {lanes.map((l, i) => {
          const lay = layers[l];
          const y = padding + laneH * i;
          return (
            <g key={l}>
              <rect x="20" y={y + 4} width={size.w - 40} height={laneH - 8}
                    fill={i % 2 ? "rgba(255,255,255,0.012)" : "rgba(255,255,255,0.025)"}
                    rx="6" />
              <text x="32" y={y + 18} fill={lay.color} fontFamily="JetBrains Mono" fontSize="10" letterSpacing="1.5">
                {lay.label.toUpperCase()}
              </text>
              <text x="32" y={y + 32} fill="var(--text-faint)" fontFamily="JetBrains Mono" fontSize="9">
                {groups[l].length} modules
              </text>
            </g>
          );
        })}

        {/* Edges */}
        {data.edges.map((e, i) => {
          const a = positions[e.source], b = positions[e.target];
          if (!a || !b) return null;
          const dim = neighbor && (!neighbor.has(e.source) || !neighbor.has(e.target));
          const c = e.kind === "http" ? "var(--amber)" : e.kind === "calls" ? "var(--violet)" : e.kind === "data" ? "var(--green)" : "var(--cyan)";
          // Curved bezier
          const my = (a.y + b.y) / 2;
          const cx1 = a.x, cy1 = my;
          const cx2 = b.x, cy2 = my;
          return (
            <path key={i}
                  d={`M ${a.x} ${a.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${b.x} ${b.y}`}
                  stroke={c} fill="none" strokeWidth="1"
                  opacity={dim ? 0.04 : 0.32}
                  strokeDasharray={e.kind === "http" ? "4 3" : ""} />
          );
        })}

        {/* Nodes */}
        {data.modules.map(m => {
          const p = positions[m.id]; if (!p) return null;
          const lay = layers[m.layer];
          const isExt = m.layer === "external";
          const dim = neighbor && !neighbor.has(m.id);
          const w = Math.max(70, m.name.length * 6.6 + 14);
          return (
            <g key={m.id} className={`graph-node ${selected === m.id ? "selected" : ""} ${dim ? "dim" : ""}`}
               transform={`translate(${p.x},${p.y})`} onClick={() => onSelect(m.id)}>
              <rect x={-w / 2} y="-13" width={w} height="26" rx={isExt ? 3 : 6}
                    fill="var(--bg-elev)" stroke={lay.color} strokeWidth="1.1"
                    strokeDasharray={isExt ? "3 2" : ""} />
              <circle cx={-w / 2 + 9} cy="0" r="3" fill={lay.color} />
              <text x="3" y="3" fontSize="10.5" fontFamily="JetBrains Mono" fill="var(--text)">
                {m.name}
              </text>
              {m.annotation && (
                <circle cx={w / 2 - 7} cy="-7" r="3"
                        fill={m.annotation === "err" ? "var(--pink)" :
                              m.annotation === "warn" ? "var(--amber)" :
                              m.annotation === "new" ? "var(--green)" : "var(--violet)"} />
              )}
            </g>
          );
        })}
      </svg>

      <div className="legend">
        <div style={{ color: "var(--text)", fontSize: 10, marginBottom: 4, letterSpacing: "0.08em" }}>LAYERS</div>
        {Object.entries(layers).map(([k, v]) =>
          <div key={k} className="lg-row">
            <span className="lg-dot" style={{ background: v.color }} />
            <span>{v.label}</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0 4px" }} />
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--cyan)" }} /><span>imports</span></div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--violet)" }} /><span>calls</span></div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--green)" }} /><span>data</span></div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--amber)", borderTop: "1px dashed" }} /><span>http</span></div>
      </div>
    </div>
  );
}

// ───────── Dependencies (force graph) ─────────
function DependenciesView({ data, selected, onSelect, groupKey, layoutMode }) {
  const wrapRef = useRefV(null);
  const [size, setSize] = useStateV({ w: 900, h: 600 });
  useEffectV(() => {
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const [edgeFilter, setEdgeFilter] = useStateV(new Set(["imports", "calls", "http", "data"]));
  const toggleKind = (k) => setEdgeFilter(s => {
    const n = new Set(s);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <window.ForceGraph
        modules={data.modules}
        edges={data.edges}
        mode={layoutMode}
        groupKey={groupKey}
        edgeFilter={edgeFilter}
        selectedId={selected}
        highlight={selected}
        onSelect={onSelect}
        width={size.w}
        height={size.h}
      />

      <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6 }}>
        {["imports", "calls", "http", "data"].map(k =>
          <button key={k}
                  className={`toolbar-btn ${edgeFilter.has(k) ? "active" : ""}`}
                  onClick={() => toggleKind(k)}>
            {k}
          </button>
        )}
      </div>

      <div className="legend">
        <div style={{ color: "var(--text)", fontSize: 10, marginBottom: 4, letterSpacing: "0.08em" }}>EDGE</div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--cyan)" }} />imports</div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--violet)" }} />calls</div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--green)" }} />data</div>
        <div className="lg-row"><span className="lg-line" style={{ background: "var(--amber)" }} />http</div>
      </div>
    </div>
  );
}

// ───────── Functional / Data flow view ─────────
function FlowView({ data, selected, onSelect, mode = "functional" }) {
  const layers = data.LAYERS;
  const flows = mode === "data" ? data.dataFlows : data.flows;
  const [activeFlow, setActiveFlow] = useStateV(flows[0].id);
  useEffectV(() => { setActiveFlow(flows[0].id); }, [mode]);
  const flow = flows.find(f => f.id === activeFlow) || flows[0];
  const modById = useMemoV(() => Object.fromEntries(data.modules.map(m => [m.id, m])), [data]);

  const fmtPayload = (p) => {
    if (p == null) return null;
    if (typeof p === "string") return p;
    return JSON.stringify(p).replace(/,/g, ", ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="flow-list">
        {flows.map(f => (
          <div key={f.id} className={`flow-card ${activeFlow === f.id ? "active" : ""}`} onClick={() => setActiveFlow(f.id)}>
            <div className="name">{f.name}</div>
            <div className="desc">{f.steps.length} steps · {f.health}</div>
          </div>
        ))}
      </div>
      <div className="flow-canvas">
        <div style={{ maxWidth: 760 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{flow.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: 4 }}>{flow.desc}</div>
          </div>
          {flow.steps.map((s, i) => {
            const m = modById[s.mod];
            const payload = fmtPayload(s.payload);
            return (
              <div key={i} className="flow-step">
                <div className="rail">
                  <div className="dot" style={{ borderColor: layers[m?.layer || "core"]?.color }} />
                  <div className="line" />
                </div>
                <div className={`body ${selected === s.mod ? "selected" : ""}`} onClick={() => onSelect(s.mod)}>
                  <div className="actor">
                    <LayerDot layer={m?.layer} size={7} />
                    <span>{m?.name || s.mod}</span>
                    <span style={{ color: "var(--text-faint)", marginLeft: 6, fontSize: 10 }}>· {m?.path}</span>
                    {s.contract && (
                      <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10,
                                     color: "var(--cyan)", background: "var(--cyan-dim)",
                                     padding: "1px 6px", borderRadius: 3 }}>
                        {s.contract}
                      </span>
                    )}
                  </div>
                  <div className="action">{s.action}</div>
                  {payload && (
                    <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11,
                                  background: "var(--bg)", padding: "6px 8px", borderRadius: 3,
                                  color: "var(--text-dim)", border: "1px solid var(--border)",
                                  whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      <span style={{ color: "var(--text-faint)" }}>payload </span>
                      <span style={{ color: s.warn ? "var(--amber)" : "var(--green)" }}>{payload}</span>
                    </div>
                  )}
                  {s.note && <div className="meta"><span className={s.warn ? "warn" : ""}>↳ {s.note}</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────── Contract / type-graph explorer ─────────
function ContractsView({ data, selected, onSelect }) {
  const [activeId, setActiveId] = useStateV(data.contracts[0].id);
  const contract = data.contracts.find(c => c.id === activeId);
  const wrapRef = useRefV(null);
  const [size, setSize] = useStateV({ w: 900, h: 600 });
  useEffectV(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Type-graph layout
  const cx = size.w / 2, cy = size.h / 2;
  const producers = contract.producers;
  const consumers = contract.consumers;
  const related = contract.related || [];
  const modById = Object.fromEntries(data.modules.map(m => [m.id, m]));
  const contractById = Object.fromEntries(data.contracts.map(c => [c.id, c]));

  return (
    <div className="contract-shell">
      <div className="contract-list">
        <div className="grp-head">Interfaces · {data.contracts.length}</div>
        {data.contracts.map(c => {
          const issues = c.issues.length;
          return (
            <div key={c.id} className={`contract-row ${activeId === c.id ? "active" : ""}`} onClick={() => setActiveId(c.id)}>
              <div className="badge">T</div>
              <div>
                <div className="name">{c.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                  {c.fields.length} fields · {c.consumers.length} consumers
                </div>
              </div>
              <div className="stat" style={{ color: issues ? "var(--amber)" : "var(--text-faint)" }}>
                {issues ? `${issues}⚠` : "ok"}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={wrapRef} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <svg className="graph-svg" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="xMidYMid meet">
          {/* Center contract block */}
          <g transform={`translate(${cx},${cy})`}>
            <rect x="-130" y="-110" width="260" height="220" rx="10"
                  fill="var(--bg-elev)" stroke="var(--cyan)" strokeWidth="1.4" />
            <text x="0" y="-86" textAnchor="middle" fontFamily="JetBrains Mono"
                  fontSize="13" fill="var(--cyan)" fontWeight="600">
              interface {contract.name}
            </text>
            {contract.fields.map((f, i) => {
              const issue = contract.issues.find(x => x.field === f.name);
              return (
                <g key={f.name} transform={`translate(0, ${-58 + i * 22})`}>
                  <text x="-118" y="0" fontFamily="JetBrains Mono" fontSize="10.5"
                        fill={issue ? "var(--amber)" : "var(--text)"}>
                    {f.name}{f.required ? "" : "?"}
                  </text>
                  <text x="118" y="0" textAnchor="end" fontFamily="JetBrains Mono" fontSize="10"
                        fill={issue ? "var(--amber)" : "var(--text-dim)"}>
                    {f.type}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Producers (left) */}
          {producers.map((pid, i) => {
            const m = modById[pid]; if (!m) return null;
            const x = 100, y = 100 + i * 60;
            return (
              <g key={pid} className="graph-node" transform={`translate(${x},${y})`} onClick={() => onSelect(pid)}>
                <line x1="60" y1="0" x2={cx - 130 - x} y2={cy - y} stroke="var(--green)" strokeWidth="1" opacity="0.5" markerEnd="url(#arrow)" />
                <rect x="-50" y="-12" width="120" height="24" rx="4" fill="var(--bg-elev)" stroke="var(--green)" strokeWidth="1" />
                <text x="10" y="3" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--text)">{m.name}</text>
                <text x="-50" y="-18" fontFamily="JetBrains Mono" fontSize="9" fill="var(--green)">producer</text>
              </g>
            );
          })}

          {/* Consumers (right) */}
          {consumers.map((cid, i) => {
            const m = modById[cid]; if (!m) return null;
            const x = size.w - 130, y = 100 + i * 50;
            const issue = contract.issues.find(x => x.consumer === cid);
            return (
              <g key={cid} className="graph-node" transform={`translate(${x},${y})`} onClick={() => onSelect(cid)}>
                <line x1={-(x - cx - 130)} y1={cy - y} x2="-50" y2="0"
                      stroke={issue ? "var(--amber)" : "var(--cyan)"} strokeWidth="1"
                      opacity="0.5" strokeDasharray={issue ? "3 2" : ""} markerEnd="url(#arrow)" />
                <rect x="-50" y="-12" width="120" height="24" rx="4"
                      fill="var(--bg-elev)" stroke={issue ? "var(--amber)" : "var(--cyan)"} strokeWidth="1" />
                <text x="10" y="3" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--text)">{m.name}</text>
                {issue && <circle cx="55" cy="-9" r="4" fill="var(--amber)" />}
              </g>
            );
          })}

          {/* Related contracts (bottom) */}
          {related.map((rid, i) => {
            const r = contractById[rid]; if (!r) return null;
            const x = cx - 100 + i * 100, y = size.h - 60;
            return (
              <g key={rid} className="graph-node" transform={`translate(${x},${y})`} onClick={() => setActiveId(rid)}>
                <line x1="0" y1="-12" x2={cx - x} y2={-(y - cy - 110)} stroke="var(--violet)" strokeWidth="1" opacity="0.4" strokeDasharray="2 3" />
                <rect x="-44" y="-12" width="88" height="22" rx="4" fill="var(--bg-elev)" stroke="var(--violet)" strokeWidth="1" />
                <text x="0" y="3" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--text)">{r.name}</text>
              </g>
            );
          })}

          <defs>
            <marker id="arrow" viewBox="0 -4 8 8" refX="6" refY="0" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,-3L6,0L0,3" fill="currentColor" opacity="0.7" />
            </marker>
          </defs>
        </svg>

        {/* Issues panel — side-by-side schema diffs */}
        {contract.issues.length > 0 && (
          <div style={{ position: "absolute", bottom: 14, left: 14, right: 14,
                        background: "rgba(18,22,30,0.97)", border: "1px solid var(--amber)",
                        borderRadius: 6, padding: 0, maxHeight: "55%", overflow: "auto",
                        backdropFilter: "blur(8px)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)",
                          letterSpacing: "0.08em", padding: "10px 14px",
                          borderBottom: "1px solid var(--border)" }}>
              ⚠  CONTRACT MISMATCHES · {contract.issues.length}
            </div>
            {contract.issues.map((iss, i) => {
              const consumerMod = modById[iss.consumer];
              const producerMod = modById[iss.producer];
              return (
                <div key={i} style={{ padding: "10px 14px", borderBottom: i < contract.issues.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: 600 }}>
                      {iss.field}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 6px",
                                   borderRadius: 3, background: "var(--amber-dim)", color: "var(--amber)",
                                   textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {iss.kind}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{iss.note}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {/* Producer side (actual / what's served) */}
                    <DiffCard
                      label="Producer · what's actually served"
                      mod={producerMod}
                      onJump={() => onSelect(iss.producer)}
                      shape={iss.actual}
                      tone="green"
                    />
                    {/* Consumer side (expected) */}
                    <DiffCard
                      label="Consumer · what code expects"
                      mod={consumerMod}
                      onJump={() => onSelect(iss.consumer)}
                      shape={iss.expected}
                      tone="amber"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── Schema diff card (used in contract mismatches) ─────────
function DiffCard({ label, mod, onJump, shape, tone }) {
  const c = tone === "green" ? "var(--green)" : tone === "amber" ? "var(--amber)" : "var(--cyan)";
  const bg = tone === "green" ? "var(--green-dim)" : tone === "amber" ? "var(--amber-dim)" : "var(--cyan-dim)";
  return (
    <div style={{ border: `1px solid var(--border)`, borderRadius: 5,
                  background: "var(--bg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 10px", background: bg, borderBottom: `1px solid ${c}` }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: c,
                       letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)",
                      cursor: "pointer", marginBottom: 4 }} onClick={onJump}>
          {mod?.path || "—"}<span style={{ color: c }}> {shape?.source ? `· ${shape.source.split(":").pop()}` : ""}</span>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>
          <span style={{ color: "var(--text-dim)" }}>{shape.name}</span>
          <span style={{ color: "var(--text-faint)" }}>{shape.required ? ":" : "?:"} </span>
          <span style={{ color: c, fontWeight: 500 }}>{shape.type}</span>
        </div>
        {shape.snippet && (
          <pre style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 10.5,
                        color: "var(--text-dim)", background: "var(--bg-elev)",
                        padding: "6px 8px", borderRadius: 3, whiteSpace: "pre-wrap",
                        borderLeft: `2px solid ${c}`, overflow: "hidden" }}>
            {shape.snippet}
          </pre>
        )}
      </div>
    </div>
  );
}

// ───────── File explorer with annotations ─────────
function FilesView({ data, selected, onSelect }) {
  const layers = data.LAYERS;
  const [active, setActive] = useStateV(selected || data.modules[0].id);
  useEffectV(() => { if (selected) setActive(selected); }, [selected]);
  const m = data.modules.find(x => x.id === active) || data.modules[0];

  // Synthetic source preview keyed off path
  const code = synthCode(m, data);

  return (
    <div className="file-shell">
      <div className="file-list">
        <div className="file-head">
          <div>Path</div><div>LOC</div><div>Owner</div><div>Health</div>
        </div>
        {data.modules.map(mod => (
          <div key={mod.id} className={`file-row ${active === mod.id ? "selected" : ""}`}
               onClick={() => { setActive(mod.id); onSelect(mod.id); }}>
            <div className="path">
              <LayerDot layer={mod.layer} size={6} />
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
            <div className="v" style={{ color: "var(--text-faint)" }}>{mod.owner}</div>
            <div className="v" style={{ color: mod.health > 0.8 ? "var(--green)" : mod.health > 0.6 ? "var(--amber)" : "var(--pink)" }}>
              {Math.round(mod.health * 100)}%
            </div>
          </div>
        ))}
      </div>

      <div className="code-pane">
        <div style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>
          {m.path} · {m.loc} LOC · owned by {m.owner}
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

function synthCode(m, data) {
  const importsList = data.edges
    .filter(e => e.source === m.id && (e.kind === "imports" || e.kind === "calls"))
    .map(e => data.modules.find(x => x.id === e.target))
    .filter(Boolean);

  const cl = (s, k) => `<span class="cl-${k}">${s}</span>`;

  const lines = [];
  lines.push({ html: cl("// " + m.path, "com") });
  lines.push({ html: "" });
  importsList.slice(0, 4).forEach(imp => {
    lines.push({
      html: `${cl("import", "kw")} { ${cl(imp.name, "fn")} } ${cl("from", "kw")} ${cl(`'./${imp.name}'`, "str")};`
    });
  });
  if (importsList.length) lines.push({ html: "" });

  const sig = m.kind === "service" || m.kind === "client"
    ? `${cl("export class", "kw")} ${cl(m.name, "ty")} {`
    : m.kind === "hook" || m.kind === "store"
    ? `${cl("export function", "kw")} ${cl(m.name, "fn")}() {`
    : m.kind === "model"
    ? `${cl("export interface", "kw")} ${cl(m.name.split(" ")[0], "ty")} {`
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
        note: m.notes || "Reviewer flagged this region",
      });
    }
    if (m.annotation === "dup") {
      lines.push({
        html: `  ${cl(`// Logic duplicated with sibling module`, "com")}`,
        highlight: true,
        note: "Same reducer shape exists in cartStore — consolidate.",
      });
    }
    importsList.slice(0, 2).forEach(imp => {
      lines.push({ html: `  ${cl("await", "kw")} ${cl(imp.name, "fn")}.${cl("call", "fn")}();` });
    });
    lines.push({ html: m.kind === "route" ? "});" : "}" });
  }
  return lines;
}

window.Views = { ArchitectureView, DependenciesView, FlowView, ContractsView, FilesView };
