import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { confirm } from "@tauri-apps/plugin-dialog";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import TreePine from "lucide-react/dist/esm/icons/tree-pine";
import type { PanelTabId } from "../../layout/components/PanelTabs";
import {
  createWorkspaceDirectory,
  duplicateWorkspaceItem,
  getWorkspaceDirectoryChildren,
  pasteWorkspaceItem,
  readWorkspaceFile,
  renameWorkspaceItem,
  trashWorkspaceItem,
  writeWorkspaceFile,
  type WorkspaceDirectoryEntry,
} from "../../../services/tauri";
import type { GitFileStatus, OpenAppTarget } from "../../../types";
import { languageFromPath } from "../../../utils/syntax";
import {
  resolveGitRootWorkspacePrefix,
  resolveGitStatusPathCandidates,
} from "../../../utils/workspacePaths";
import { createFileDocumentSnapshot } from "../utils/fileDocumentSnapshot";
import {
  writeDetachedFileTreeDragSnapshot,
  DETACHED_FILE_TREE_DRAG_BRIDGE_EVENT,
  type DetachedFileTreeDragBridgePayload,
} from "../detachedFileTreeDragBridge";
import {
  CROSS_WINDOW_TREE_DRAG_REBROADCAST_THROTTLE_MS,
} from "../utils/fileTreeDragBridge";
import { FilePreviewPopover } from "./FilePreviewPopover";
import {
  FileTreeNewFilePrompt,
  FileTreeNewFolderPrompt,
  FileTreeRenamePrompt,
  type RenamePromptState,
} from "./FileTreePrompts";
import {
  FileTreeNodeBranch,
  FileTreeVirtualRow,
  type FileTreeRowHandlers,
  type FileTreeRowRefs,
  type FileTreeRowState,
} from "./FileTreeRows";
import { FileTreeRootActions } from "./FileTreeRootActions";
import {
  clampRendererContextMenuPosition,
  RendererContextMenu,
  type RendererContextMenuItem,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";
import {
  EMPTY_DIRECTORIES,
  EMPTY_DIRECTORY_METADATA,
  EMPTY_SET,
  FILE_TREE_VIRTUALIZATION_THRESHOLD,
  buildTree,
  filterDeletedFileTreePathFromMap,
  filterDeletedFileTreePathFromSet,
  filterSuppressedFileTreePaths,
  getGitignoredFolderAncestorPaths,
  isGitignoredFileTreeNode,
  isImagePath,
  isSameOrDescendantFileTreePath,
  isSpecialDirectoryPath,
  isSuppressedFileTreePath,
  resolveWorkspaceRootLabel,
  type FileTreeNode,
  type VisibleFileTreeRow,
  type VisibleTreeNodeEntry,
} from "./fileTreePanelInternals";

type FileTreeClipboardItem = {
  workspaceId: string;
  path: string;
  kind: "file" | "folder";
  name: string;
};

type FileTreeOperationNotice = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};

type FileTreePanelProps = {
  workspaceId: string;
  workspaceName?: string;
  workspacePath: string;
  gitRoot?: string | null;
  files: string[];
  directories?: string[];
  directoryMetadata?: WorkspaceDirectoryEntry[];
  isLoading: boolean;
  loadError?: string | null;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  onInsertText?: (text: string) => void;
  onOpenFile?: (path: string, location?: FileOpenLocation) => void;
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  onToggleRuntimeConsole?: () => void;
  isRuntimeConsoleVisible?: boolean;
  onOpenSpecHub?: () => void;
  isSpecHubActive?: boolean;
  onOpenDetachedExplorer?: (initialFilePath?: string | null) => void;
  showSpecHubAction?: boolean;
  showDetachedExplorerAction?: boolean;
  crossWindowDragTargetLabel?: string | null;
  gitStatusFiles?: GitFileStatus[];
  gitignoredFiles?: Set<string>;
  gitignoredDirectories?: Set<string>;
  onRefreshFiles?: () => void;
};

type FileOpenLocation = {
  line: number;
  column: number;
};

