import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BranchInfo, DebugEntry, WorkspaceInfo } from "../../../types";
import {
  checkoutGitBranch,
  createGitBranch,
  listGitBranches,
} from "../../../services/tauri";
import { normalizeGitBranchListResponse } from "../utils/gitBranchList";

type UseGitBranchesOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
};

export function useGitBranches({ activeWorkspace, onDebug }: UseGitBranchesOptions) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const lastFailureSignature = useRef<{
    signature: string;
    count: number;
    emittedAt: number;
  } | null>(null);

  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);

  const refreshBranches = useCallback(async () => {
    if (!workspaceId || !isConnected) {
      setBranches([]);
      return;
    }
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    onDebug?.({
      id: `${Date.now()}-client-branches-list`,
      timestamp: Date.now(),
      source: "client",
      label: "git/branches/list",
      payload: { workspaceId },
    });
    try {
      const response = await listGitBranches(workspaceId);
      const normalized = normalizeGitBranchListResponse(response);
      onDebug?.({
        id: `${Date.now()}-server-branches-list`,
        timestamp: Date.now(),
        source: "server",
        label: "git/branches/list response",
        payload: response,
      });
      if (normalized.repositoryState === "not_git_repository") {
        setBranches([]);
        lastFetchedWorkspaceId.current = workspaceId;
        setError(null);
        onDebug?.({
          id: `${Date.now()}-server-branches-not-repository`,
          timestamp: Date.now(),
          source: "server",
          label: "git/branches/not-repository",
          payload: normalized.diagnostic ?? { workspaceId },
        });
        return;
      }
      setBranches(normalized.branches);
      lastFetchedWorkspaceId.current = workspaceId;
      setError(null);
      lastFailureSignature.current = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      const signature = `${workspaceId}:${message}`;
      const now = Date.now();
      const previous = lastFailureSignature.current;
      const nextCount = previous?.signature === signature ? previous.count + 1 : 1;
      const shouldEmit =
        !previous ||
        previous.signature !== signature ||
        now - previous.emittedAt > 60_000 ||
        nextCount === 5;
      lastFailureSignature.current = {
        signature,
        count: nextCount,
        emittedAt: shouldEmit ? now : previous?.emittedAt ?? now,
      };
      if (shouldEmit) {
        onDebug?.({
          id: `${Date.now()}-client-branches-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "git/branches/list error",
          payload: {
            workspaceId,
            message,
            repeatedCount: nextCount,
            dedupeWindowMs: 60_000,
          },
        });
      }
    } finally {
      inFlight.current = false;
    }
  }, [isConnected, onDebug, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (lastFetchedWorkspaceId.current === workspaceId && branches.length > 0) {
      return;
    }
    refreshBranches();
  }, [branches.length, isConnected, refreshBranches, workspaceId]);

  const recentBranches = useMemo(
    () => branches.slice().sort((a, b) => b.lastCommit - a.lastCommit),
    [branches],
  );

  const checkoutBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-client-branch-checkout`,
        timestamp: Date.now(),
        source: "client",
        label: "git/branch/checkout",
        payload: { workspaceId, name },
      });
      await checkoutGitBranch(workspaceId, name);
      void refreshBranches();
    },
    [onDebug, refreshBranches, workspaceId],
  );

  const createBranch = useCallback(
    async (name: string) => {
      if (!workspaceId || !name) {
        return;
      }
      onDebug?.({
        id: `${Date.now()}-client-branch-create`,
        timestamp: Date.now(),
        source: "client",
        label: "git/branch/create",
        payload: { workspaceId, name },
      });
      await createGitBranch(workspaceId, name);
      void refreshBranches();
    },
    [onDebug, refreshBranches, workspaceId],
  );

  return {
    branches: recentBranches,
    error,
    refreshBranches,
    checkoutBranch,
    createBranch,
  };
}
