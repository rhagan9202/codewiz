import type { Project } from "@codewiz/sdk";

interface Props {
  project: Project;
  view: string;
  groupKey: string;
}

export function Statusbar({ project, view, groupKey }: Props) {
  const mismatchCount = project.contracts.filter((c) => c.issues.length > 0).length;
  return (
    <div className="statusbar">
      <span className="item"><span style={{ color: "var(--green)" }}>●</span> indexed</span>
      <span className="item">{project.modules.length} nodes · {project.edges.length} edges</span>
      <span className="item">{mismatchCount} contracts with mismatches</span>
      <span className="right">
        <span>group: <span style={{ color: "var(--text)" }}>{groupKey}</span></span>
        <span>view: <span style={{ color: "var(--text)" }}>{view}</span></span>
        <span>shortcut: 1–6</span>
      </span>
    </div>
  );
}
