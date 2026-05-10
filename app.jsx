// codeWizualizer — App shell
const { useState: useS, useMemo: useM, useEffect: useE, useRef: useR } = React;

function Sidebar({ view, setView, modules, selectedId, onSelect, query, setQuery }) {
  const layers = window.__DATA__.LAYERS;

  const tree = useM(() => {
    const root = {};
    modules.forEach(m => {
      if (m.layer === "external") return;
      const parts = m.path.split("/");
      let cur = root;
      parts.forEach((p, i) => {
        if (i === parts.length - 1) {
          cur._files = cur._files || [];
          cur._files.push(m);
        } else {
          cur[p] = cur[p] || {};
          cur = cur[p];
        }
      });
    });
    return root;
  }, [modules]);

  const [collapsed, setCollapsed] = useS(new Set(["external"]));
  const toggle = (k) => setCollapsed(s => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const renderTree = (node, prefix = "", depth = 0) => {
    const out = [];
    Object.keys(node).filter(k => k !== "_files").sort().forEach(k => {
      const path = prefix + k;
      const isCol = collapsed.has(path);
      out.push(
        <div key={"d:" + path} className="tree-node" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => toggle(path)}>
          <span className="chev">{isCol ? "▸" : "▾"}</span>
          <span style={{ color: "var(--text-dim)" }}>{k}</span>
        </div>
      );
      if (!isCol) {
        out.push(...renderTree(node[k], path + "/", depth + 1));
      }
    });
    (node._files || []).forEach(f => {
      if (query && !f.name.toLowerCase().includes(query.toLowerCase()) && !f.path.toLowerCase().includes(query.toLowerCase())) return;
      out.push(
        <div key={"f:" + f.id}
             className={`tree-node ${selectedId === f.id ? "selected" : ""}`}
             style={{ paddingLeft: 8 + (depth + 1) * 12 }}
             onClick={() => onSelect(f.id)}>
          <span className="layer-dot" style={{ background: layers[f.layer].color }} />
          <span style={{ color: "var(--text)" }}>{f.path.split("/").slice(-1)[0]}</span>
          {f.annotation && (
            <span className={`annotation ${f.annotation}`}>
              {f.annotation === "err" ? "bug" :
               f.annotation === "warn" ? "rev" :
               f.annotation === "new" ? "new" : "dup"}
            </span>
          )}
        </div>
      );
    });
    return out;
  };

  const navItems = [
    { id: "arch",   label: "Architecture",  k: "1", icon: <ArchIcon /> },
    { id: "deps",   label: "Dependencies",  k: "2", icon: <DepIcon /> },
    { id: "flow",   label: "Functional flow", k: "3", icon: <FlowIcon /> },
    { id: "data",   label: "Data flow",     k: "4", icon: <DataIcon /> },
    { id: "contract", label: "Contracts",   k: "5", icon: <ContractIcon /> },
    { id: "files",  label: "Files",         k: "6", icon: <FileIcon /> },
  ];

  return (
    <div className="sidebar">
      <div className="nav">
        <div className="nav-label">Views</div>
        {navItems.map(it =>
          <div key={it.id} className={`nav-item ${view === it.id ? "active" : ""}`} onClick={() => setView(it.id)}>
            <span className="ico">{it.icon}</span>
            <span>{it.label}</span>
            <span className="kbd">{it.k}</span>
          </div>
        )}
      </div>

      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <div className="searchbar" style={{ width: "auto" }}>
          <span style={{ color: "var(--text-faint)", marginRight: 6 }}>⌕</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="filter files…" />
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

const ArchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1" /><rect x="9.5" y="1.5" width="5" height="5" rx="1" />
    <rect x="1.5" y="9.5" width="5" height="5" rx="1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" />
  </svg>
);
const DepIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="3" cy="3" r="2" /><circle cx="13" cy="4" r="2" /><circle cx="8" cy="13" r="2" />
    <line x1="3" y1="3" x2="13" y2="4" /><line x1="13" y1="4" x2="8" y2="13" /><line x1="3" y1="3" x2="8" y2="13" />
  </svg>
);
const FlowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="3" cy="3" r="1.5" /><circle cx="3" cy="13" r="1.5" /><circle cx="13" cy="8" r="1.5" />
    <path d="M3 4.5 V 11.5" /><path d="M4.5 13 H 11.5" /><path d="M3 3 Q 13 3 13 6.5" />
  </svg>
);
const DataIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <ellipse cx="8" cy="3.5" rx="5" ry="1.5" /><path d="M3 3.5 V 12.5 Q 8 14 13 12.5 V 3.5" />
    <path d="M3 8 Q 8 9.5 13 8" />
  </svg>
);
const ContractIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="2" width="12" height="12" rx="1.5" />
    <line x1="4" y1="6" x2="12" y2="6" /><line x1="4" y1="9" x2="9" y2="9" /><line x1="4" y1="12" x2="11" y2="12" />
  </svg>
);
const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M3 1.5 H 9 L 13 5.5 V 14.5 H 3 Z" /><path d="M9 1.5 V 5.5 H 13" />
  </svg>
);

