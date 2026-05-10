// Force-directed graph component (with morph transitions between layouts)
// Uses a tiny custom physics sim — no D3.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const LAYER_ORDER = ["ui", "state", "api", "service", "data", "external"];

// Compute target positions for a given layout mode + grouping key.
// modes: 'force' | 'layered' | 'radial'
function computeTargets(modules, edges, mode, groupKey, width, height) {
  const targets = {};
  const cx = width / 2, cy = height / 2;

  if (mode === "layered") {
    // group by layer (or by groupKey if specified)
    const groups = {};
    const order = groupKey === "layer" ? LAYER_ORDER : null;
    modules.forEach(m => {
      const k = m[groupKey] || "core";
      (groups[k] = groups[k] || []).push(m);
    });
    const keys = order ? order.filter(k => groups[k]) : Object.keys(groups);
    const colW = (width - 80) / Math.max(keys.length, 1);
    keys.forEach((k, i) => {
      const list = groups[k];
      const x = 60 + colW * i + colW / 2;
      list.forEach((m, j) => {
        const y = 80 + (j + 0.5) * ((height - 100) / list.length);
        targets[m.id] = { x, y };
      });
    });
    return targets;
  }

  if (mode === "radial") {
    const groups = {};
    modules.forEach(m => {
      const k = m[groupKey] || "core";
      (groups[k] = groups[k] || []).push(m);
    });
    const keys = Object.keys(groups);
    const R = Math.min(width, height) * 0.38;
    keys.forEach((k, i) => {
      const baseAngle = (i / keys.length) * Math.PI * 2;
      const arcSpan = (Math.PI * 2) / keys.length * 0.85;
      const list = groups[k];
      list.forEach((m, j) => {
        const t = list.length === 1 ? 0 : (j / (list.length - 1) - 0.5);
        const a = baseAngle + t * arcSpan;
        const r = R * (0.55 + 0.45 * Math.random());
        targets[m.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
    });
    return targets;
  }

  // force-directed (precomputed at module load — see runForce below)
  return null;
}

// Run a small force simulation to settle node positions.
function runForce(modules, edges, width, height, iterations = 280) {
  const nodes = modules.map((m, i) => ({
    id: m.id, layer: m.layer,
    x: width / 2 + (Math.random() - 0.5) * 200,
    y: height / 2 + (Math.random() - 0.5) * 160,
    vx: 0, vy: 0,
  }));
  const idx = {};
  nodes.forEach((n, i) => idx[n.id] = i);
  const links = edges.filter(e => idx[e.source] != null && idx[e.target] != null)
    .map(e => ({ s: idx[e.source], t: idx[e.target] }));

  const cx = width / 2, cy = height / 2;
  for (let it = 0; it < iterations; it++) {
    const alpha = 1 - it / iterations;
    // repulsion (O(n^2) — fine for ~40 nodes)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = 0.5; dy = 0.5; }
        const f = 2400 / d2;
        const dxn = dx / Math.sqrt(d2), dyn = dy / Math.sqrt(d2);
        a.vx -= dxn * f; a.vy -= dyn * f;
        b.vx += dxn * f; b.vy += dyn * f;
      }
    }
    // links (springs)
    for (const l of links) {
      const a = nodes[l.s], b = nodes[l.t];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 90;
      const f = (d - target) * 0.04;
      const dxn = dx / d, dyn = dy / d;
      a.vx += dxn * f; a.vy += dyn * f;
      b.vx -= dxn * f; b.vy -= dyn * f;
    }
    // gravity to center
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.012;
      n.vy += (cy - n.y) * 0.012;
      // velocity damping + step
      n.vx *= 0.78;
      n.vy *= 0.78;
      n.x += n.vx * (0.6 + 0.4 * alpha);
      n.y += n.vy * (0.6 + 0.4 * alpha);
      // bounds
      n.x = Math.max(40, Math.min(width - 40, n.x));
      n.y = Math.max(40, Math.min(height - 40, n.y));
    }
  }
  const out = {};
  nodes.forEach(n => out[n.id] = { x: n.x, y: n.y });
  return out;
}

