import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getThreadSelectDiffCleanupAction,
  shouldCollapseRightPanelOnThreadSelect,
  shouldPreserveEditorOnThreadSelect,
} from "./threadEditorPreservation";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("shouldPreserveEditorOnThreadSelect", () => {
  it("preserves desktop editor when selecting another thread in the same workspace", () => {
    expect(
      shouldPreserveEditorOnThreadSelect({
        isCompact: false,
        centerMode: "editor",
        activeWorkspaceId: "workspace-1",
        targetWorkspaceId: "workspace-1",
        activeEditorFilePath: "src/App.tsx",
      }),
    ).toBe(true);
  });

  it("falls back to chat outside the same desktop editor workspace", () => {
    const base = {
      isCompact: false,
      centerMode: "editor" as const,
      activeWorkspaceId: "workspace-1",
      targetWorkspaceId: "workspace-1",
      activeEditorFilePath: "src/App.tsx",
    };

    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        targetWorkspaceId: "workspace-2",
      }),
    ).toBe(false);
    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        centerMode: "chat",
      }),
    ).toBe(false);
    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        activeEditorFilePath: null,
      }),
    ).toBe(false);
    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        isCompact: true,
      }),
    ).toBe(false);
  });
});

describe("getThreadSelectDiffCleanupAction", () => {
  it("does not exit diff view when thread selection preserves the editor split", () => {
    expect(getThreadSelectDiffCleanupAction(true)).toBe("clear-selected-diff");
  });

  it("keeps the existing full diff exit behavior when editor split is not preserved", () => {
    expect(getThreadSelectDiffCleanupAction(false)).toBe("exit-diff-view");
  });
});

describe("shouldCollapseRightPanelOnThreadSelect", () => {
  it("keeps right-side surfaces stable while preserving the editor", () => {
    expect(
      shouldCollapseRightPanelOnThreadSelect({
        preserveEditor: true,
        requestedCollapse: true,
      }),
    ).toBe(false);
  });

  it("honors requested collapse when editor preservation is not active", () => {
    expect(
      shouldCollapseRightPanelOnThreadSelect({
        preserveEditor: false,
        requestedCollapse: true,
      }),
    ).toBe(true);
  });
});

describe("useAppShellLayoutNodesSection adapter contract", () => {
  it("forwards Project Map toggle state into useLayoutNodes despite ts-nocheck", () => {
    const source = readFileSync(
      join(currentDir, "useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    const layoutNodesOptions = source.slice(
      source.indexOf("} = useLayoutNodes({"),
      source.indexOf("  const runSelectedPath", source.indexOf("} = useLayoutNodes({")),
    );

    expect(layoutNodesOptions).toContain("centerMode,");
    expect(layoutNodesOptions).toContain("setCenterMode,");
    expect(layoutNodesOptions).toContain("editorSplitCompanion,");
    expect(layoutNodesOptions).toContain("setEditorSplitCompanion,");
  });

  it("collapses the left conversation sidebar before opening Project Map", () => {
    const source = readFileSync(
      join(currentDir, "useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    const projectMapHandler = source.slice(
      source.indexOf("onOpenProjectMap: () => {"),
      source.indexOf("gitDiffViewStyle,", source.indexOf("onOpenProjectMap: () => {")),
    );

    expect(projectMapHandler).toContain("closeSettings();");
    expect(projectMapHandler).toContain("collapseSidebar();");
    expect(projectMapHandler.indexOf("collapseSidebar();")).toBeLessThan(
      projectMapHandler.indexOf('setCenterMode("projectMap");'),
    );
  });

  it("routes message-tail fork through the shared composer fork action", () => {
    const source = readFileSync(
      join(currentDir, "useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    const forkHandler = source.slice(
      source.indexOf("onForkFromMessage: async () => {"),
      source.indexOf("canStop: canInterrupt,", source.indexOf("onForkFromMessage: async () => {")),
    );

    expect(forkHandler).toContain('await startFork("/fork");');
    expect(forkHandler).not.toContain("forkSessionFromMessageForWorkspace");
    expect(forkHandler).not.toContain("forkClaudeSessionFromMessageForWorkspace");
  });
});
