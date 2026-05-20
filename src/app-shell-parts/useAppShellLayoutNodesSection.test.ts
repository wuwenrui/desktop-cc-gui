import { describe, expect, it } from "vitest";
import {
  getThreadSelectDiffCleanupAction,
  shouldCollapseRightPanelOnThreadSelect,
  shouldPreserveEditorOnThreadSelect,
} from "./threadEditorPreservation";

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
