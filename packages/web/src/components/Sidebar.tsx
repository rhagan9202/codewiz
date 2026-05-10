import { useState, useMemo, type ReactNode } from "react";
import type { Module } from "@codewiz/sdk";
import { LayerDot } from "./LayerDot.js";
import { ArchIcon, DepIcon, FlowIcon, DataIcon, ContractIcon, FileIcon } from "../icons.js";

export type ViewId = "arch" | "deps" | "flow" | "data" | "contract" | "files";

interface NavItem {
  id: ViewId;
  label: string;
  k: string;
  icon: ReactNode;
  disabled?: { sinceVersion: string };
}

const NAV: NavItem[] = [
  { id: "arch",     label: "Architecture",    k: "1", icon: <ArchIcon /> },
  { id: "deps",     label: "Dependencies",    k: "2", icon: <DepIcon />,    disabled: { sinceVersion: "v0.2" } },
  { id: "flow",     label: "Functional flow", k: "3", icon: <FlowIcon />,   disabled: { sinceVersion: "v0.4" } },
  { id: "data",     label: "Data flow",       k: "4", icon: <DataIcon />,   disabled: { sinceVersion: "v0.4" } },
  { id: "contract", label: "Contracts",       k: "5", icon: <ContractIcon />, disabled: { sinceVersion: "v0.3" } },
  { id: "files",    label: "Files",           k: "6", icon: <FileIcon /> },
];

interface Props {
  view: ViewId;
  setView: (v: ViewId) => void;
  modules: Module[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

interface TreeNode {
  _files?: Module[];
  [k: string]: TreeNode | Module[] | undefined;
}

export function Sidebar({ view, setView, modules, selectedId, onSelect, query, setQuery }: Props) {
  const tree = useMemo(() => buildTree(modules), [modules]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (k: string) => setCollapsed((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const renderTree = (node: TreeNode, prefix = "", depth = 0): ReactNode[] => {
    const out: ReactNode[] = [];
    Object.keys(node).filter((k) => k !== "_files").sort().forEach((k) => {
      const path = prefix + k;
      const isCol = collapsed.has(path);
      out.push(
        <div key={"d:" + path} className="tree-node" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => toggle(path)}>
          <span className="chev">{isCol ? "▸" : "▾"}</span>
          <span style={{ color: "var(--text-dim)" }}>{k}</span>
        </div>,
      );
      if (!isCol) {
        out.push(...renderTree(node[k] as TreeNode, path + "/", depth + 1));
      }
    });
    (node._files ?? []).forEach((f) => {
      if (query && !f.name.toLowerCase().includes(query.toLowerCase()) && !f.path.toLowerCase().includes(query.toLowerCase())) return;
      out.push(
        <div
          key={"f:" + f.id}
          className={`tree-node ${selectedId === f.id ? "selected" : ""}`}
          style={{ paddingLeft: 8 + (depth + 1) * 12 }}
          onClick={() => onSelect(f.id)}
        >
          <LayerDot layer={f.layer.value} size={6} />
          <span style={{ color: "var(--text)" }}>{f.path.split("/").slice(-1)[0]}</span>
          {f.annotation && (
            <span className={`annotation ${f.annotation}`}>
              {f.annotation === "err" ? "bug" :
               f.annotation === "warn" ? "rev" :
               f.annotation === "new" ? "new" : "dup"}
            </span>
          )}
        </div>,
      );
    });
    return out;
  };

  return (
    <div className="sidebar">
      <div className="nav">
        <div className="nav-label">Views</div>
        {NAV.map((it) => {
          const isDisabled = !!it.disabled;
          const title = isDisabled ? `Ships in ${it.disabled!.sinceVersion}` : "";
          return (
            <div
              key={it.id}
              className={`nav-item ${view === it.id ? "active" : ""}`}
              style={isDisabled ? { opacity: 0.4, cursor: "not-allowed" } : {}}
              title={title}
              aria-disabled={isDisabled || undefined}
              onClick={isDisabled ? undefined : () => setView(it.id)}
            >
              <span className="ico">{it.icon}</span>
              <span>{it.label}</span>
              <span className="kbd">{it.k}</span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <div className="searchbar" style={{ width: "auto" }}>
          <span style={{ color: "var(--text-faint)", marginRight: 6 }}>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter files…" />
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

function buildTree(modules: Module[]): TreeNode {
  const root: TreeNode = {};
  for (const m of modules) {
    if (m.layer.value === "external") continue;
    const parts = m.path.split("/");
    let cur: TreeNode = root;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) {
        cur._files = (cur._files ?? []) as Module[];
        (cur._files as Module[]).push(m);
      } else {
        cur[p] = (cur[p] ?? {}) as TreeNode;
        cur = cur[p] as TreeNode;
      }
    });
  }
  return root;
}
