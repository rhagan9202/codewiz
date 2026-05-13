import type { ReactNode } from "react";
import type { Manifest } from "@codewiz/sdk";

interface Props {
  manifest: Manifest;
  moduleCount: number;
  contractCount: number;
  mismatchCount: number;
  reanalyzeButton: ReactNode;
}

export function Titlebar({ manifest, moduleCount, contractCount, mismatchCount, reanalyzeButton }: Props) {
  const branch = manifest.gitBranch ?? "—";
  const repo = manifest.repoRoot.split("/").slice(-1)[0] ?? manifest.repoRoot;
  return (
    <div className="titlebar">
      <div className="brand">
        <div className="brand-mark"></div>
        <span>codeWizualizer</span>
      </div>
      <div className="crumbs">
        <span style={{ color: "var(--text-faint)", fontSize: 10 }}>local ·</span>
        <span className="repo">{repo}</span>
        <span className="sep">/</span>
        <span className="branch">⎇ {branch}</span>
        <span className="sep">·</span>
        <span>{moduleCount} modules · {contractCount} contracts</span>
      </div>
      <div className="right">
        <span className="pill live">analysis fresh</span>
        {mismatchCount > 0 && (
          <span className="pill">{mismatchCount} mismatches</span>
        )}
        {reanalyzeButton}
      </div>
    </div>
  );
}
