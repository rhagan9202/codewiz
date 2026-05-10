// Repo picker + analysis overlay
const { useState: useSP, useEffect: useEP, useRef: useRP } = React;

const RECENT = [
  { id: "acme/web-shop",      branch: "main",       ago: "2m ago",  url: "github.com/acme/web-shop" },
  { id: "~/code/web-shop",    branch: "feature/checkout-v2", ago: "yesterday", url: "/Users/me/code/web-shop" },
  { id: "platform/api",       branch: "main",       ago: "3d ago", url: "github.com/platform/api" },
];

const ANALYZE_STEPS = [
  { id: "clone",   label: "Cloning repository",            ms: 600 },
  { id: "scan",    label: "Walking file tree",             ms: 500 },
  { id: "parse",   label: "Parsing TypeScript / JS",       ms: 700 },
  { id: "deps",    label: "Resolving import graph",        ms: 600 },
  { id: "calls",   label: "Tracing call paths",            ms: 700 },
  { id: "types",   label: "Indexing interfaces & schemas", ms: 600 },
  { id: "diff",    label: "Diffing producers ↔ consumers", ms: 700 },
  { id: "score",   label: "Scoring module health",         ms: 400 },
];

const SAMPLE_LOGS = [
  { t: "✓", v: "matched 34 modules across 6 layers", cls: "ok" },
  { t: "✓", v: "resolved 73 import edges, 41 call edges", cls: "ok" },
  { t: "⚠", v: "duplicate reducer logic detected (cartStore vs useCart)", cls: "warn" },
  { t: "✓", v: "indexed 7 contracts (interfaces / Zod schemas)", cls: "ok" },
  { t: "⚠", v: "5 caller-vs-response shape mismatches", cls: "warn" },
  { t: "✓", v: "3 functional flows traced from entry points", cls: "ok" },
  { t: "✓", v: "ready to render", cls: "ok" },
];

