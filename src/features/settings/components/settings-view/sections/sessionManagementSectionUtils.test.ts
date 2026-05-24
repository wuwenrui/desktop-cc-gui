import { describe, expect, it } from "vitest";
import type { WorkspaceSessionCatalogEntry } from "../../../../../services/tauri";
import {
  buildLoadedSessionFolderCountSummary,
  resolveWorkspaceSessionDisplayTitle,
} from "./sessionManagementSectionUtils";

function makeEntry(
  overrides: Partial<WorkspaceSessionCatalogEntry>,
): WorkspaceSessionCatalogEntry {
  return {
    sessionId: "codex:session",
    workspaceId: "ws-1",
    title: "Session",
    updatedAt: 1710000000000,
    engine: "codex",
    archivedAt: null,
    threadKind: "native",
    ...overrides,
  };
}

describe("sessionManagementSectionUtils", () => {
  it("keeps inherited folder counts scoped when workspaces reuse session ids", () => {
    const summary = buildLoadedSessionFolderCountSummary([
      makeEntry({
        sessionId: "codex:parent",
        workspaceId: "ws-1",
        folderId: "folder-a",
      }),
      makeEntry({
        sessionId: "codex:child",
        workspaceId: "ws-1",
        parentSessionId: "codex:parent",
        folderId: null,
      }),
      makeEntry({
        sessionId: "codex:parent",
        workspaceId: "ws-2",
        folderId: null,
      }),
      makeEntry({
        sessionId: "codex:child",
        workspaceId: "ws-2",
        parentSessionId: "codex:parent",
        folderId: null,
      }),
    ]);

    expect(summary.folderCountsById.get("folder-a")).toBe(2);
    expect(summary.unassignedFolderCount).toBe(2);
  });

  it("uses the shared title resolver for settings and curtain labels", () => {
    expect(
      resolveWorkspaceSessionDisplayTitle(
        makeEntry({ title: "  修复 Claude 会话显示  " }),
        "Untitled",
      ),
    ).toBe("修复 Claude 会话显示");
    expect(resolveWorkspaceSessionDisplayTitle(makeEntry({ title: "" }), "Untitled")).toBe(
      "Untitled",
    );
  });
});
