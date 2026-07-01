import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fileTreeCss = readFileSync(
  fileURLToPath(new URL("./file-tree.css", import.meta.url)),
  "utf8",
);
const diffCss = readFileSync(
  fileURLToPath(new URL("./diff.css", import.meta.url)),
  "utf8",
);
const gitHistoryShellCss = readFileSync(
  fileURLToPath(new URL("./git-history.part1-shell.css", import.meta.url)),
  "utf8",
);
const detachedFileExplorerCss = readFileSync(
  fileURLToPath(new URL("./detached-file-explorer.css", import.meta.url)),
  "utf8",
);
const sidebarShellCss = readFileSync(
  fileURLToPath(new URL("./sidebar-shell.css", import.meta.url)),
  "utf8",
);
const sidebarCss = readFileSync(
  fileURLToPath(new URL("./sidebar.css", import.meta.url)),
  "utf8",
);
const messagesShellCss = readFileSync(
  fileURLToPath(new URL("./messages.part1-shell.css", import.meta.url)),
  "utf8",
);
const messagesCss = readFileSync(
  fileURLToPath(new URL("./messages.part2.css", import.meta.url)),
  "utf8",
);
const sessionActivityCss = readFileSync(
  fileURLToPath(new URL("./session-activity.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("client typography font-size coverage", () => {
  it("routes file tree readable text through client typography tokens", () => {
    const fileTreePanelRule = getCssRuleBlock(fileTreeCss, ".file-tree-panel");

    expect(fileTreePanelRule).toContain(
      "--file-tree-content-font-size: var(--client-content-font-size, 12px);",
    );
    expect(getCssRuleBlock(fileTreeCss, ".file-tree-row")).toContain(
      "font-size: var(--file-tree-content-font-size);",
    );
    expect(getCssRuleBlock(fileTreeCss, ".file-tree-count")).toContain(
      "font-size: var(--file-tree-meta-font-size);",
    );
    expect(getCssRuleBlock(fileTreeCss, ".file-tree-lazy-state")).toContain(
      "font-size: var(--file-tree-caption-font-size);",
    );
  });

  it("keeps the file tree scroll shell independent from lazy Git diff styles", () => {
    const fileTreePanelRule = getCssRuleBlock(fileTreeCss, ".file-tree-panel");
    const fileTreeDiffPanelRule = getCssRuleBlock(fileTreeCss, ".diff-panel.file-tree-panel");

    expect(fileTreePanelRule).toContain("display: flex;");
    expect(fileTreePanelRule).toContain("flex: 1;");
    expect(fileTreePanelRule).toContain("flex-direction: column;");
    expect(fileTreePanelRule).toContain("min-height: 0;");
    expect(fileTreePanelRule).toContain("overflow: hidden;");
    expect(fileTreePanelRule).toContain("padding: 8px 8px 0;");
    expect(fileTreePanelRule).toContain("position: relative;");
    expect(fileTreeDiffPanelRule).toContain("gap: 0;");
    expect(fileTreeDiffPanelRule).toContain("padding: 8px 8px 0;");
  });

  it("routes Git file tree typography through shared client tokens", () => {
    const gitFiletreeVars = getCssRuleBlock(diffCss, ".diff-panel,\n.git-history-workbench");

    expect(gitFiletreeVars).toContain("--client-content-font-size");
    expect(gitFiletreeVars).toContain("--client-meta-font-size");
    expect(gitHistoryShellCss).toContain(
      "--git-filetree-badge-font-size: var(--client-caption-font-size, 10px);",
    );
  });

  it("routes detached explorer chrome through client typography tokens", () => {
    expect(getCssRuleBlock(detachedFileExplorerCss, ".detached-file-explorer-menubar-label")).toContain(
      "font-size: var(--client-caption-font-size, 10px);",
    );
    expect(getCssRuleBlock(detachedFileExplorerCss, ".detached-file-explorer-empty-body")).toContain(
      "font-size: var(--client-content-font-size, 13px);",
    );
  });

  it("routes sidebar readable text through client typography tokens", () => {
    expect(getCssRuleBlock(sidebarShellCss, ".sidebar")).toContain(
      "--sidebar-content-font-size: var(--client-content-font-size, 14px);",
    );
    expect(getCssRuleBlock(sidebarCss, ".sidebar-primary-nav-item")).toContain(
      "font-size: var(--sidebar-content-font-size);",
    );
    expect(getCssRuleBlock(sidebarCss, ".thread-row")).toContain(
      "font-size: var(--sidebar-content-font-size);",
    );
    expect(getCssRuleBlock(sidebarCss, ".thread-time")).toContain(
      "font-size: var(--sidebar-meta-font-size);",
    );
  });

  it("routes message canvas readable text through client typography tokens", () => {
    expect(getCssRuleBlock(messagesShellCss, ".messages-shell")).toContain(
      "--message-content-font-size: var(--client-content-font-size, 13px);",
    );
    expect(getCssRuleBlock(messagesCss, ".markdown")).toContain(
      "font-size: var(--message-content-font-size);",
    );
    expect(getCssRuleBlock(messagesCss, ".markdown")).toContain(
      'font-family: "Geist", var(--font-sans);',
    );
    expect(getCssRuleBlock(messagesCss, ".thinking-content")).toContain(
      "font-size: var(--message-caption-font-size);",
    );
  });

  it("routes session activity readable text through client typography tokens", () => {
    expect(getCssRuleBlock(sessionActivityCss, ".session-activity-panel")).toContain(
      "--session-activity-content-font-size: var(--client-content-font-size, 12px);",
    );
    expect(getCssRuleBlock(sessionActivityCss, ".session-activity-tab")).toContain(
      "font-size: var(--session-activity-content-font-size);",
    );
    expect(getCssRuleBlock(sessionActivityCss, ".session-activity-radar-row-preview")).toContain(
      "font-size: var(--session-activity-meta-font-size);",
    );
    expect(getCssRuleBlock(sessionActivityCss, ".session-activity-preview-markdown")).toContain(
      "font-size: var(--session-activity-meta-font-size);",
    );
  });
});
