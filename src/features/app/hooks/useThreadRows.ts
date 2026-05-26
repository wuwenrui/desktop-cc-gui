import { useCallback } from "react";

import { DEFAULT_VISIBLE_THREAD_ROOT_COUNT } from "../constants";
import type { ThreadSummary } from "../../../types";

type ThreadRow = {
  thread: ThreadSummary;
  depth: number;
  hasChildren?: boolean;
};

type ThreadRowResult = {
  pinnedRows: ThreadRow[];
  unpinnedRows: ThreadRow[];
  totalRoots: number;
  hasMoreRoots: boolean;
};

export function useThreadRows(threadParentById: Record<string, string>) {
  const getThreadRows = useCallback(
    (
      threads: ThreadSummary[],
      isExpanded: boolean,
      workspaceId: string,
      getPinTimestamp: (workspaceId: string, threadId: string) => number | null,
      visibleThreadRootCount = DEFAULT_VISIBLE_THREAD_ROOT_COUNT,
    ): ThreadRowResult => {
      const threadIds = new Set(threads.map((thread) => thread.id));
      const childrenByParent = new Map<string, ThreadSummary[]>();
      const roots: ThreadSummary[] = [];

      threads.forEach((thread) => {
        const parentId = thread.parentThreadId ?? threadParentById[thread.id];
        if (parentId && parentId !== thread.id && threadIds.has(parentId)) {
          const list = childrenByParent.get(parentId) ?? [];
          list.push(thread);
          childrenByParent.set(parentId, list);
        } else {
          roots.push(thread);
        }
      });

      const subtreeUpdatedAtCache = new Map<string, number>();
      const getSubtreeUpdatedAt = (thread: ThreadSummary): number => {
        const cached = subtreeUpdatedAtCache.get(thread.id);
        if (cached != null) {
          return cached;
        }
        const children = childrenByParent.get(thread.id) ?? [];
        const updatedAt = children.reduce(
          (maxUpdatedAt, child) =>
            Math.max(maxUpdatedAt, getSubtreeUpdatedAt(child)),
          Number.isFinite(thread.updatedAt) ? thread.updatedAt : 0,
        );
        subtreeUpdatedAtCache.set(thread.id, updatedAt);
        return updatedAt;
      };
      const compareThreadRows = (left: ThreadSummary, right: ThreadSummary) => {
        const leftUpdatedAt = getSubtreeUpdatedAt(left);
        const rightUpdatedAt = getSubtreeUpdatedAt(right);
        if (rightUpdatedAt !== leftUpdatedAt) {
          return rightUpdatedAt - leftUpdatedAt;
        }
        return left.id.localeCompare(right.id);
      };

      childrenByParent.forEach((children) => {
        children.sort(compareThreadRows);
      });
      roots.sort(compareThreadRows);

      const pinnedRoots: ThreadSummary[] = [];
      const unpinnedRoots: ThreadSummary[] = [];

      roots.forEach((thread) => {
        const pinTime = getPinTimestamp(workspaceId, thread.id);
        if (pinTime !== null) {
          pinnedRoots.push(thread);
        } else {
          unpinnedRoots.push(thread);
        }
      });

      pinnedRoots.sort((a, b) => {
        const aTime = getPinTimestamp(workspaceId, a.id) ?? 0;
        const bTime = getPinTimestamp(workspaceId, b.id) ?? 0;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return compareThreadRows(a, b);
      });

      const visibleRootCount = isExpanded
        ? unpinnedRoots.length
        : visibleThreadRootCount;
      const visibleRoots = unpinnedRoots.slice(0, visibleRootCount);

      const appendThread = (
        thread: ThreadSummary,
        depth: number,
        rows: ThreadRow[],
      ) => {
        const children = childrenByParent.get(thread.id) ?? [];
        rows.push({ thread, depth, hasChildren: children.length > 0 });
        children.forEach((child) => appendThread(child, depth + 1, rows));
      };

      const pinnedRows: ThreadRow[] = [];
      pinnedRoots.forEach((thread) => appendThread(thread, 0, pinnedRows));

      const unpinnedRows: ThreadRow[] = [];
      visibleRoots.forEach((thread) => appendThread(thread, 0, unpinnedRows));

      return {
        pinnedRows,
        unpinnedRows,
        totalRoots: unpinnedRoots.length,
        hasMoreRoots: unpinnedRoots.length > visibleRootCount,
      };
    },
    [threadParentById],
  );

  return { getThreadRows };
}
