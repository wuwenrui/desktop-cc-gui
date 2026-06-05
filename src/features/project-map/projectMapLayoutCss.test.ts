import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectMapCss = readFileSync(
  new URL("../../styles/project-map.css", import.meta.url),
  "utf8",
);

function readRuleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = projectMapCss.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));
  return match?.[1] ?? "";
}

describe("project map layout css", () => {
  it("keeps the graph canvas in the flexible stage row when the task banner is absent", () => {
    expect(readRuleBody(".project-map-task-banner")).toBe("");
    expect(readRuleBody(".project-map-lens-shell")).toContain("grid-row: 1");
    expect(readRuleBody(".project-map-graph-canvas")).toContain("grid-row: 2");
    expect(readRuleBody(".project-map-empty-state")).toContain("grid-row: 2");
  });

  it("keeps project map surfaces wired to theme tokens instead of hardcoded light colors", () => {
    const cssWithoutTokenFallbacks = projectMapCss.replace(
      /\.project-map-panel\s*\{[\s\S]*?\n\}/,
      "",
    );

    expect(cssWithoutTokenFallbacks).not.toMatch(/background:\s*#(?:fff|ffffff|f8fafc|f6f8fb|f1f5f9)\b/i);
    expect(cssWithoutTokenFallbacks).not.toMatch(/color:\s*#(?:172033|0f172a|334155|475569|64748b)\b/i);
    expect(readRuleBody(".project-map-panel")).toContain("--project-map-bg: var(--surface-messages");
    expect(readRuleBody(".project-map-graph-canvas")).toContain("var(--project-map-grid-line)");
  });
});
