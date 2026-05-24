// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useThreadActionsSessionCatalog } from "./useThreadActionsSessionCatalog";

describe("useThreadActionsSessionCatalog", () => {
  it("loads every active project catalog page before returning sidebar sessions", async () => {
    const listWorkspaceSessionsService = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            sessionId: "claude:first",
            workspaceId: "ws-1",
            engine: "claude",
            title: "First page",
            updatedAt: 30,
            threadKind: "native",
          },
        ],
        nextCursor: "offset:200",
        sourceStatuses: [{ engine: "claude", completeness: "complete" }],
        partialSource: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            sessionId: "claude:second",
            workspaceId: "ws-1",
            engine: "claude",
            title: "Second page",
            updatedAt: 20,
            threadKind: "native",
          },
        ],
        nextCursor: null,
        sourceStatuses: [{ engine: "claude", completeness: "complete" }],
        partialSource: null,
      });

    const { result } = renderHook(() =>
      useThreadActionsSessionCatalog({
        canListWorkspaceSessions: true,
        listWorkspaceSessionsService,
        listWorkspaceSessionArchiveEvidenceService: null,
      }),
    );

    const catalog = await result.current.loadActiveProjectCatalogSessions("ws-1");

    expect(listWorkspaceSessionsService).toHaveBeenNthCalledWith(1, "ws-1", {
      query: { status: "active" },
      cursor: null,
      limit: 200,
    });
    expect(listWorkspaceSessionsService).toHaveBeenNthCalledWith(2, "ws-1", {
      query: { status: "active" },
      cursor: "offset:200",
      limit: 200,
    });
    expect(catalog?.sessions.map((session) => session.sessionId)).toEqual([
      "claude:first",
      "claude:second",
    ]);
    expect(catalog?.nextCursor).toBeNull();
    expect(catalog?.partialSource).toBeNull();
  });

  it("marks full catalog degraded instead of returning a remaining cursor when page cap is hit", async () => {
    const listWorkspaceSessionsService = vi.fn(async (_workspaceId, options) => ({
      data: [
        {
          sessionId: `claude:${options?.cursor ?? "root"}`,
          workspaceId: "ws-1",
          engine: "claude",
          title: "Page item",
          updatedAt: 1,
          threadKind: "native",
        },
      ],
      nextCursor: `cursor-${listWorkspaceSessionsService.mock.calls.length}`,
      partialSource: null,
    }));

    const { result } = renderHook(() =>
      useThreadActionsSessionCatalog({
        canListWorkspaceSessions: true,
        listWorkspaceSessionsService,
        listWorkspaceSessionArchiveEvidenceService: null,
      }),
    );

    const catalog = await result.current.loadActiveProjectCatalogSessions("ws-1");

    expect(listWorkspaceSessionsService).toHaveBeenCalledTimes(50);
    expect(catalog?.nextCursor).toBeNull();
    expect(catalog?.partialSource).toBe("session-catalog-page-cap");
  });

  it("treats archive evidence with missing source status as incomplete", async () => {
    const listWorkspaceSessionArchiveEvidenceService = vi.fn().mockResolvedValue({
      archivedAtBySessionId: {},
      partialSource: null,
    });

    const { result } = renderHook(() =>
      useThreadActionsSessionCatalog({
        canListWorkspaceSessions: true,
        listWorkspaceSessionsService: null,
        listWorkspaceSessionArchiveEvidenceService,
      }),
    );

    const evidence = await result.current.loadArchivedSessionMap("ws-1");

    expect(listWorkspaceSessionArchiveEvidenceService).toHaveBeenCalledWith("ws-1");
    expect(evidence?.archivedAtBySessionId.size).toBe(0);
    expect(evidence?.partialSource).toBeNull();
    expect(evidence?.sourceStatuses).toEqual([]);
    expect(evidence?.isComplete).toBe(false);
  });
});
