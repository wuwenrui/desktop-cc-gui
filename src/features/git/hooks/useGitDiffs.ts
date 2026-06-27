import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitFileDiff, GitFileStatus, WorkspaceInfo } from "../../../types";
import { getGitDiffs } from "../../../services/tauri";
import { buildCanonicalGitChanges } from "../utils/gitChangeModel";

type GitDiffState = {
  diffs: GitFileDiff[];
  isLoading: boolean;
  error: string | null;
};

const emptyState: GitDiffState = {
  diffs: [],
  isLoading: false,
  error: null,
};

export function useGitDiffs(
  activeWorkspace: WorkspaceInfo | null,
  files: GitFileStatus[],
  enabled: boolean,
  isGitRepository = true,
) {
  const [state, setState] = useState<GitDiffState>(emptyState);
  const requestIdRef = useRef(0);
  const workspaceIdRef = useRef<string | null>(activeWorkspace?.id ?? null);
  const cachedDiffsRef = useRef<Map<string, GitFileDiff[]>>(new Map());
  const nonGitWorkspaceIdsRef = useRef<Set<string>>(new Set());

  const fileKey = useMemo(
    () =>
      files
        .map(
          (file) =>
            `${file.path}:${file.status}:${file.additions}:${file.deletions}`,
        )
        .sort()
        .join("|"),
    [files],
  );

  const refresh = useCallback(async () => {
    if (!activeWorkspace) {
      setState(emptyState);
      return;
    }
    const workspaceId = activeWorkspace.id;
    if (!isGitRepository || nonGitWorkspaceIdsRef.current.has(workspaceId)) {
      cachedDiffsRef.current.set(workspaceId, []);
      setState(emptyState);
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const diffs = await getGitDiffs(workspaceId);
      if (
        requestIdRef.current !== requestId ||
        workspaceIdRef.current !== workspaceId
      ) {
        return;
      }
      setState({ diffs, isLoading: false, error: null });
      cachedDiffsRef.current.set(workspaceId, diffs);
      nonGitWorkspaceIdsRef.current.delete(workspaceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isNonGitRepository = message
        .toLowerCase()
        .includes("not a git repository");
      if (
        requestIdRef.current !== requestId ||
        workspaceIdRef.current !== workspaceId
      ) {
        return;
      }
      if (isNonGitRepository) {
        nonGitWorkspaceIdsRef.current.add(workspaceId);
        cachedDiffsRef.current.set(workspaceId, []);
        setState(emptyState);
        return;
      }
      console.error("Failed to load git diffs", error);
      setState({
        diffs: [],
        isLoading: false,
        error: message,
      });
    }
  }, [activeWorkspace, isGitRepository]);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id ?? null;
    if (workspaceIdRef.current !== workspaceId) {
      // Clear old workspace cache to free memory (especially base64 image data)
      const prevId = workspaceIdRef.current;
      if (prevId) {
        cachedDiffsRef.current.delete(prevId);
      }
      workspaceIdRef.current = workspaceId;
      requestIdRef.current += 1;
      if (!workspaceId) {
        setState(emptyState);
        return;
      }
      const cached = cachedDiffsRef.current.get(workspaceId);
      setState({
        diffs: cached ?? [],
        isLoading: false,
        error: null,
      });
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (activeWorkspace && !isGitRepository) {
      nonGitWorkspaceIdsRef.current.add(activeWorkspace.id);
      cachedDiffsRef.current.set(activeWorkspace.id, []);
      setState(emptyState);
    }
  }, [activeWorkspace, isGitRepository]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refresh();
  }, [enabled, fileKey, refresh]);

  const isCurrentWorkspaceNonGit =
    !isGitRepository ||
    (activeWorkspace
      ? nonGitWorkspaceIdsRef.current.has(activeWorkspace.id)
      : false);

  const orderedDiffs = useMemo(() => {
    if (isCurrentWorkspaceNonGit) {
      return [];
    }
    return buildCanonicalGitChanges({
      files,
      diffs: state.diffs,
    }).viewerDiffs;
  }, [files, isCurrentWorkspaceNonGit, state.diffs]);

  return {
    diffs: orderedDiffs,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  };
}
