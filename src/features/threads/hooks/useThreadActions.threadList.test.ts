import { describe, expect, it } from "vitest";

import { buildWorkspaceSessionSelectionKey } from "../../settings/components/settings-view/hooks/useWorkspaceSessionCatalog";
import {
  normalizeProjectCatalogSession,
  resolveThreadListCursorForDisplay,
} from "./useThreadActions.threadList";

describe("useThreadActions.threadList", () => {
  it("preserves additive catalog source fields during normalization", () => {
    expect(
      normalizeProjectCatalogSession({
        sessionId: "claude:session-1",
        stableSessionKey: "claude:child-ws:session-1",
        canonicalSessionId: "session-1",
        workspaceId: "child-ws",
        matchedWorkspaceId: "child-ws",
        engine: "claude",
        title: "Child workspace session",
        updatedAt: 1_730_500_000_000,
        sourceCompleteness: "complete",
        sourceStatusReason: null,
        folderId: "folder-1",
      }),
    ).toMatchObject({
      sessionId: "claude:session-1",
      stableSessionKey: "claude:child-ws:session-1",
      workspaceId: "child-ws",
      matchedWorkspaceId: "child-ws",
      engine: "claude",
      sourceCompleteness: "complete",
      sourceStatusReason: null,
      folderId: "folder-1",
    });
  });

  it("keeps sidebar and Session Management keys aligned for aggregate child rows", () => {
    const catalogEntry = {
      sessionId: "claude:session-1",
      stableSessionKey: "claude:child-ws:session-1",
      canonicalSessionId: "session-1",
      workspaceId: "child-ws",
      matchedWorkspaceId: "child-ws",
      engine: "claude",
      title: "Child workspace session",
      updatedAt: 1_730_500_000_000,
      sourceCompleteness: "complete",
      sourceStatusReason: null,
      folderId: "folder-1",
    };

    const sidebarSession = normalizeProjectCatalogSession(catalogEntry);

    expect(sidebarSession).toMatchObject({
      sessionId: "claude:session-1",
      stableSessionKey: "claude:child-ws:session-1",
      workspaceId: "child-ws",
    });
    expect(buildWorkspaceSessionSelectionKey(catalogEntry)).toBe(
      "child-ws::claude:child-ws:session-1",
    );
  });

  it("normalizes optional catalog strings and rejects invalid source completeness", () => {
    expect(
      normalizeProjectCatalogSession({
        sessionId: " claude:session-2 ",
        stableSessionKey: " claude:child-ws:session-2 ",
        workspaceId: " child-ws ",
        matchedWorkspaceId: "",
        engine: " claude ",
        title: " Session with whitespace ",
        updatedAt: Number.POSITIVE_INFINITY,
        sourceCompleteness: "definitely_empty",
        sourceStatusReason: " ",
        folderId: " folder-1 ",
      }),
    ).toMatchObject({
      sessionId: "claude:session-2",
      stableSessionKey: "claude:child-ws:session-2",
      workspaceId: "child-ws",
      matchedWorkspaceId: null,
      engine: "claude",
      updatedAt: 0,
      sourceCompleteness: null,
      sourceStatusReason: null,
      folderId: "folder-1",
    });
  });

  it("does not expose load-older cursor for catalog partial source without next cursor", () => {
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: null,
        catalogPartialSource: "claude-scan-cap-reached",
        runtimeCursor: null,
      }),
    ).toBeNull();
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: "offset:200",
        catalogPartialSource: "claude-scan-cap-reached",
        runtimeCursor: null,
      }),
    ).toBe("catalog::offset:200");
  });
});