function RepoPicker({ onPick }) {
  const [tab, setTab] = useSP("github");
  const [url, setUrl] = useSP("");
  const [path, setPath] = useSP("");
  const inputRef = useRP(null);
  useEP(() => { inputRef.current?.focus(); }, [tab]);

  const value = tab === "github" ? url : path;
  const valid =
    tab === "github" ? /github\.com\/[^/]+\/[^/]+/.test(url) || url.startsWith("git@") :
    tab === "local"  ? path.length > 1 :
    true;

  const submit = () => {
    if (tab === "demo") { onPick({ kind: "demo", label: "acme/web-shop", branch: "main" }); return; }
    if (!valid) return;
    if (tab === "github") {
      const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/) || [];
      const label = m[1] && m[2] ? `${m[1]}/${m[2]}` : url;
      onPick({ kind: "github", label, branch: "main", url });
    } else {
      const label = path.split("/").slice(-2).join("/");
      onPick({ kind: "local", label, branch: "main", url: path });
    }
  };

  return (
    <div className="picker-shell">
      <div className="picker-card">
        <div className="picker-head">
          <div className="brand">
            <div className="brand-mark"></div>
            <span>codeWizualizer</span>
          </div>
          <h1>Pick a repo to analyze</h1>
          <p>Map architecture, dependencies, data flow, and contracts. Source can be a GitHub repo or a local clone.</p>
        </div>

        <div className="picker-tabs">
          <button className={tab === "github" ? "active" : ""} onClick={() => setTab("github")}>GitHub</button>
          <button className={tab === "local"  ? "active" : ""} onClick={() => setTab("local")}>Local path</button>
          <button className={tab === "demo"   ? "active" : ""} onClick={() => setTab("demo")}>Demo project</button>
        </div>

        <div className="picker-body">
          {tab === "github" && (
            <>
              <input ref={inputRef} className="picker-input"
                     placeholder="https://github.com/owner/repo  ·  or  git@github.com:owner/repo.git"
                     value={url}
                     onChange={(e) => setUrl(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && submit()} />
              <div className="picker-hint">
                Read access only · default branch will be used unless you append <span style={{color:"var(--cyan)"}}>/tree/&lt;branch&gt;</span>.
              </div>
            </>
          )}
          {tab === "local" && (
            <>
              <input ref={inputRef} className="picker-input"
                     placeholder="/Users/you/code/my-project"
                     value={path}
                     onChange={(e) => setPath(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && submit()} />
              <div className="picker-hint">
                Folder must contain a <span style={{color:"var(--cyan)"}}>.git</span> directory · current branch will be used.
              </div>
            </>
          )}
          {tab === "demo" && (
            <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
              Walk through a fictional <strong style={{color:"var(--text)"}}>React frontend + Node API</strong> codebase pre-loaded with annotations,
              flagged contract mismatches, and three traced user flows. Best for first-time tour.
            </div>
          )}

          <div className="picker-action">
            <button onClick={submit} disabled={!valid}>
              {tab === "demo" ? "Open demo →" : "Analyze →"}
            </button>
            {tab !== "demo" && (
              <button className="secondary" onClick={() => setTab("demo")}>Skip · use demo</button>
            )}
          </div>

          {tab !== "demo" && (
            <div className="picker-recent">
              <h4>Recent</h4>
              {RECENT.map(r => (
                <div key={r.id} className="recent-row" onClick={() => onPick({
                  kind: r.url.startsWith("github") ? "github" : "local",
                  label: r.id, branch: r.branch, url: r.url,
                })}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-faint)" strokeWidth="1.4">
                    <circle cx="8" cy="8" r="6.5" /><path d="M2 8 H 14" /><path d="M8 1.5 Q 12 8 8 14.5 Q 4 8 8 1.5" />
                  </svg>
                  <span className="name">{r.id}</span>
                  <span className="branch">⎇ {r.branch}</span>
                  <span className="ago">{r.ago}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyzeOverlay({ repo, onDone }) {
  const [stepIdx, setStepIdx] = useSP(0);
  const [logs, setLogs] = useSP([]);

  useEP(() => {
    let cancelled = false;
    let i = 0;
    let logI = 0;
    const advance = () => {
      if (cancelled) return;
      if (i >= ANALYZE_STEPS.length) {
        // Drain remaining logs then finish
        const drain = () => {
          if (cancelled) return;
          if (logI < SAMPLE_LOGS.length) {
            setLogs(L => [...L, SAMPLE_LOGS[logI++]]);
            setTimeout(drain, 120);
          } else {
            setTimeout(onDone, 350);
          }
        };
        drain();
        return;
      }
      const step = ANALYZE_STEPS[i];
      setStepIdx(i);
      setTimeout(() => {
        if (cancelled) return;
        // emit a log per step occasionally
        if (logI < SAMPLE_LOGS.length && i % 1 === 0) {
          setLogs(L => [...L, SAMPLE_LOGS[logI++]]);
        }
        i++;
        advance();
      }, step.ms);
    };
    advance();
    return () => { cancelled = true; };
  }, []);

  const pct = Math.min(100, Math.round((stepIdx / ANALYZE_STEPS.length) * 100));

  return (
    <div className="analyze-overlay">
      <div className="analyze-card">
        <div className="target">
          <span className="icon">⎇</span>
          <span>{repo.kind === "github" ? "github.com/" : repo.kind === "local" ? "" : ""}{repo.label}</span>
          <span style={{ color: "var(--green)", marginLeft: 8 }}>· {repo.branch}</span>
        </div>
        {ANALYZE_STEPS.map((s, i) => {
          const cls = i < stepIdx ? "done" : i === stepIdx ? "active" : "";
          return (
            <div key={s.id} className={`analyze-step ${cls}`}>
              <span className="mark">{i < stepIdx ? "✓" : ""}</span>
              <span>{s.label}</span>
            </div>
          );
        })}
        <div className="analyze-bar"><div className="fill" style={{ width: pct + "%" }} /></div>
        <div className="analyze-log">
          {logs.map((l, i) => (
            <div key={i} className={`line ${l.cls}`}><span className="t">{l.t}</span><span className="v">{l.v}</span></div>
          ))}
          {logs.length === 0 && <div className="line"><span className="t">›</span><span className="v" style={{color:"var(--text-faint)"}}>warming up…</span></div>}
        </div>
      </div>
    </div>
  );
}

window.RepoPicker = RepoPicker;
window.AnalyzeOverlay = AnalyzeOverlay;
