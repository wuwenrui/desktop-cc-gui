import { describe, expect, it } from "vitest";

import {
  WORKSPACE_SESSION_SYSTEM_AUTO_FOLDER_ID,
  buildWorkspaceSessionFolderMoveTargets,
  buildWorkspaceSessionFolderProjection,
  buildWorkspaceSessionFolderWorkspaceProjection,
  getCachedWorkspaceSessionFolderWorkspaceProjection,
} from "./workspaceSessionFolders";

describe("buildWorkspaceSessionFolderProjection", () => {
  it("organizes visible sessions without inflating membership count", () => {
    const projection = buildWorkspaceSessionFolderProjection({
      folders: [
        {
          id: "folder-b",
          workspaceId: "ws-1",
          parentId: "folder-a",
          name: "Child",
          createdAt: 2,
          updatedAt: 2,
        },
        {
          id: "folder-a",
          workspaceId: "ws-1",
          parentId: null,
          name: "Parent",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      rows: [
        { thread: { id: "root-session", name: "Root", updatedAt: 3 }, depth: 0 },
        { thread: { id: "folder-session", name: "Nested", updatedAt: 2 }, depth: 0 },
      ],
      folderIdBySessionId: new Map([["folder-session", "folder-b"]]),
    });

    expect(projection.visibleSessionCount).toBe(2);
    expect(projection.rootRows.map((row) => row.thread.id)).toEqual(["root-session"]);
    expect(projection.folders).toHaveLength(1);
    expect(projection.folders[0]?.children[0]?.rows.map((row) => row.thread.id)).toEqual([
      "folder-session",
    ]);
  });

  it("inherits the nearest parent session folder for child rows without explicit folder assignment", () => {
    const projection = buildWorkspaceSessionFolderProjection({
      folders: [
        {
          id: "folder-target",
          workspaceId: "ws-1",
          parentId: null,
          name: "Target",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      rows: [
        {
          thread: { id: "claude:parent", name: "Parent", updatedAt: 3 },
          depth: 0,
          hasChildren: true,
        },
        {
          thread: {
            id: "claude:child",
            name: "Child",
            updatedAt: 2,
            parentThreadId: "claude:parent",
          },
          depth: 1,
        },
      ],
      folderIdBySessionId: new Map([["claude:parent", "folder-target"]]),
    });

    expect(projection.rootRows).toHaveLength(0);
    expect(projection.folders[0]?.rows.map((row) => row.thread.id)).toEqual([
      "claude:parent",
      "claude:child",
    ]);
  });

  it("keeps an explicitly rooted child outside the parent folder", () => {
    const projection = buildWorkspaceSessionFolderProjection({
      folders: [
        {
          id: "folder-target",
          workspaceId: "ws-1",
          parentId: null,
          name: "Target",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      rows: [
        {
          thread: { id: "claude:parent", name: "Parent", updatedAt: 3 },
          depth: 0,
          hasChildren: true,
        },
        {
          thread: {
            id: "claude:child",
            name: "Child",
            updatedAt: 2,
            parentThreadId: "claude:parent",
          },
          depth: 1,
        },
      ],
      folderIdBySessionId: new Map<string, string | null>([
        ["claude:parent", "folder-target"],
        ["claude:child", null],
      ]),
    });

    expect(projection.folders[0]?.rows.map((row) => row.thread.id)).toEqual([
      "claude:parent",
    ]);
    expect(projection.rootRows.map((row) => row.thread.id)).toEqual(["claude:child"]);
  });

  it("applies automatic session visibility before projecting root rows", () => {
    const projection = buildWorkspaceSessionFolderProjection({
      folders: [
        {
          id: WORKSPACE_SESSION_SYSTEM_AUTO_FOLDER_ID,
          workspaceId: "ws-1",
          parentId: null,
          name: "system-auto",
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      rows: [
        {
          thread: {
            id: "claude:hidden",
            name: "Hidden helper",
            updatedAt: 3,
            autoSession: {
              sessionPurpose: "title-generation",
              visibility: "hidden",
              ownerFeature: "threads",
              autoArchive: true,
              createdBy: "system",
            },
          },
          depth: 0,
        },
        {
          thread: {
            id: "claude:system-auto",
            name: "System trace",
            updatedAt: 2,
            autoSession: {
              sessionPurpose: "pull-request-question",
              visibility: "system-auto",
              ownerFeature: "git",
              autoArchive: false,
              createdBy: "system",
            },
          },
          depth: 0,
        },
        {
          thread: { id: "claude:user", name: "User", updatedAt: 1 },
          depth: 0,
        },
      ],
      folderIdBySessionId: new Map(),
    });

    expect(projection.rootRows.map((row) => row.thread.id)).toEqual(["claude:user"]);
    expect(projection.folders[0]?.rows.map((row) => row.thread.id)).toEqual([
      "claude:system-auto",
    ]);
    expect(projection.visibleSessionCount).toBe(2);
  });

  it("builds move targets only from the provided project folders", () => {
    const targets = buildWorkspaceSessionFolderMoveTargets({
      rootLabel: "Project root",
      folders: [
        {
          id: "folder-child",
          workspaceId: "ws-1",
          parentId: "folder-parent",
          name: "Claude fixes",
          createdAt: 2,
          updatedAt: 2,
        },
        {
          id: "folder-parent",
          workspaceId: "ws-1",
          parentId: null,
          name: "Planning",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(targets).toEqual([
      { folderId: null, label: "Project root" },
      { folderId: "folder-parent", label: "Planning" },
      { folderId: "folder-child", label: "Planning / Claude fixes" },
    ]);
  });

  it("degrades corrupted folder parent cycles to root without recursive loops", () => {
    const cyclicFolders = [
      {
        id: "folder-a",
        workspaceId: "ws-1",
        parentId: "folder-b",
        name: "A",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "folder-b",
        workspaceId: "ws-1",
        parentId: "folder-a",
        name: "B",
        createdAt: 2,
        updatedAt: 2,
      },
    ];
    const projection = buildWorkspaceSessionFolderProjection({
      folders: cyclicFolders,
      rows: [{ thread: { id: "thread-a", name: "Thread", updatedAt: 3 }, depth: 0 }],
      folderIdBySessionId: new Map([["thread-a", "folder-a"]]),
    });

    expect(projection.folders.map((node) => node.folder.id)).toEqual(["folder-a", "folder-b"]);
    expect(projection.folders[0]?.rows.map((row) => row.thread.id)).toEqual(["thread-a"]);
    expect(
      buildWorkspaceSessionFolderMoveTargets({
        rootLabel: "Project root",
        folders: cyclicFolders,
      }),
    ).toEqual([
      { folderId: null, label: "Project root" },
      { folderId: "folder-a", label: "A" },
      { folderId: "folder-b", label: "B" },
    ]);
  });

  it("builds workspace-scoped projection from rows, folders, and local overrides", () => {
    const folders = [
      {
        id: "folder-a",
        workspaceId: "ws-1",
        parentId: null,
        name: "Planning",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const projection = buildWorkspaceSessionFolderWorkspaceProjection({
      folders,
      rootLabel: "Project root",
      rows: [
        {
          thread: { id: "thread-root", name: "Root", updatedAt: 3 },
          depth: 0,
        },
        {
          thread: { id: "thread-moved", name: "Moved", updatedAt: 2 },
          depth: 0,
        },
      ],
      folderOverrides: {
        "thread-moved": "folder-a",
      },
    });

    expect(projection.folderProjection.rootRows.map((row) => row.thread.id)).toEqual([
      "thread-root",
    ]);
    expect(projection.folderProjection.folders[0]?.rows.map((row) => row.thread.id)).toEqual([
      "thread-moved",
    ]);
    expect(projection.projectedRows[1]?.thread.folderId).toBe("folder-a");
    expect(projection.folderMoveTargets).toEqual([
      { folderId: null, label: "Project root" },
      { folderId: "folder-a", label: "Planning" },
    ]);
  });

  it("reuses cached projection per workspace until that workspace inputs change", () => {
    const cache = new Map();
    const folders = [
      {
        id: "folder-a",
        workspaceId: "ws-a",
        parentId: null,
        name: "Planning",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const rowsA = [
      { thread: { id: "thread-a", name: "A", updatedAt: 1 }, depth: 0 },
    ];
    const rowsB = [
      { thread: { id: "thread-b", name: "B", updatedAt: 1 }, depth: 0 },
    ];
    const overrides = {};

    const firstA = getCachedWorkspaceSessionFolderWorkspaceProjection(
      cache,
      "ws-a",
      {
        folders,
        rows: rowsA,
        folderOverrides: overrides,
        rootLabel: "Project root",
      },
    );
    const firstB = getCachedWorkspaceSessionFolderWorkspaceProjection(
      cache,
      "ws-b",
      {
        folders,
        rows: rowsB,
        folderOverrides: overrides,
        rootLabel: "Project root",
      },
    );
    const secondB = getCachedWorkspaceSessionFolderWorkspaceProjection(
      cache,
      "ws-b",
      {
        folders,
        rows: rowsB,
        folderOverrides: overrides,
        rootLabel: "Project root",
      },
    );
    const nextA = getCachedWorkspaceSessionFolderWorkspaceProjection(
      cache,
      "ws-a",
      {
        folders,
        rows: [...rowsA],
        folderOverrides: overrides,
        rootLabel: "Project root",
      },
    );

    expect(secondB).toBe(firstB);
    expect(nextA).not.toBe(firstA);
    expect(cache.get("ws-b")?.projection).toBe(firstB);
  });

  it("rebuilds cached projection when mutable input contents change under the same identities", () => {
    const cache = new Map();
    const folders = [
      {
        id: "folder-a",
        workspaceId: "ws-a",
        parentId: null,
        name: "Planning",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const rows = [
      { thread: { id: "thread-a", name: "A", updatedAt: 1 }, depth: 0 },
    ];
    const overrides: Record<string, string | null | undefined> = {};

    const first = getCachedWorkspaceSessionFolderWorkspaceProjection(
      cache,
      "ws-a",
      {
        folders,
        rows,
        folderOverrides: overrides,
        rootLabel: "Project root",
      },
    );

    overrides["thread-a"] = "folder-a";

    const next = getCachedWorkspaceSessionFolderWorkspaceProjection(
      cache,
      "ws-a",
      {
        folders,
        rows,
        folderOverrides: overrides,
        rootLabel: "Project root",
      },
    );

    expect(next).not.toBe(first);
    expect(next.folderProjection.rootRows).toHaveLength(0);
    expect(next.folderProjection.folders[0]?.rows.map((row) => row.thread.id)).toEqual([
      "thread-a",
    ]);
  });
});
