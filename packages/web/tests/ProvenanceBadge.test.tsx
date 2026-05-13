import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvenanceBadge } from "../src/components/ProvenanceBadge.js";

describe("ProvenanceBadge", () => {
  it("renders 'S' for static provenance", () => {
    render(<ProvenanceBadge provenance={{ source: "static" }} />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("renders 'A' and includes file:line in the tooltip for annotation", () => {
    render(
      <ProvenanceBadge
        provenance={{ source: "annotation", file: ".codewiz.yml", line: 12 }}
      />,
    );
    const badge = screen.getByText("A");
    expect(badge).toBeInTheDocument();
    expect(badge.title).toContain(".codewiz.yml:12");
  });

  it("renders 'B' with confidence for bridge provenance", () => {
    render(<ProvenanceBadge provenance={{ source: "bridge", confidence: 0.8 }} />);
    const badge = screen.getByText("B");
    expect(badge.title).toContain("0.8");
  });

  it("renders 'L' with model for llm provenance", () => {
    render(
      <ProvenanceBadge
        provenance={{
          source: "llm", model: "anthropic/claude-sonnet-4-6",
          promptHash: "abc", confidence: 0.7,
          citations: [{ path: "src/x.ts", line: 4 }],
        }}
      />,
    );
    const badge = screen.getByText("L");
    expect(badge.title).toContain("claude-sonnet-4-6");
  });
});
