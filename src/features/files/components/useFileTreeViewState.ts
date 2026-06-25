import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceDirectoryEntry } from "../../../services/tauri";
import type { RendererContextMenuState } from "../../../components/ui/RendererContextMenu";
import type { RenamePromptState } from "./FileTreePrompts";

export type FileTreeClipboardItem = {
  workspaceId: string;
  path: string;
  kind: "file" | "folder";
  name: string;
};

export type FileTreeOperationNotice = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};

export type FileTreePreviewAnchor = {
  top: number;
  left: number;
  arrowTop: number;
  height: number;
};

export type FileTreePreviewSelection = {
  start: number;
  end: number;
};

type UseFileTreeViewStateOptions = {
  workspaceId: string;
  sourceVersion: string | null;
  onRefreshFiles?: () => void;
};

export function useFileTreeViewState({
  workspaceId,
  sourceVersion,
  onRefreshFiles,
}: UseFileTreeViewStateOptions) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [rootExpanded, setRootExpanded] = useState(true);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<FileTreePreviewAnchor | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSelection, setPreviewSelection] = useState<FileTreePreviewSelection | null>(null);
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
  const sourceVersionRef = useRef<string | null>(sourceVersion);

  useEffect(() => {
    sourceVersionRef.current = sourceVersion;
  }, [sourceVersion]);

  useEffect(() => {
    return () => {
      dragImageCleanupRef.current?.();
      dragImageCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    loadedLazyDirectoriesRef.current = loadedLazyDirectories;
  }, [loadedLazyDirectories]);

  useEffect(() => {
    loadingLazyDirectoriesRef.current = loadingLazyDirectories;
  }, [loadingLazyDirectories]);

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

  const clearLazyDirectoryCache = useCallback(() => {
    setLazyFiles(new Set());
    setLazyDirectories(new Set());
    setLazyGitignoredFiles(new Set());
    setLazyGitignoredDirectories(new Set());
    setLazyLoadableDirectories(new Set());
    setLazyDirectoryMetadata(new Map());
    setLoadedLazyDirectories(new Set());
    setLoadingLazyDirectories(new Set());
    setLazyDirectoryLoadErrors(new Map());
    loadedLazyDirectoriesRef.current = new Set();
    loadingLazyDirectoriesRef.current = new Set();
  }, []);

  const refreshFileTree = useCallback(() => {
    clearLazyDirectoryCache();
    onRefreshFiles?.();
  }, [clearLazyDirectoryCache, onRefreshFiles]);

  useEffect(() => {
    closePreview();
    clearLazyDirectoryCache();
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
  }, [clearLazyDirectoryCache, closePreview, workspaceId]);

  return {
    activeCrossWindowDragPathsRef,
    clearLazyDirectoryCache,
    closePreview,
    dragAnchorLineRef,
    dragImageCleanupRef,
    dragMovedRef,
    expandedFolders,
    fileTreeClipboardItem,
    fileTreeContextMenu,
    fileTreeListRef,
    isDragSelecting,
    lastCrossWindowDragBroadcastRef,
    lazyDirectories,
    lazyDirectoryLoadErrors,
    lazyDirectoryMetadata,
    lazyFiles,
    lazyGitignoredDirectories,
    lazyGitignoredFiles,
    lazyLoadableDirectories,
    loadedLazyDirectories,
    loadedLazyDirectoriesRef,
    loadingLazyDirectories,
    loadingLazyDirectoriesRef,
    newFileInputRef,
    newFileName,
    newFileParent,
    newFolderInputRef,
    newFolderName,
    newFolderParent,
    operationNotice,
    panelRef,
    previewAnchor,
    previewContent,
    previewError,
    previewLoading,
    previewPath,
    previewSelection,
    previewTruncated,
    refreshFileTree,
    renameDraftName,
    renameInputRef,
    renamePrompt,
    rootExpanded,
    selectedNodePath,
    selectedNodePaths,
    selectedNodeType,
    selectionAnchorPathRef,
    setExpandedFolders,
    setFileTreeClipboardItem,
    setFileTreeContextMenu,
    setIsDragSelecting,
    setLazyDirectories,
    setLazyDirectoryLoadErrors,
    setLazyDirectoryMetadata,
    setLazyFiles,
    setLazyGitignoredDirectories,
    setLazyGitignoredFiles,
    setLazyLoadableDirectories,
    setLoadedLazyDirectories,
    setLoadingLazyDirectories,
    setNewFileName,
    setNewFileParent,
    setNewFolderName,
    setNewFolderParent,
    setOperationNotice,
    setPreviewAnchor,
    setPreviewContent,
    setPreviewError,
    setPreviewLoading,
    setPreviewPath,
    setPreviewSelection,
    setPreviewTruncated,
    setRenameDraftName,
    setRenamePrompt,
    setRootExpanded,
    setSelectedNodePath,
    setSelectedNodePaths,
    setSelectedNodeType,
    setSuppressedDeletedPaths,
    sourceVersionRef,
    suppressedDeletedPaths,
  };
}