// ───────── Passport panel (unified inspector) ─────────
function PassportPanel({ modules, edges, contracts, flows, selectedId, onSelect, onClose, onJump }) {
  const m = modules.find(x => x.id === selectedId);
  if (!m) return null;
  const layers = window.__DATA__.LAYERS;

  const importsOut = edges.filter(e => e.source === m.id && e.kind === "imports").map(e => modules.find(x => x.id === e.target)).filter(Boolean);
  const importsIn  = edges.filter(e => e.target === m.id && e.kind === "imports").map(e => modules.find(x => x.id === e.source)).filter(Boolean);
  const calls      = edges.filter(e => e.source === m.id && (e.kind === "calls" || e.kind === "http")).map(e => modules.find(x => x.id === e.target)).filter(Boolean);
  const dataT      = edges.filter(e => e.source === m.id && e.kind === "data").map(e => modules.find(x => x.id === e.target)).filter(Boolean);
  const usedContracts = contracts.filter(c => c.producers.includes(m.id) || c.consumers.includes(m.id));
  const inFlows = flows.filter(f => f.steps.some(s => s.mod === m.id));

  const healthSegs = 8;
  const filled = Math.round(m.health * healthSegs);

  return (
    <div className="passport">
      <div className="pp-head">
        <div>
          <div className="pp-name">{m.name}</div>
          <div className="pp-path">{m.path}</div>
          <div className="pp-tags">
            <span className="tag layer">{layers[m.layer].label}</span>
            <span className="tag team">{window.__DATA__.TEAMS[m.team]?.label || m.team}</span>
            <span className="tag domain">{window.__DATA__.DOMAINS[m.domain]?.label || m.domain}</span>
            <span className="tag">{m.kind}</span>
          </div>
        </div>
        <button className="x" onClick={onClose}>×</button>
      </div>

      <div className="pp-body">
        <div className="pp-section">
          <h4>Stats</h4>
          <div className="pp-stat"><span>Lines</span><span className="v">{m.loc}</span></div>
          <div className="pp-stat"><span>Owner</span><span className="v">{m.owner}</span></div>
          <div className="pp-stat"><span>Health</span><span className="v">{Math.round(m.health * 100)}%</span></div>
          <div className="pp-health">
            {[...Array(healthSegs)].map((_, i) => <div key={i} className={`seg-bar ${i < filled ? "on" : ""}`}
              style={i < filled && m.health < 0.7 ? { background: m.health < 0.6 ? "var(--pink)" : "var(--amber)" } : {}} />)}
          </div>
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
            {importsOut.map(x => (
              <div key={x.id} className="pp-row" onClick={() => onSelect(x.id)}>
                <LayerDot layer={x.layer} size={6} />
                <span style={{ color: "var(--text)" }}>{x.name}</span>
                <span style={{ color: "var(--text-faint)", marginLeft: "auto" }}>{x.kind}</span>
              </div>
            ))}
          </div>
        )}

        {importsIn.length > 0 && (
          <div className="pp-section">
            <h4>Imported by ← {importsIn.length}</h4>
            {importsIn.map(x => (
              <div key={x.id} className="pp-row" onClick={() => onSelect(x.id)}>
                <LayerDot layer={x.layer} size={6} />
                <span style={{ color: "var(--text)" }}>{x.name}</span>
              </div>
            ))}
          </div>
        )}

        {calls.length > 0 && (
          <div className="pp-section">
            <h4>Calls / HTTP → {calls.length}</h4>
            {calls.map(x => (
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
            {dataT.map(x => (
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
            {usedContracts.map(c => {
              const role = c.producers.includes(m.id) ? "produces" : "consumes";
              const issue = c.issues.find(i => i.consumer === m.id);
              return (
                <div key={c.id} className="pp-row" onClick={() => onJump("contract", c.id)}>
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
            {inFlows.map(f => (
              <div key={f.id} className="pp-row" onClick={() => onJump("flow", f.id)}>
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

// ───────── App ─────────
function App() {
  const data = window.__DATA__;
  const [stage, setStage] = useS("picker");  // picker | analyzing | ready
  const [repo, setRepo] = useS(null);
  const [view, setView] = useS("arch");
  const [selectedId, setSelectedId] = useS(null);
  const [groupKey, setGroupKey] = useS("layer");
  const [query, setQuery] = useS("");
  const [layoutMode, setLayoutMode] = useS("force");
  const [showPassport, setShowPassport] = useS(true);

  const onPickRepo = (r) => { setRepo(r); setStage("analyzing"); };
  const onAnalyzed = () => setStage("ready");

  const TWEAKS = /*EDITMODE-BEGIN*/{
    "groupBy": "layer",
    "density": 1,
    "showAnnotations": true,
    "accent": "cyan"
  }/*EDITMODE-END*/;

  const tweaks = window.useTweaks ? window.useTweaks(TWEAKS) : null;
  const t = tweaks ? tweaks[0] : TWEAKS;
  const setTweak = tweaks ? tweaks[1] : () => {};

  useE(() => {
    if (t.groupBy && t.groupBy !== groupKey) setGroupKey(t.groupBy);
  }, [t.groupBy]);

  // Apply accent to root
  useE(() => {
    document.documentElement.style.setProperty("--accent",
      t.accent === "violet" ? "var(--violet)" :
      t.accent === "green"  ? "var(--green)"  :
      t.accent === "amber"  ? "var(--amber)"  : "var(--cyan)");
  }, [t.accent]);

  // Keyboard shortcuts
  useE(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      const k = e.key;
      if (k === "1") setView("arch");
      else if (k === "2") setView("deps");
      else if (k === "3") setView("flow");
      else if (k === "4") setView("data");
      else if (k === "5") setView("contract");
      else if (k === "6") setView("files");
      else if (k === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSelect = (id) => { setSelectedId(id); setShowPassport(true); };
  const onJump = (target, payload) => {
    if (target === "contract") setView("contract");
    if (target === "flow") setView("flow");
  };

  const titleFor = {
    arch:     "Architecture overview",
    deps:     "Dependency graph",
    flow:     "Functional flow",
    data:     "Data flow",
    contract: "Contract explorer",
    files:    "Files",
  };
  const subtitleFor = {
    arch:     "modules layered by responsibility · click to open passport",
    deps:     "force-directed graph · " + groupKey,
    flow:     "user actions traced through the call path",
    data:     "where data moves through the system",
    contract: "type-graph · producers, consumers, mismatches",
    files:    "with reviewer annotations and source preview",
  };

  if (stage === "picker") {
    return <window.RepoPicker onPick={onPickRepo} />;
  }
  if (stage === "analyzing") {
    return (
      <>
        <window.RepoPicker onPick={() => {}} />
        <window.AnalyzeOverlay repo={repo} onDone={onAnalyzed} />
      </>
    );
  }

  return (
    <div className="app">
      <div className="titlebar">
        <div className="brand">
          <div className="brand-mark"></div>
          <span>codeWizualizer</span>
        </div>
        <div className="crumbs">
          <span style={{color: "var(--text-faint)", fontSize: 10}}>
            {repo?.kind === "github" ? "github" : repo?.kind === "local" ? "local" : "demo"} ·
          </span>
          <span className="repo">{repo?.label || "acme/web-shop"}</span>
          <span className="sep">/</span>
          <span className="branch">⎇ {repo?.branch || "main"}</span>
          <span className="sep">·</span>
          <span>{data.modules.length} modules · {data.contracts.length} contracts</span>
          <button className="switch-repo" style={{marginLeft: 8}} onClick={() => { setStage("picker"); setRepo(null); }}>
            switch repo
          </button>
        </div>
        <div className="right">
          <span className="pill live">analysis fresh · just now</span>
          <span className="pill">{data.contracts.filter(c => c.issues.length).length} mismatches</span>
        </div>
      </div>

      <Sidebar
        view={view} setView={setView}
        modules={data.modules}
        selectedId={selectedId}
        onSelect={onSelect}
        query={query} setQuery={setQuery}
      />

      <div className="main">
        <div className="main-toolbar">
          <div>
            <div className="title">{titleFor[view]}</div>
            <div className="subtitle">{subtitleFor[view]}</div>
          </div>
          <div className="right">
            <span style={{ fontSize: 11, color: "var(--text-faint)", marginRight: 6, fontFamily: "var(--font-mono)" }}>group by</span>
            <div className="seg">
              {["layer", "team", "domain"].map(k =>
                <button key={k} className={groupKey === k ? "active" : ""}
                        onClick={() => { setGroupKey(k); setTweak("groupBy", k); }}>
                  {k}
                </button>
              )}
            </div>
            {view === "deps" && (
              <div className="seg" style={{ marginLeft: 6 }}>
                {[["force", "force"], ["layered", "layered"], ["radial", "radial"]].map(([k, l]) =>
                  <button key={k} className={layoutMode === k ? "active" : ""} onClick={() => setLayoutMode(k)}>
                    {l}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="canvas-wrap">
          {view === "arch"     && <window.Views.ArchitectureView data={data} selected={selectedId} onSelect={onSelect} groupKey={groupKey} />}
          {view === "deps"     && <window.Views.DependenciesView data={data} selected={selectedId} onSelect={onSelect} groupKey={groupKey} layoutMode={layoutMode} />}
          {view === "flow"     && <window.Views.FlowView data={data} selected={selectedId} onSelect={onSelect} mode="functional" />}
          {view === "data"     && <window.Views.FlowView data={data} selected={selectedId} onSelect={onSelect} mode="data" />}
          {view === "contract" && <window.Views.ContractsView data={data} selected={selectedId} onSelect={onSelect} />}
          {view === "files"    && <window.Views.FilesView data={data} selected={selectedId} onSelect={onSelect} />}

          {selectedId && showPassport && (
            <PassportPanel
              modules={data.modules}
              edges={data.edges}
              contracts={data.contracts}
              flows={data.flows}
              selectedId={selectedId}
              onSelect={onSelect}
              onClose={() => { setShowPassport(false); setSelectedId(null); }}
              onJump={onJump}
            />
          )}
        </div>
      </div>

      <div className="statusbar">
        <span className="item"><span style={{ color: "var(--green)" }}>●</span> indexed</span>
        <span className="item">{data.modules.length} nodes · {data.edges.length} edges</span>
        <span className="item">{data.contracts.filter(c => c.issues.length).length} contracts with mismatches</span>
        <span className="right">
          <span>group: <span style={{ color: "var(--text)" }}>{groupKey}</span></span>
          <span>view: <span style={{ color: "var(--text)" }}>{view}</span></span>
          <span>shortcut: 1–6</span>
        </span>
      </div>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks" defaultPosition={{ x: window.innerWidth - 320, y: 90 }}>
          <window.TweakSection title="Grouping">
            <window.TweakRadio label="Group nodes by" value={t.groupBy}
              onChange={(v) => { setTweak("groupBy", v); setGroupKey(v); }}
              options={[{ label: "Layer", value: "layer" }, { label: "Team", value: "team" }, { label: "Domain", value: "domain" }]} />
          </window.TweakSection>
          <window.TweakSection title="Display">
            <window.TweakToggle label="Show reviewer annotations" value={t.showAnnotations}
              onChange={(v) => setTweak("showAnnotations", v)} />
            <window.TweakSlider label="Density" value={t.density} min={0.7} max={1.4} step={0.05}
              onChange={(v) => setTweak("density", v)} />
          </window.TweakSection>
          <window.TweakSection title="Accent">
            <window.TweakColor label="Accent color" value={t.accent}
              onChange={(v) => setTweak("accent", v)}
              options={["cyan", "violet", "green", "amber"]} />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
