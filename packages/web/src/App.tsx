import { useState, useEffect } from "react";
import { ProjectProvider, useProject } from "./ProjectContext.js";
import { Titlebar } from "./components/Titlebar.js";
import { Statusbar } from "./components/Statusbar.js";
import { Sidebar, type ViewId } from "./components/Sidebar.js";
import { PassportPanel } from "./components/PassportPanel.js";
import { ReanalyzeBar } from "./components/ReanalyzeBar.js";
import { ArchitectureView } from "./views/ArchitectureView.js";
import { FilesView } from "./views/FilesView.js";
import { DisabledView } from "./views/DisabledView.js";

const TITLE: Record<ViewId, string> = {
  arch: "Architecture overview",
  deps: "Dependencies",
  flow: "Functional flow",
  data: "Data flow",
  contract: "Contracts",
  files: "Files",
};

const SUBTITLE: Record<ViewId, string> = {
  arch: "modules layered by responsibility · click to open passport",
  deps: "ships in v0.2",
  flow: "ships in v0.4",
  data: "ships in v0.4",
  contract: "ships in v0.3",
  files: "with reviewer annotations and source preview",
};

const SHIPS_IN: Partial<Record<ViewId, string>> = {
  deps: "v0.2", contract: "v0.3", flow: "v0.4", data: "v0.4",
};

export function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}

function Shell() {
  const { status, project, error, refetch } = useProject();
  const [view, setView] = useState<ViewId>("arch");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const map: Record<string, ViewId> = {
        "1": "arch", "6": "files",
      };
      const v = map[e.key];
      if (v) setView(v);
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (status === "loading" && !project) {
    return <div style={{ color: "var(--text-dim)", padding: 40, fontFamily: "var(--font-mono)" }}>loading project…</div>;
  }
  if (status === "error") {
    return (
      <div style={{ color: "var(--pink)", padding: 40, fontFamily: "var(--font-mono)" }}>
        failed to load: {error}
      </div>
    );
  }
  if (!project) return null;

  const mismatchCount = project.contracts.filter((c) => c.issues.length > 0).length;

  return (
    <div className="app">
      <Titlebar
        manifest={project.manifest}
        moduleCount={project.modules.length}
        contractCount={project.contracts.length}
        mismatchCount={mismatchCount}
        reanalyzeButton={<ReanalyzeBar onDone={refetch} />}
      />
      <Sidebar
        view={view} setView={setView}
        modules={project.modules}
        selectedId={selected}
        onSelect={(id) => setSelected(id)}
        query={query} setQuery={setQuery}
      />
      <div className="main">
        <div className="main-toolbar">
          <div>
            <div className="title">{TITLE[view]}</div>
            <div className="subtitle">{SUBTITLE[view]}</div>
          </div>
        </div>
        <div className="canvas-wrap">
          {view === "arch" && (
            <ArchitectureView project={project} selected={selected} onSelect={setSelected} />
          )}
          {view === "files" && (
            <FilesView project={project} selected={selected} onSelect={setSelected} />
          )}
          {SHIPS_IN[view] && (
            <DisabledView view={TITLE[view]} sinceVersion={SHIPS_IN[view]!} />
          )}
          {selected && (
            <PassportPanel
              modules={project.modules}
              edges={project.edges}
              contracts={project.contracts}
              flows={project.flows}
              selectedId={selected}
              onSelect={setSelected}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
      <Statusbar project={project} view={view} groupKey="layer" />
    </div>
  );
}
