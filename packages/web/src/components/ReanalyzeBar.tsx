import { useState, useRef, useEffect } from "react";
import { postReanalyze, openEvents, type ServerEvent } from "../api.js";

interface Props {
  onDone: () => void;
}

export function ReanalyzeBar({ onDone }: Props) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { closeRef.current?.(); }, []);

  const start = async () => {
    if (running) return;
    setRunning(true);
    setLogs([`▸ analyzing…`]);
    setDrawerOpen(true);
    closeRef.current?.();
    closeRef.current = openEvents((e: ServerEvent) => {
      if (e.type === "log") {
        setLogs((L) => [...L, `${e.payload.level === "warn" ? "⚠" : "·"} ${e.payload.message}`]);
      } else if (e.type === "done") {
        setLogs((L) => [...L, `✓ done · ${e.payload.contentHash.slice(0, 12)}…`]);
        setRunning(false);
        closeRef.current?.();
        closeRef.current = null;
        void onDone();
      } else if (e.type === "error") {
        setLogs((L) => [...L, `✗ error · ${e.payload.message}`]);
        setRunning(false);
        closeRef.current?.();
        closeRef.current = null;
      }
    });
    try {
      await postReanalyze();
    } catch (err) {
      setLogs((L) => [...L, `✗ request failed · ${(err as Error).message}`]);
      setRunning(false);
      closeRef.current?.();
      closeRef.current = null;
    }
  };

  return (
    <>
      <button className="switch-repo" onClick={start} disabled={running}>
        {running ? "analyzing…" : "↻ re-analyze"}
      </button>
      {drawerOpen && (
        <div style={{
          position: "fixed", bottom: 32, right: 16, width: 360, maxHeight: 240,
          background: "var(--bg-elev)", border: "1px solid var(--border-strong)",
          borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-dim)", padding: "10px 14px", overflowY: "auto",
          zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "var(--text)", fontSize: 10, letterSpacing: "0.08em" }}>RE-ANALYZE</span>
            <button onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: 0, color: "var(--text-faint)", cursor: "pointer" }}>×</button>
          </div>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </>
  );
}