// ───────────────── Graph component ─────────────────
function ForceGraph({ modules, edges, mode, groupKey, edgeFilter, selectedId, onSelect, highlight, width, height }) {
  const layers = window.__DATA__.LAYERS;
  const [positions, setPositions] = useState(null);
  const animRef = useRef(null);
  const [, force] = useState(0);

  // Compute targets when mode/groupKey/dataset changes
  useEffect(() => {
    let targets;
    if (mode === "force") {
      targets = runForce(modules, edges, width, height);
    } else {
      targets = computeTargets(modules, edges, mode, groupKey, width, height);
    }

    // Animate from current positions to targets
    const start = {};
    modules.forEach(m => {
      start[m.id] = positions?.[m.id] || { x: targets[m.id].x + (Math.random() - 0.5) * 30, y: targets[m.id].y + (Math.random() - 0.5) * 30 };
    });

    if (animRef.current) cancelAnimationFrame(animRef.current);
    const t0 = performance.now();
    const dur = positions ? 600 : 280;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cur = {};
      modules.forEach(m => {
        const s = start[m.id], e = targets[m.id];
        cur[m.id] = { x: s.x + (e.x - s.x) * ease, y: s.y + (e.y - s.y) * ease };
      });
      setPositions(cur);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    // eslint-disable-next-line
  }, [mode, groupKey, width, height, modules.length]);

  const neighborIds = useMemo(() => {
    if (!highlight) return null;
    const s = new Set([highlight]);
    edges.forEach(e => {
      if (e.source === highlight) s.add(e.target);
      if (e.target === highlight) s.add(e.source);
    });
    return s;
  }, [highlight, edges]);

  if (!positions) return <div className="empty">solving layout…</div>;

  const visibleEdges = edges.filter(e => !edgeFilter || edgeFilter.has(e.kind));

  const edgeColor = (k) =>
    k === "imports" ? "var(--cyan)" :
    k === "calls"   ? "var(--violet)" :
    k === "http"    ? "var(--amber)" :
    /* data */        "var(--green)";

  const radius = (m) => {
    const base = 14;
    const out = edges.filter(e => e.source === m.id || e.target === m.id).length;
    return base + Math.min(8, out * 0.6);
  };

  return (
    <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arrow" viewBox="0 -4 8 8" refX="6" refY="0" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,-3L6,0L0,3" fill="currentColor" opacity="0.7" />
        </marker>
      </defs>

      {/* edges */}
      <g>
        {visibleEdges.map((e, i) => {
          const a = positions[e.source], b = positions[e.target];
          if (!a || !b) return null;
          const dim = neighborIds && (!neighborIds.has(e.source) || !neighborIds.has(e.target));
          return (
            <line
              key={i}
              className={`graph-edge ${dim ? "dim" : ""}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={edgeColor(e.kind)}
              strokeWidth={e.kind === "http" ? 1.6 : 1}
              strokeDasharray={e.kind === "http" ? "4 3" : ""}
              opacity={dim ? 0.05 : 0.45}
            />
          );
        })}
      </g>

      {/* nodes */}
      <g>
        {modules.map(m => {
          const p = positions[m.id]; if (!p) return null;
          const r = radius(m);
          const layer = layers[m.layer];
          const dim = neighborIds && !neighborIds.has(m.id);
          const isExt = m.layer === "external";
          return (
            <g
              key={m.id}
              className={`graph-node ${selectedId === m.id ? "selected" : ""} ${dim ? "dim" : ""}`}
              transform={`translate(${p.x},${p.y})`}
              onClick={() => onSelect(m.id)}
            >
              {isExt ? (
                <rect x={-r} y={-r * 0.7} width={r * 2} height={r * 1.4} rx="3"
                      fill="var(--bg-elev)" stroke={layer.color} strokeWidth="1.2"
                      strokeDasharray="3 2" />
              ) : (
                <circle r={r} fill="var(--bg-elev)" stroke={layer.color} strokeWidth="1.2" />
              )}
              <circle r={4} fill={layer.color} opacity="0.9" />
              <text y={r + 12} fill="var(--text-dim)" fontSize="10">{m.name}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

window.ForceGraph = ForceGraph;