export function FileTreePanel({
  workspaceId,
  workspaceName,
  workspacePath,
  gitRoot = null,
  files,
  directories,
  directoryMetadata = EMPTY_DIRECTORY_METADATA,
  isLoading,
  loadError = null,
  filePanelMode: _filePanelMode,
  onFilePanelModeChange: _onFilePanelModeChange,
  onInsertText,
  onOpenFile,
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  onToggleRuntimeConsole: _onToggleRuntimeConsole,
  isRuntimeConsoleVisible: _isRuntimeConsoleVisible = false,
  onOpenSpecHub,
  isSpecHubActive = false,
  onOpenDetachedExplorer,
  showSpecHubAction = true,
  showDetachedExplorerAction = true,
  crossWindowDragTargetLabel = null,
  gitStatusFiles,
  gitignoredFiles,
  gitignoredDirectories,
  onRefreshFiles,
}: FileTreePanelProps) {
  const directoryEntries = directories ?? EMPTY_DIRECTORIES;
  const ignoredFileEntries = gitignoredFiles ?? EMPTY_SET;
  const ignoredDirectoryEntries = gitignoredDirectories ?? EMPTY_SET;
  const { t } = useTranslation();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [rootExpanded, setRootExpanded] = useState(true);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{
    top: number;
    left: number;
    arrowTop: number;
    height: number;
  } | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSelection, setPreviewSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const dragAnchorLineRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<"file" | "folder" | null>(null);
  const [selectedNodePaths, setSelectedNodePaths] = useState<Set<string>>(new Set());
  const [fileTreeContextMenu, setFileTreeContextMenu] =
    useState<RendererContextMenuState | null>(null);
  const [fileTreeClipboardItem, setFileTreeClipboardItem] =
    useState<FileTreeClipboardItem | null>(null);
  const [operationNotice, setOperationNotice] = useState<FileTreeOperationNotice | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<RenamePromptState | null>(null);
  const [renameDraftName, setRenameDraftName] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const selectionAnchorPathRef = useRef<string | null>(null);
  const activeCrossWindowDragPathsRef = useRef<string[]>([]);
  const lastCrossWindowDragBroadcastRef = useRef(0);
  const dragImageCleanupRef = useRef<(() => void) | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const fileTreeListRef = useRef<HTMLDivElement | null>(null);
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);
  const [lazyFiles, setLazyFiles] = useState<Set<string>>(new Set());
  const [lazyDirectories, setLazyDirectories] = useState<Set<string>>(new Set());
  const [lazyGitignoredFiles, setLazyGitignoredFiles] = useState<Set<string>>(new Set());
  const [lazyGitignoredDirectories, setLazyGitignoredDirectories] = useState<Set<string>>(new Set());
  const [lazyLoadableDirectories, setLazyLoadableDirectories] = useState<Set<string>>(new Set());
  const [lazyDirectoryMetadata, setLazyDirectoryMetadata] = useState<Map<string, WorkspaceDirectoryEntry>>(
    new Map(),
  );
  const [loadedLazyDirectories, setLoadedLazyDirectories] = useState<Set<string>>(new Set());
  const [loadingLazyDirectories, setLoadingLazyDirectories] = useState<Set<string>>(new Set());
  const [lazyDirectoryLoadErrors, setLazyDirectoryLoadErrors] = useState<Map<string, string>>(
    new Map(),
  );
  const [suppressedDeletedPaths, setSuppressedDeletedPaths] = useState<Set<string>>(new Set());
  const loadedLazyDirectoriesRef = useRef<Set<string>>(new Set());
  const loadingLazyDirectoriesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      dragImageCleanupRef.current?.();
      dragImageCleanupRef.current = null;
    };
  }, []);

  const workspaceRootLabel = useMemo(
    () => resolveWorkspaceRootLabel(workspacePath, workspaceName),
    [workspaceName, workspacePath],
  );
  const gitRootWorkspacePrefix = useMemo(
    () => resolveGitRootWorkspacePrefix(workspacePath, gitRoot),
    [gitRoot, workspacePath],
  );
  const previewKind = useMemo(
    () => (previewPath && isImagePath(previewPath) ? "image" : "text"),
    [previewPath],
  );
  const mergedFiles = useMemo(() => {
    const next = new Set<string>(files);
    lazyFiles.forEach((path) => next.add(path));
    return Array.from(next).filter((path) => !isSuppressedFileTreePath(path, suppressedDeletedPaths));
  }, [files, lazyFiles, suppressedDeletedPaths]);
  const mergedDirectories = useMemo(() => {
    const next = new Set<string>(directoryEntries);
    lazyDirectories.forEach((path) => next.add(path));
    return Array.from(next).filter((path) => !isSuppressedFileTreePath(path, suppressedDeletedPaths));
  }, [directoryEntries, lazyDirectories, suppressedDeletedPaths]);
  const mergedGitignoredFiles = useMemo(() => {
    const next = new Set<string>(ignoredFileEntries);
    lazyGitignoredFiles.forEach((path) => next.add(path));
    return filterSuppressedFileTreePaths(next, suppressedDeletedPaths);
  }, [ignoredFileEntries, lazyGitignoredFiles, suppressedDeletedPaths]);
  const mergedGitignoredDirectories = useMemo(() => {
    const next = new Set<string>(ignoredDirectoryEntries);
    lazyGitignoredDirectories.forEach((path) => next.add(path));
    return filterSuppressedFileTreePaths(next, suppressedDeletedPaths);
  }, [ignoredDirectoryEntries, lazyGitignoredDirectories, suppressedDeletedPaths]);
  const directoryMetadataByPath = useMemo(() => {
    const next = new Map<string, WorkspaceDirectoryEntry>();
    directoryMetadata.forEach((entry) => {
      if (entry.path && !isSuppressedFileTreePath(entry.path, suppressedDeletedPaths)) {
        next.set(entry.path, entry);
      }
    });
    lazyDirectoryMetadata.forEach((entry, path) => {
      if (!isSuppressedFileTreePath(path, suppressedDeletedPaths)) {
        next.set(path, entry);
      }
    });
    return next;
  }, [directoryMetadata, lazyDirectoryMetadata, suppressedDeletedPaths]);
  const seededLazyLoadableDirectories = useMemo(() => {
    const result = new Set<string>();
    mergedDirectories.forEach((path) => {
      if (isSpecialDirectoryPath(path)) {
        result.add(path);
      }
      const childState = directoryMetadataByPath.get(path)?.child_state;
      if (childState === "unknown" || childState === "partial") {
        result.add(path);
      }
    });
    return result;
  }, [directoryMetadataByPath, mergedDirectories]);
  const effectiveLazyLoadableDirectories = useMemo(() => {
    const result = new Set(seededLazyLoadableDirectories);
    lazyLoadableDirectories.forEach((path) => result.add(path));
    return result;
  }, [seededLazyLoadableDirectories, lazyLoadableDirectories]);
  const hasTreeEntries = mergedFiles.length > 0 || mergedDirectories.length > 0;
  const showLoading = isLoading && !hasTreeEntries;
  const normalizedLoadError =
    typeof loadError === "string" && loadError.trim().length > 0 ? loadError.trim() : null;

  const gitStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    if (gitStatusFiles) {
      for (const entry of gitStatusFiles) {
        const entryPath = entry.path?.trim();
        const entryStatus = entry.status?.trim();
        if (!entryPath || !entryStatus) {
          continue;
        }
        resolveGitStatusPathCandidates(
          workspacePath,
          gitRootWorkspacePrefix,
          entryPath,
        ).forEach((path) => map.set(path, entryStatus));
      }
    }
    return map;
  }, [gitRootWorkspacePrefix, gitStatusFiles, workspacePath]);

  const { nodes, folderPaths } = useMemo(
    () => buildTree(
      mergedFiles,
      mergedDirectories,
      effectiveLazyLoadableDirectories,
      directoryMetadataByPath,
    ),
    [
      effectiveLazyLoadableDirectories,
      directoryMetadataByPath,
      mergedDirectories,
      mergedFiles,
    ],
  );
  const gitignoredTreeNodeMap = useMemo(() => {
    const memo = new Map<string, boolean>();
    nodes.forEach((node) => {
      isGitignoredFileTreeNode(
        node,
        mergedGitignoredFiles,
        mergedGitignoredDirectories,
        memo,
      );
    });
    return memo;
  }, [mergedGitignoredDirectories, mergedGitignoredFiles, nodes]);
  const gitignoredFolderAncestorPaths = useMemo(
    () => getGitignoredFolderAncestorPaths(folderPaths, mergedGitignoredDirectories),
    [folderPaths, mergedGitignoredDirectories],
  );
  const effectiveExpandedFolders = useMemo(() => {
    if (gitignoredFolderAncestorPaths.size === 0) {
      return expandedFolders;
    }
    const next = new Set(expandedFolders);
    gitignoredFolderAncestorPaths.forEach((path) => {
      if (folderPaths.has(path)) {
        next.add(path);
      }
    });
    return next;
  }, [expandedFolders, folderPaths, gitignoredFolderAncestorPaths]);
  const folderGitStatusMap = useMemo(() => {
    if (!gitStatusFiles || gitStatusFiles.length === 0) {
      return new Map<string, string>();
    }
    const priority: Record<string, number> = { D: 4, A: 3, M: 2, R: 1, T: 0 };
    const map = new Map<string, string>();
    const assignIfHigherPriority = (folderPath: string, status: string) => {
      const nextStatus = status.trim().toUpperCase();
      const nextPriority = priority[nextStatus];
      if (nextPriority === undefined) {
        return;
      }
      const current = map.get(folderPath);
      const currentPriority = current ? (priority[current] ?? -1) : -1;
      if (nextPriority > currentPriority) {
        map.set(folderPath, nextStatus);
      }
    };

    for (const entry of gitStatusFiles) {
      const entryPath = entry.path?.trim();
      const entryStatus = entry.status?.trim();
      if (!entryPath || !entryStatus) {
        continue;
      }
      const pathCandidates = resolveGitStatusPathCandidates(
        workspacePath,
        gitRootWorkspacePrefix,
        entryPath,
      );
      pathCandidates.forEach((candidatePath) => {
        const segments = candidatePath.split("/").filter(Boolean);
        if (segments.length <= 1) {
          return;
        }
        let folderPath = "";
        for (let index = 0; index < segments.length - 1; index += 1) {
          const segment = segments[index] ?? "";
          folderPath = folderPath
            ? `${folderPath}/${segment}`
            : segment;
          assignIfHigherPriority(folderPath, entryStatus);
        }
      });
    }

    return map;
  }, [gitRootWorkspacePrefix, gitStatusFiles, workspacePath]);

  const isRootVisibleExpanded = rootExpanded;
  const visibleTreeNodeEntries = useMemo(() => {
    const entries: VisibleTreeNodeEntry[] = [{ path: "", type: "root", depth: 0, node: null }];
    const visit = (node: FileTreeNode, depth: number) => {
      entries.push({ path: node.path, type: node.type, depth, node });
      if (node.type === "folder" && effectiveExpandedFolders.has(node.path)) {
        node.children.forEach((child) => visit(child, depth + 1));
      }
    };
    if (rootExpanded) {
      nodes.forEach((node) => visit(node, 1));
    }
    return entries;
  }, [effectiveExpandedFolders, nodes, rootExpanded]);
  const visibleFileTreeRows = useMemo(() => {
    const rows: VisibleFileTreeRow[] = [];
    for (const entry of visibleTreeNodeEntries) {
      if (!entry.node) {
        continue;
      }
      rows.push({ kind: "node", entry: entry as VisibleTreeNodeEntry & { node: FileTreeNode } });
      const node = entry.node;
      const isLazyFolder = node.type === "folder" && (node.isLazyLoadable ?? false);
      const isExpanded = effectiveExpandedFolders.has(node.path);
      if (!isLazyFolder || !isExpanded || node.children.length > 0) {
        continue;
      }
      const lazyLoadError = lazyDirectoryLoadErrors.get(node.path) ?? null;
      rows.push({
        kind: "lazy-state",
        path: node.path,
        depth: entry.depth + 1,
        state: loadingLazyDirectories.has(node.path)
          ? "loading"
          : lazyLoadError
            ? "error"
            : "empty",
        error: lazyLoadError,
      });
    }
    return rows;
  }, [
    effectiveExpandedFolders,
    lazyDirectoryLoadErrors,
    loadingLazyDirectories,
    visibleTreeNodeEntries,
  ]);
  const shouldVirtualizeFileTree =
    visibleFileTreeRows.length > FILE_TREE_VIRTUALIZATION_THRESHOLD;
  const fileTreeRowVirtualizer = useVirtualizer({
    count: shouldVirtualizeFileTree ? visibleFileTreeRows.length : 0,
    getScrollElement: () => fileTreeListRef.current,
    estimateSize: () => 28,
    overscan: 16,
    getItemKey: (index) => {
      const row = visibleFileTreeRows[index];
      if (!row) {
        return index;
      }
      return row.kind === "node"
        ? row.entry.path
        : `${row.path}:lazy-${row.state}`;
    },
  });
  const visibleTreePathOrder = useMemo(
    () => visibleTreeNodeEntries.map((entry) => entry.path),
    [visibleTreeNodeEntries],
  );
  const visibleTreePathTypeMap = useMemo(
    () =>
      new Map<string, "file" | "folder" | "root">(
        visibleTreeNodeEntries.map((entry) => [entry.path, entry.type]),
      ),
    [visibleTreeNodeEntries],
  );
  const allTreeNodePaths = useMemo(() => {
    const result = new Set<string>([""]);
    const visit = (node: FileTreeNode) => {
      result.add(node.path);
      if (node.type === "folder") {
        node.children.forEach(visit);
      }
    };
    nodes.forEach(visit);
    return result;
  }, [nodes]);

  const setSingleSelection = useCallback((path: string, type: "file" | "folder" | "root") => {
    setSelectedNodePaths(new Set([path]));
    setSelectedNodePath(path);
    setSelectedNodeType(type === "root" ? "folder" : type);
    selectionAnchorPathRef.current = path;
  }, []);

  const setRangeSelection = useCallback(
    (targetPath: string, targetType: "file" | "folder" | "root") => {
      const anchorPath = selectionAnchorPathRef.current ?? selectedNodePath ?? targetPath;
      const anchorIndex = visibleTreePathOrder.indexOf(anchorPath);
      const targetIndex = visibleTreePathOrder.indexOf(targetPath);
      if (anchorIndex < 0 || targetIndex < 0) {
        setSingleSelection(targetPath, targetType);
        return;
      }
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangePaths = visibleTreePathOrder.slice(start, end + 1);
      setSelectedNodePaths(new Set(rangePaths));
      setSelectedNodePath(targetPath);
      setSelectedNodeType(targetType === "root" ? "folder" : targetType);
    },
    [selectedNodePath, setSingleSelection, visibleTreePathOrder],
  );

  const togglePathSelection = useCallback((path: string, type: "file" | "folder" | "root") => {
    setSelectedNodePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      const fallbackPath = next.has(path)
        ? path
        : visibleTreePathOrder.find((entryPath) => next.has(entryPath)) ?? null;
      setSelectedNodePath(fallbackPath);
      setSelectedNodeType(
        fallbackPath ? ((visibleTreePathTypeMap.get(fallbackPath) ?? type) === "root" ? "folder" : (visibleTreePathTypeMap.get(fallbackPath) ?? type) as "file" | "folder") : null,
      );
      selectionAnchorPathRef.current = path;
      return next;
    });
  }, [visibleTreePathOrder, visibleTreePathTypeMap]);

  useEffect(() => {
    setExpandedFolders((prev) => {
      // Keep only folders that still exist; default is all collapsed.
      const next = new Set<string>();
      prev.forEach((path) => {
        if (folderPaths.has(path)) {
          next.add(path);
        }
      });
      if (next.size === prev.size && [...next].every((path) => prev.has(path))) {
        return prev;
      }
      return next;
    });
  }, [folderPaths]);

  useEffect(() => {
    if (gitignoredFolderAncestorPaths.size === 0) {
      return;
    }
    setExpandedFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      gitignoredFolderAncestorPaths.forEach((path) => {
        if (!folderPaths.has(path) || next.has(path)) {
          return;
        }
        next.add(path);
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [folderPaths, gitignoredFolderAncestorPaths]);

  useEffect(() => {
    setSelectedNodePaths((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Set<string>();
      prev.forEach((path) => {
        if (allTreeNodePaths.has(path)) {
          next.add(path);
        } else {
          changed = true;
        }
      });
      if (!changed) {
        return prev;
      }
      const nextPrimaryPath =
        selectedNodePath && next.has(selectedNodePath)
          ? selectedNodePath
          : visibleTreePathOrder.find((path) => next.has(path)) ?? null;
      setSelectedNodePath(nextPrimaryPath);
      setSelectedNodeType(
        nextPrimaryPath
          ? (visibleTreePathTypeMap.get(nextPrimaryPath) === "file" ? "file" : "folder")
          : null,
      );
      if (selectionAnchorPathRef.current && !next.has(selectionAnchorPathRef.current)) {
        selectionAnchorPathRef.current = nextPrimaryPath;
      }
      return next;
    });
  }, [allTreeNodePaths, selectedNodePath, visibleTreePathOrder, visibleTreePathTypeMap]);

  useEffect(() => {
    loadedLazyDirectoriesRef.current = loadedLazyDirectories;
  }, [loadedLazyDirectories]);

  useEffect(() => {
    loadingLazyDirectoriesRef.current = loadingLazyDirectories;
  }, [loadingLazyDirectories]);

  useEffect(() => {
    setPreviewPath(null);
    setPreviewAnchor(null);
    setPreviewSelection(null);
    setPreviewContent("");
    setPreviewTruncated(false);
    setPreviewError(null);
    setPreviewLoading(false);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
    setLazyFiles(new Set());
    setLazyDirectories(new Set());
    setLazyGitignoredFiles(new Set());
    setLazyGitignoredDirectories(new Set());
    setLazyLoadableDirectories(new Set());
    setLazyDirectoryMetadata(new Map());
    setLoadedLazyDirectories(new Set());
    setLoadingLazyDirectories(new Set());
    setLazyDirectoryLoadErrors(new Map());
    setNewFileParent(null);
    setNewFileName("");
    setNewFolderParent(null);
    setNewFolderName("");
    setSuppressedDeletedPaths(new Set());
    setRootExpanded(true);
    setSelectedNodePath(null);
    setSelectedNodeType(null);
    setSelectedNodePaths(new Set());
    selectionAnchorPathRef.current = null;
    loadedLazyDirectoriesRef.current = new Set();
    loadingLazyDirectoriesRef.current = new Set();
  }, [workspaceId]);

  const closePreview = useCallback(() => {
    setPreviewPath(null);
    setPreviewAnchor(null);
    setPreviewSelection(null);
    setPreviewContent("");
    setPreviewTruncated(false);
    setPreviewError(null);
    setPreviewLoading(false);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
  }, []);

  const loadLazyDirectoryChildren = useCallback(
    async (path: string) => {
      if (
        loadedLazyDirectoriesRef.current.has(path) ||
        loadingLazyDirectoriesRef.current.has(path)
      ) {
        return;
      }
      loadingLazyDirectoriesRef.current = new Set(loadingLazyDirectoriesRef.current).add(path);
      setLoadingLazyDirectories((prev) => {
        const next = new Set(prev);
        next.add(path);
        return next;
      });
      setLazyDirectoryLoadErrors((prev) => {
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
      try {
        const response = await getWorkspaceDirectoryChildren(workspaceId, path);
        const nextFiles = Array.isArray(response.files) ? response.files : [];
        const nextDirectories = Array.isArray(response.directories) ? response.directories : [];
        const nextGitignoredFiles = Array.isArray(response.gitignored_files)
          ? response.gitignored_files
          : [];
        const nextGitignoredDirectories = Array.isArray(response.gitignored_directories)
          ? response.gitignored_directories
          : [];
        const nextDirectoryMetadata = Array.isArray(response.directory_entries)
          ? response.directory_entries.filter((entry): entry is WorkspaceDirectoryEntry =>
              Boolean(entry && typeof entry.path === "string" && typeof entry.child_state === "string"),
            )
          : [];

        setLazyFiles((prev) => {
          const next = new Set(prev);
          nextFiles.forEach((entry) => next.add(entry));
          return next;
        });
        setLazyDirectories((prev) => {
          const next = new Set(prev);
          nextDirectories.forEach((entry) => next.add(entry));
          return next;
        });
        setLazyLoadableDirectories((prev) => {
          const next = new Set(prev);
          nextDirectories.forEach((entry) => next.add(entry));
          nextDirectoryMetadata.forEach((entry) => {
            if (entry.child_state === "unknown" || entry.child_state === "partial") {
              next.add(entry.path);
            }
            if (entry.child_state === "empty" || entry.child_state === "loaded") {
              next.delete(entry.path);
            }
          });
          return next;
        });
        setLazyDirectoryMetadata((prev) => {
          const next = new Map(prev);
          if (nextDirectoryMetadata.length === 0) {
            const childState = nextFiles.length === 0 && nextDirectories.length === 0
              ? "empty"
              : "loaded";
            next.set(path, { path, child_state: childState });
          } else {
            nextDirectoryMetadata.forEach((entry) => next.set(entry.path, entry));
          }
          return next;
        });
        setLazyGitignoredFiles((prev) => {
          const next = new Set(prev);
          nextGitignoredFiles.forEach((entry) => next.add(entry));
          return next;
        });
        setLazyGitignoredDirectories((prev) => {
          const next = new Set(prev);
          nextGitignoredDirectories.forEach((entry) => next.add(entry));
          return next;
        });
        loadedLazyDirectoriesRef.current = new Set(loadedLazyDirectoriesRef.current).add(path);
        setLoadedLazyDirectories((prev) => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setLazyDirectoryLoadErrors((prev) => {
          const next = new Map(prev);
          next.set(path, message);
          return next;
        });
      } finally {
        const nextLoadingDirectories = new Set(loadingLazyDirectoriesRef.current);
        nextLoadingDirectories.delete(path);
        loadingLazyDirectoriesRef.current = nextLoadingDirectories;
        setLoadingLazyDirectories((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!previewPath) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewPath, closePreview]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleFolderExpandedState = useCallback(
    (path: string, isLazyFolder: boolean) => {
      const shouldExpand = !expandedFolders.has(path);
      toggleFolder(path);
      if (shouldExpand && isLazyFolder) {
        void loadLazyDirectoryChildren(path);
      }
    },
    [expandedFolders, loadLazyDirectoryChildren],
  );

  const resolvePath = useCallback(
    (relativePath: string) => {
      const usesWindowsSeparator = workspacePath.includes("\\");
      const separator = usesWindowsSeparator ? "\\" : "/";
      const base = workspacePath.replace(/[\\/]+$/, "");
      const normalizedRelative = usesWindowsSeparator
        ? relativePath.replaceAll("/", "\\")
        : relativePath;
      return `${base}${separator}${normalizedRelative}`;
    },
    [workspacePath],
  );

  const previewImageSrc = useMemo(() => {
    if (!previewPath || previewKind !== "image") {
      return null;
    }
    try {
      return convertFileSrc(resolvePath(previewPath));
    } catch {
      return null;
    }
  }, [previewPath, previewKind, resolvePath]);

  const openPreview = useCallback((path: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const estimatedWidth = 640;
    const estimatedHeight = 520;
    const padding = 16;
    const maxHeight = Math.min(estimatedHeight, window.innerHeight - padding * 2);
    const left = Math.min(
      Math.max(padding, rect.left - estimatedWidth - padding),
      Math.max(padding, window.innerWidth - estimatedWidth - padding),
    );
    const top = Math.min(
      Math.max(padding, rect.top - maxHeight * 0.35),
      Math.max(padding, window.innerHeight - maxHeight - padding),
    );
    const arrowTop = Math.min(
      Math.max(16, rect.top + rect.height / 2 - top),
      Math.max(16, maxHeight - 16),
    );
    setPreviewPath(path);
    setPreviewAnchor({ top, left, arrowTop, height: maxHeight });
    setPreviewSelection(null);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
  }, []);

  useEffect(() => {
    if (!previewPath) {
      return;
    }
    let cancelled = false;
    if (previewKind === "image") {
      setPreviewContent("");
      setPreviewTruncated(false);
      setPreviewError(null);
      setPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setPreviewLoading(true);
    setPreviewError(null);
    readWorkspaceFile(workspaceId, previewPath)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setPreviewContent(response.content ?? "");
        setPreviewTruncated(Boolean(response.truncated));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPreviewError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewKind, previewPath, workspaceId]);

  useEffect(() => {
    if (!isDragSelecting) {
      return;
    }
    const handleMouseUp = () => {
      setIsDragSelecting(false);
      dragAnchorLineRef.current = null;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDragSelecting]);

  const selectRangeFromAnchor = useCallback((anchor: number, index: number) => {
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    setPreviewSelection({ start, end });
  }, []);

  const handleSelectLine = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      if (dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }
      if (event.shiftKey && previewSelection) {
        const anchor = previewSelection.start;
        selectRangeFromAnchor(anchor, index);
        return;
      }
      setPreviewSelection({ start: index, end: index });
    },
    [previewSelection, selectRangeFromAnchor],
  );

  const handleLineMouseDown = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      if (previewKind !== "text" || event.button !== 0) {
        return;
      }
      event.preventDefault();
      setIsDragSelecting(true);
      const anchor =
        event.shiftKey && previewSelection ? previewSelection.start : index;
      dragAnchorLineRef.current = anchor;
      dragMovedRef.current = false;
      selectRangeFromAnchor(anchor, index);
    },
    [previewKind, previewSelection, selectRangeFromAnchor],
  );

  const handleLineMouseEnter = useCallback(
    (index: number, _event: MouseEvent<HTMLButtonElement>) => {
      if (!isDragSelecting) {
        return;
      }
      const anchor = dragAnchorLineRef.current;
      if (anchor === null) {
        return;
      }
      if (anchor !== index) {
        dragMovedRef.current = true;
      }
      selectRangeFromAnchor(anchor, index);
    },
    [isDragSelecting, selectRangeFromAnchor],
  );

  const handleLineMouseUp = useCallback(() => {
    if (!isDragSelecting) {
      return;
    }
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
  }, [isDragSelecting]);

  const selectionHints = useMemo(
    () =>
      previewKind === "text"
        ? [t("files.selectionHintShiftClick"), t("files.selectionHintMultiLine")]
        : [],
    [previewKind, t],
  );
  const previewDocumentSnapshot = useMemo(
    () => createFileDocumentSnapshot(previewContent, previewTruncated, 0),
    [previewContent, previewTruncated],
  );

  const handleAddSelection = useCallback(() => {
    if (previewKind !== "text" || !previewPath || !previewSelection || !onInsertText) {
      return;
    }
    const selected = previewDocumentSnapshot.getLines(
      previewSelection.start,
      previewSelection.end + 1,
    );
    const language = languageFromPath(previewPath);
    const fence = language ? `\`\`\`${language}` : "```";
    const start = previewSelection.start + 1;
    const end = previewSelection.end + 1;
    const rangeLabel = start === end ? `L${start}` : `L${start}-L${end}`;
    const snippet = `${previewPath}:${rangeLabel}\n${fence}\n${selected.join("\n")}\n\`\`\``;
    onInsertText(snippet);
    closePreview();
  }, [
    previewDocumentSnapshot,
    previewKind,
    previewPath,
    previewSelection,
    onInsertText,
    closePreview,
  ]);

  const copyPath = useCallback(
    async (relativePath: string) => {
      try {
        await navigator.clipboard.writeText(resolvePath(relativePath));
      } catch {
        // clipboard write is not critical
      }
    },
    [resolvePath],
  );

  const normalizeOperationError = useCallback((error: unknown) => {
    return error instanceof Error ? error.message : String(error);
  }, []);

  const showOperationNotice = useCallback((tone: FileTreeOperationNotice["tone"], message: string) => {
    setOperationNotice({
      id: `${Date.now()}-${tone}`,
      tone,
      message,
    });
  }, []);

  useEffect(() => {
    setSuppressedDeletedPaths((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Set(prev);
      prev.forEach((deletedPath) => {
        const stillPresent =
          files.some((path) => isSameOrDescendantFileTreePath(path, deletedPath)) ||
          directoryEntries.some((path) => isSameOrDescendantFileTreePath(path, deletedPath)) ||
          Array.from(lazyFiles).some((path) => isSameOrDescendantFileTreePath(path, deletedPath)) ||
          Array.from(lazyDirectories).some((path) =>
            isSameOrDescendantFileTreePath(path, deletedPath),
          );
        if (!stillPresent) {
          next.delete(deletedPath);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [directoryEntries, files, lazyDirectories, lazyFiles]);

  const purgeDeletedFileTreePath = useCallback(
    (deletedPath: string) => {
      setSuppressedDeletedPaths((prev) => {
        if (prev.has(deletedPath)) {
          return prev;
        }
        return new Set(prev).add(deletedPath);
      });
      setExpandedFolders((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLazyFiles((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLazyDirectories((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLazyGitignoredFiles((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLazyGitignoredDirectories((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLazyLoadableDirectories((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLazyDirectoryMetadata((prev) => filterDeletedFileTreePathFromMap(prev, deletedPath));
      setLoadedLazyDirectories((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLoadingLazyDirectories((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      setLazyDirectoryLoadErrors((prev) => filterDeletedFileTreePathFromMap(prev, deletedPath));
      loadedLazyDirectoriesRef.current = filterDeletedFileTreePathFromSet(
        loadedLazyDirectoriesRef.current,
        deletedPath,
      );
      loadingLazyDirectoriesRef.current = filterDeletedFileTreePathFromSet(
        loadingLazyDirectoriesRef.current,
        deletedPath,
      );
      setSelectedNodePaths((prev) => {
        const next = filterDeletedFileTreePathFromSet(prev, deletedPath);
        if (next === prev) {
          return prev;
        }
        const nextPrimaryPath =
          selectedNodePath && next.has(selectedNodePath)
            ? selectedNodePath
            : visibleTreePathOrder.find((path) => next.has(path)) ?? null;
        setSelectedNodePath(nextPrimaryPath);
        setSelectedNodeType(
          nextPrimaryPath
            ? (visibleTreePathTypeMap.get(nextPrimaryPath) === "file" ? "file" : "folder")
            : null,
        );
        if (
          selectionAnchorPathRef.current &&
          isSameOrDescendantFileTreePath(selectionAnchorPathRef.current, deletedPath)
        ) {
          selectionAnchorPathRef.current = nextPrimaryPath;
        }
        return next;
      });
      setFileTreeClipboardItem((prev) =>
        prev && isSameOrDescendantFileTreePath(prev.path, deletedPath) ? null : prev,
      );
      setRenamePrompt((prev) =>
        prev && isSameOrDescendantFileTreePath(prev.path, deletedPath) ? null : prev,
      );
      setNewFileParent((prev) =>
        prev && isSameOrDescendantFileTreePath(prev, deletedPath) ? null : prev,
      );
      setNewFolderParent((prev) =>
        prev && isSameOrDescendantFileTreePath(prev, deletedPath) ? null : prev,
      );
      if (previewPath && isSameOrDescendantFileTreePath(previewPath, deletedPath)) {
        closePreview();
      }
    },
    [
      closePreview,
      previewPath,
      selectedNodePath,
      visibleTreePathOrder,
      visibleTreePathTypeMap,
    ],
  );

  const trashItem = useCallback(
    async (relativePath: string, isFolder: boolean) => {
      const name = relativePath.split("/").pop() ?? relativePath;
      const confirmMessage = isFolder
        ? t("files.deleteFolderConfirm", { name })
        : t("files.deleteFileConfirm", { name });

      const confirmed = await confirm(confirmMessage, {
        title: t("files.deleteItem"),
        kind: "warning",
        okLabel: t("files.deleteItem"),
        cancelLabel: t("files.cancel"),
      });

      if (!confirmed) {
        return;
      }

      try {
        await trashWorkspaceItem(workspaceId, relativePath);
        purgeDeletedFileTreePath(relativePath);
        showOperationNotice("success", t("files.trashComplete"));
        onRefreshFiles?.();
      } catch (error) {
        showOperationNotice("error", t("files.trashFailed", { message: normalizeOperationError(error) }));
      }
    },
    [
      normalizeOperationError,
      onRefreshFiles,
      purgeDeletedFileTreePath,
      showOperationNotice,
      t,
      workspaceId,
    ],
  );

  const getFileTreeItemName = useCallback((relativePath: string) => {
    if (!relativePath) {
      return workspaceRootLabel;
    }
    return relativePath.split("/").filter(Boolean).pop() ?? relativePath;
  }, [workspaceRootLabel]);

  const copyFileTreeItem = useCallback(
    (relativePath: string, kind: "file" | "folder") => {
      setFileTreeClipboardItem({
        workspaceId,
        path: relativePath,
        kind,
        name: getFileTreeItemName(relativePath),
      });
      showOperationNotice("info", t("files.copyReady"));
    },
    [getFileTreeItemName, showOperationNotice, t, workspaceId],
  );

  const pasteFileTreeItem = useCallback(
    async (targetDirectory: string) => {
      if (!fileTreeClipboardItem) {
        showOperationNotice("error", t("files.pasteUnavailable"));
        return;
      }
      if (fileTreeClipboardItem.workspaceId !== workspaceId) {
        showOperationNotice("error", t("files.pasteWorkspaceMismatch"));
        return;
      }
      try {
        const result = await pasteWorkspaceItem(
          workspaceId,
          fileTreeClipboardItem.path,
          targetDirectory,
        );
        setSelectedNodePath(result.path);
        setSelectedNodeType(result.kind === "folder" ? "folder" : "file");
        setSelectedNodePaths(new Set([result.path]));
        showOperationNotice("success", t("files.pasteComplete"));
        onRefreshFiles?.();
      } catch (error) {
        showOperationNotice("error", t("files.pasteFailed", { message: normalizeOperationError(error) }));
      }
    },
    [
      fileTreeClipboardItem,
      normalizeOperationError,
      onRefreshFiles,
      showOperationNotice,
      t,
      workspaceId,
    ],
  );

  const duplicateItem = useCallback(
    async (relativePath: string) => {
      try {
        const result = await duplicateWorkspaceItem(workspaceId, relativePath);
        setSelectedNodePath(result.path);
        setSelectedNodeType(result.kind === "folder" ? "folder" : "file");
        setSelectedNodePaths(new Set([result.path]));
        showOperationNotice("success", t("files.duplicateComplete"));
        onRefreshFiles?.();
      } catch (error) {
        showOperationNotice("error", t("files.duplicateFailed", { message: normalizeOperationError(error) }));
      }
    },
    [normalizeOperationError, onRefreshFiles, showOperationNotice, t, workspaceId],
  );

  const openRenamePrompt = useCallback(
    (relativePath: string, kind: "file" | "folder") => {
      const currentName = getFileTreeItemName(relativePath);
      setRenamePrompt({
        path: relativePath,
        kind,
        currentName,
      });
      setRenameDraftName(currentName);
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    },
    [getFileTreeItemName],
  );

  const cancelRename = useCallback(() => {
    setRenamePrompt(null);
    setRenameDraftName("");
  }, []);

  const confirmRename = useCallback(async () => {
    const prompt = renamePrompt;
    const name = renameDraftName.trim();
    if (!prompt || !name) {
      showOperationNotice("error", t("files.renameInvalidName"));
      return;
    }
    try {
      const result = await renameWorkspaceItem(workspaceId, prompt.path, name);
      setSelectedNodePath(result.path);
      setSelectedNodeType(result.kind === "folder" ? "folder" : "file");
      setSelectedNodePaths(new Set([result.path]));
      setRenamePrompt(null);
      setRenameDraftName("");
      showOperationNotice("success", t("files.renameComplete"));
      onRefreshFiles?.();
    } catch (error) {
      showOperationNotice("error", t("files.renameFailed", { message: normalizeOperationError(error) }));
    }
  }, [
    normalizeOperationError,
    onRefreshFiles,
    renameDraftName,
    renamePrompt,
    showOperationNotice,
    t,
    workspaceId,
  ]);

  const openNewFilePrompt = useCallback(
    (parentFolder: string) => {
      setNewFileParent(parentFolder);
      setNewFileName("");
      requestAnimationFrame(() => {
        newFileInputRef.current?.focus();
      });
    },
    [],
  );

  const confirmNewFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name || newFileParent === null) {
      setNewFileParent(null);
      setNewFileName("");
      return;
    }
    const relativePath = newFileParent ? `${newFileParent}/${name}` : name;
    try {
      await writeWorkspaceFile(workspaceId, relativePath, "");
      showOperationNotice("success", t("files.createFileComplete"));
      onRefreshFiles?.();
    } catch (error) {
      showOperationNotice("error", t("files.createFileFailed", { message: normalizeOperationError(error) }));
    }
    setNewFileParent(null);
    setNewFileName("");
  }, [
    newFileName,
    newFileParent,
    workspaceId,
    onRefreshFiles,
    showOperationNotice,
    t,
    normalizeOperationError,
  ]);

  const cancelNewFile = useCallback(() => {
    setNewFileParent(null);
    setNewFileName("");
  }, []);

  const openNewFolderPrompt = useCallback(
    (parentFolder: string) => {
      setNewFolderParent(parentFolder);
      setNewFolderName("");
      requestAnimationFrame(() => {
        newFolderInputRef.current?.focus();
      });
    },
    [],
  );

  const confirmNewFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || newFolderParent === null) {
      setNewFolderParent(null);
      setNewFolderName("");
      return;
    }
    const relativePath = newFolderParent ? `${newFolderParent}/${name}` : name;
    try {
      await createWorkspaceDirectory(workspaceId, relativePath);
      showOperationNotice("success", t("files.createFolderComplete"));
      onRefreshFiles?.();
    } catch (error) {
      showOperationNotice("error", t("files.createFolderFailed", { message: normalizeOperationError(error) }));
    }
    setNewFolderParent(null);
    setNewFolderName("");
  }, [
    newFolderName,
    newFolderParent,
    workspaceId,
    onRefreshFiles,
    showOperationNotice,
    t,
    normalizeOperationError,
  ]);

  const cancelNewFolder = useCallback(() => {
    setNewFolderParent(null);
    setNewFolderName("");
  }, []);

  const resolveParentFolderForNode = useCallback(
    (relativePath: string | null, nodeType: "file" | "folder" | null) => {
      if (!relativePath) {
        return "";
      }
      if (nodeType === "folder") {
        return relativePath;
      }
      const separatorIndex = relativePath.lastIndexOf("/");
      return separatorIndex >= 0 ? relativePath.slice(0, separatorIndex) : "";
    },
    [],
  );

  const selectedParentFolder = useMemo(
    () => resolveParentFolderForNode(selectedNodePath, selectedNodeType),
    [resolveParentFolderForNode, selectedNodePath, selectedNodeType],
  );
  const detachedInitialFilePath = selectedNodeType === "file" ? selectedNodePath : null;
  const orderedSelectedNodePaths = useMemo(
    () =>
      visibleTreePathOrder.filter((path) => path.length > 0 && selectedNodePaths.has(path)),
    [selectedNodePaths, visibleTreePathOrder],
  );
  const broadcastCrossWindowTreeDrag = useCallback(
    (payload: DetachedFileTreeDragBridgePayload) => {
      if (!crossWindowDragTargetLabel) {
        return;
      }
      if (payload.type === "start") {
        writeDetachedFileTreeDragSnapshot(payload.paths);
      }
      void emitTo(
        crossWindowDragTargetLabel,
        DETACHED_FILE_TREE_DRAG_BRIDGE_EVENT,
        payload,
      ).catch(() => {});
    },
    [crossWindowDragTargetLabel],
  );
  const rebroadcastCrossWindowTreeDrag = useCallback(() => {
    if (!crossWindowDragTargetLabel) {
      return;
    }
    const paths = activeCrossWindowDragPathsRef.current;
    if (paths.length === 0) {
      return;
    }
    const now = Date.now();
    if (
      now - lastCrossWindowDragBroadcastRef.current <
      CROSS_WINDOW_TREE_DRAG_REBROADCAST_THROTTLE_MS
    ) {
      return;
    }
    lastCrossWindowDragBroadcastRef.current = now;
    broadcastCrossWindowTreeDrag({
      type: "start",
      paths,
    });
  }, [broadcastCrossWindowTreeDrag, crossWindowDragTargetLabel]);
  const canTrashSelectedNode =
    selectedNodeType !== null && selectedNodePath !== null && selectedNodePath.length > 0;

  const showContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, relativePath: string, isFolder: boolean) => {
      event.preventDefault();
      event.stopPropagation();

      const parentFolder = resolveParentFolderForNode(relativePath, isFolder ? "folder" : "file");
      const isRootActionTarget = relativePath.length === 0;
      const itemKind = isFolder ? "folder" : "file";

      const menuItems: RendererContextMenuItem[] = [
        {
          type: "item",
          id: "new-file",
          label: t("files.newFile"),
          onSelect: () => {
            setFileTreeContextMenu(null);
            openNewFilePrompt(parentFolder);
          },
        },
        {
          type: "item",
          id: "new-folder",
          label: t("files.newFolder"),
          onSelect: () => {
            setFileTreeContextMenu(null);
            openNewFolderPrompt(parentFolder);
          },
        },
        ...(isRootActionTarget
          ? []
          : [
              {
                type: "item" as const,
                id: "copy-item",
                label: t("files.copyItem"),
                onSelect: () => {
                  setFileTreeContextMenu(null);
                  copyFileTreeItem(relativePath, itemKind);
                },
              },
            ]),
        {
          type: "item",
          id: "paste-item",
          label: t("files.pasteItem"),
          onSelect: async () => {
            setFileTreeContextMenu(null);
            await pasteFileTreeItem(parentFolder);
          },
        },
        ...(isRootActionTarget
          ? []
          : [
              {
                type: "item" as const,
                id: "duplicate",
                label: t("files.duplicateItem"),
                onSelect: async () => {
                  await duplicateItem(relativePath);
                },
              },
              {
                type: "item" as const,
                id: "rename",
                label: t("files.renameItem"),
                onSelect: () => {
                  setFileTreeContextMenu(null);
                  openRenamePrompt(relativePath, itemKind);
                },
              },
            ]),
        {
          type: "item",
          id: "copy-path",
          label: t("files.copyPath"),
          onSelect: async () => {
            await copyPath(relativePath);
          },
        },
        {
          type: "item",
          id: "reveal",
          label: t("files.revealInFinder"),
          onSelect: async () => {
            await revealItemInDir(resolvePath(relativePath));
          },
        },
        ...(onInsertText && !isFolder
          ? [
              {
                type: "item" as const,
                id: "insert-lsp-diagnostics",
                label: t("files.insertLspDiagnostics"),
                onSelect: () => {
                  onInsertText(`/lsp diagnostics "${relativePath}"`);
                },
              },
              {
                type: "item" as const,
                id: "insert-lsp-document-symbols",
                label: t("files.insertLspDocumentSymbols"),
                onSelect: () => {
                  onInsertText(`/lsp document-symbols "${relativePath}"`);
                },
              },
            ]
          : []),
        ...(isRootActionTarget
          ? []
          : [
              {
                type: "item" as const,
                id: "delete",
                label: t("files.deleteItem"),
                tone: "danger" as const,
                onSelect: async () => {
                  setFileTreeContextMenu(null);
                  await trashItem(relativePath, isFolder);
                },
              },
            ]),
      ];

      const position = clampRendererContextMenuPosition(event.clientX, event.clientY);
      setFileTreeContextMenu({
        ...position,
        label: t("files.fileActions"),
        items: menuItems,
      });
    },
    [
      resolvePath,
      copyPath,
      trashItem,
      copyFileTreeItem,
      duplicateItem,
      pasteFileTreeItem,
      onInsertText,
      openRenamePrompt,
      openNewFilePrompt,
      openNewFolderPrompt,
      resolveParentFolderForNode,
      t,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedNodePath || !selectedNodeType) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      // Ensure the event originates within the file tree panel
      if (panelRef.current && !panelRef.current.contains(target)) {
        return;
      }

      const isMac = navigator.platform.includes("Mac");
      const primaryModifier = isMac ? event.metaKey : event.ctrlKey;

      // Cmd+Delete / Ctrl+Delete → trash
      if (primaryModifier && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        void trashItem(selectedNodePath, selectedNodeType === "folder");
        return;
      }

      // Cmd+C / Ctrl+C → copy path
      if (primaryModifier && !event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void copyPath(selectedNodePath);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodePath, selectedNodeType, trashItem, copyPath]);

  const fileTreeRowState: FileTreeRowState = {
    expandedFolders,
    loadingLazyDirectories,
    lazyDirectoryLoadErrors,
    folderGitStatusMap,
    gitStatusMap,
    mergedGitignoredDirectories,
    mergedGitignoredFiles,
    gitignoredTreeNodeMap,
    selectedNodePaths,
    selectedNodePath,
    orderedSelectedNodePaths,
  };
  const fileTreeRowHandlers: FileTreeRowHandlers = {
    setRangeSelection,
    togglePathSelection,
    setSingleSelection,
    setSelectedNodePath,
    setSelectedNodeType,
    toggleFolderExpandedState,
    loadLazyDirectoryChildren,
    openPreview,
    showContextMenu,
    resolvePath,
    broadcastCrossWindowTreeDrag,
    rebroadcastCrossWindowTreeDrag,
    onOpenFile,
    onInsertText,
  };
  const fileTreeRowRefs: FileTreeRowRefs = {
    activeCrossWindowDragPathsRef,
    lastCrossWindowDragBroadcastRef,
    dragImageCleanupRef,
  };

  return (
    <aside className="diff-panel file-tree-panel" ref={panelRef}>
      <div className="file-tree-top-zone">
        <div className="file-tree-root-row">
          <div className="file-tree-root-wrap">
            <button
              type="button"
              className={`file-tree-row is-folder is-root${selectedNodePaths.has("") ? " is-selected" : ""}${selectedNodePath === "" ? " is-primary" : ""}`}
              onClick={() => {
                setSingleSelection("", "root");
                setRootExpanded((prev) => !prev);
              }}
              onContextMenu={(event) => {
                if (!selectedNodePaths.has("")) {
                  setSingleSelection("", "root");
                } else {
                  setSelectedNodePath("");
                  setSelectedNodeType("folder");
                }
                showContextMenu(event, "", true);
              }}
            >
              <span
                className={`file-tree-chevron file-tree-root-chevron${isRootVisibleExpanded ? " is-open" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setRootExpanded((prev) => !prev);
                }}
              >
                ›
              </span>
              <span className="file-tree-icon file-tree-icon-root-special" aria-hidden>
                <TreePine size={13} />
              </span>
              <span className="file-tree-name">{workspaceRootLabel}</span>
            </button>
          </div>
          <FileTreeRootActions
            canTrashSelectedNode={canTrashSelectedNode}
            isSpecHubActive={isSpecHubActive}
            selectedParentFolder={selectedParentFolder}
            onOpenDetachedExplorer={onOpenDetachedExplorer}
            detachedInitialFilePath={detachedInitialFilePath}
            onOpenNewFile={(parentFolder) => openNewFilePrompt(parentFolder ?? "")}
            onOpenNewFolder={(parentFolder) => openNewFolderPrompt(parentFolder ?? "")}
            onRefreshFiles={onRefreshFiles}
            onTrashSelected={() => {
              if (!canTrashSelectedNode || !selectedNodePath || !selectedNodeType) {
                return;
              }
              void trashItem(selectedNodePath, selectedNodeType === "folder");
            }}
            onOpenSpecHub={onOpenSpecHub}
            showSpecHubAction={showSpecHubAction}
            showDetachedExplorerAction={showDetachedExplorerAction}
          />
        </div>
      </div>
      <div
        ref={fileTreeListRef}
        className={`file-tree-list${isRootVisibleExpanded && nodes.length > 0 ? " has-root-guide" : ""}${
          shouldVirtualizeFileTree ? " is-virtualized" : ""
        }`}
        data-file-tree-row-count={visibleFileTreeRows.length}
      >
        {showLoading ? (
          <div className="file-tree-loading-row" role="status" aria-live="polite">
            <LoaderCircle className="file-tree-loading-spinner" size={13} aria-hidden />
            <span>{t("files.loadingFiles")}</span>
          </div>
        ) : !isRootVisibleExpanded ? null : normalizedLoadError && !hasTreeEntries ? (
          <div className="file-tree-empty" title={normalizedLoadError}>
            <div>{t("files.loadFilesFailed")}</div>
            {onRefreshFiles ? (
              <button
                type="button"
                className="file-tree-lazy-retry"
                onClick={() => void onRefreshFiles()}
                title={normalizedLoadError}
              >
                {t("files.retryLoadFiles")}
              </button>
            ) : null}
          </div>
        ) : !hasTreeEntries ? (
          <div className="file-tree-empty">
            {t("files.noFilesAvailable")}
          </div>
        ) : shouldVirtualizeFileTree ? (
          <div
            className="file-tree-virtual-spacer"
            style={{ height: `${fileTreeRowVirtualizer.getTotalSize()}px` }}
          >
            {fileTreeRowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = visibleFileTreeRows[virtualRow.index];
              if (!row) {
                return null;
              }
              return (
                <div
                  key={virtualRow.key}
                  ref={fileTreeRowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="file-tree-virtual-row"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <FileTreeVirtualRow
                    row={row}
                    state={fileTreeRowState}
                    handlers={fileTreeRowHandlers}
                    refs={fileTreeRowRefs}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          nodes.map((node) => (
            <FileTreeNodeBranch
              key={node.path}
              node={node}
              depth={1}
              state={fileTreeRowState}
              handlers={fileTreeRowHandlers}
              refs={fileTreeRowRefs}
              t={t}
            />
          ))
        )}
      </div>
      {previewPath && previewAnchor
        ? createPortal(
            <FilePreviewPopover
              path={previewPath}
              absolutePath={resolvePath(previewPath)}
              content={previewContent}
              truncated={previewTruncated}
              previewKind={previewKind}
              imageSrc={previewImageSrc}
              openTargets={openTargets}
              openAppIconById={openAppIconById}
              selectedOpenAppId={selectedOpenAppId}
              onSelectOpenAppId={onSelectOpenAppId}
              selection={previewSelection}
              onSelectLine={handleSelectLine}
              onLineMouseDown={handleLineMouseDown}
              onLineMouseEnter={handleLineMouseEnter}
              onLineMouseUp={handleLineMouseUp}
              onClearSelection={() => setPreviewSelection(null)}
              onAddSelection={handleAddSelection}
              onClose={closePreview}
              selectionHints={selectionHints}
              style={{
                position: "fixed",
                top: previewAnchor.top,
                left: previewAnchor.left,
                width: 640,
                maxHeight: previewAnchor.height,
                ["--file-preview-arrow-top" as string]: `${previewAnchor.arrowTop}px`,
              }}
              isLoading={previewLoading}
              error={previewError}
            />,
            document.body,
          )
        : null}
      {fileTreeContextMenu ? (
        <RendererContextMenu
          menu={fileTreeContextMenu}
          onClose={() => setFileTreeContextMenu(null)}
          className="renderer-context-menu file-tree-context-menu"
        />
      ) : null}
      {operationNotice ? (
        <div
          className={`file-tree-operation-notice is-${operationNotice.tone}`}
          role={operationNotice.tone === "error" ? "alert" : "status"}
        >
          {operationNotice.message}
        </div>
      ) : null}
      {renamePrompt !== null && (
        <FileTreeRenamePrompt
          prompt={renamePrompt}
          draftName={renameDraftName}
          inputRef={renameInputRef}
          t={t}
          onDraftNameChange={setRenameDraftName}
          onCancel={cancelRename}
          onConfirm={() => void confirmRename()}
        />
      )}
      {newFileParent !== null && (
        <FileTreeNewFilePrompt
          parent={newFileParent}
          name={newFileName}
          inputRef={newFileInputRef}
          t={t}
          onNameChange={setNewFileName}
          onCancel={cancelNewFile}
          onConfirm={() => void confirmNewFile()}
        />
      )}
      {newFolderParent !== null && (
        <FileTreeNewFolderPrompt
          parent={newFolderParent}
          name={newFolderName}
          inputRef={newFolderInputRef}
          t={t}
          onNameChange={setNewFolderName}
          onCancel={cancelNewFolder}
          onConfirm={() => void confirmNewFolder()}
        />
      )}
    </aside>
  );
}
