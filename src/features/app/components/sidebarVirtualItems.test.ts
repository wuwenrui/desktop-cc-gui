import { describe, expect, it } from "vitest";
import {
  SIDEBAR_LIST_VIRTUALIZATION_MIN_ROWS,
  emptyItem,
  flattenSidebarWorkspaceItems,
  loadMoreItem,
  pinnedItemKey,
  resolveSidebarItemKey,
  separatorItem,
  shouldVirtualizeSidebarList,
  threadItemKey,
  worktreeItemKey,
} from "./sidebarVirtualItems";

describe("Sidebar virtual item model", () => {
  it("exposes a 100-row virtualization threshold", () => {
    expect(SIDEBAR_LIST_VIRTUALIZATION_MIN_ROWS).toBe(100);
    expect(shouldVirtualizeSidebarList(99)).toBe(false);
    expect(shouldVirtualizeSidebarList(100)).toBe(true);
  });

  it("derives stable domain keys, never index keys", () => {
    expect(threadItemKey("ws-1", "thread-a")).toBe("thread:ws-1:thread-a");
    expect(pinnedItemKey("ws-1", "thread-a")).toBe("pinned:ws-1:thread-a");
    expect(worktreeItemKey("ws-1", "wt-2")).toBe("worktree:ws-1:wt-2");
  });

  it("falls back to a deterministic key when out of range", () => {
    expect(resolveSidebarItemKey([], 0)).toBe("sidebar-fallback-0");
  });

  it("flattens 200 pinned + unpinned rows with mixed kinds, no index keys", () => {
    const pinnedRows = Array.from({ length: 50 }, (_, i) => ({
      workspaceId: "ws-1",
      thread: { id: `pinned-${i}` } as never,
    }));
    const unpinnedRows = Array.from({ length: 150 }, (_, i) => ({
      workspaceId: "ws-1",
      thread: { id: `thread-${i}` } as never,
    }));
    const items = flattenSidebarWorkspaceItems({
      pinnedRows,
      unpinnedRows,
      folders: [],
      worktrees: [],
      hasMoreThreads: false,
      isEmpty: false,
    });
    // 50 pinned + 1 separator + 150 thread = 201
    expect(items.length).toBe(201);
    expect(items.filter((it) => it.kind === "separator")).toHaveLength(1);
    // Every key is unique.
    const keys = new Set(items.map((it) => it.key));
    expect(keys.size).toBe(items.length);
    // No key is an index.
    for (const item of items) {
      expect(item.key).not.toMatch(/^\d+$/);
    }
  });

  it("emits load-more and empty items as separate kinds", () => {
    const unpinned = [
      { workspaceId: "ws-1", thread: { id: "thread-1" } as never },
    ];
    const items = flattenSidebarWorkspaceItems({
      pinnedRows: [],
      unpinnedRows: unpinned,
      folders: [],
      worktrees: [],
      hasMoreThreads: true,
      isEmpty: true,
    });
    // 1 thread + 1 load-more + 1 empty = 3
    const kinds = items.map((it) => it.kind);
    expect(kinds).toContain("load-more");
    expect(kinds).toContain("empty");
    expect(separatorItem("test").key).toMatch(/^separator:/);
    expect(loadMoreItem("ws-1").kind).toBe("load-more");
    expect(emptyItem("ws-1").kind).toBe("empty");
  });
});
