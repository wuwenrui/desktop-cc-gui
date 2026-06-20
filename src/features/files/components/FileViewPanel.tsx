import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { useTranslation } from "react-i18next";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Columns2 from "lucide-react/dist/esm/icons/columns-2";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Eye from "lucide-react/dist/esm/icons/eye";
import Code from "lucide-react/dist/esm/icons/code";
import FileSearch from "lucide-react/dist/esm/icons/file-search";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Rows2 from "lucide-react/dist/esm/icons/rows-2";
import Save from "lucide-react/dist/esm/icons/save";
import Search from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  getGitFileFullDiff,
  readLocalImageDataUrl,
  readWorkspaceFilePreview,
} from "../../../services/tauri";
import { pushErrorToast } from "../../../services/toasts";
import type { IntentCanvasCodeSelectionAnchor } from "../../intent-canvas/types";
import {
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";
import { highlightLine } from "../../../utils/syntax";
import { OpenAppMenu } from "../../app/components/OpenAppMenu";
import FileIcon from "../../../components/FileIcon";
import type { GitFileStatus, OpenAppTarget } from "../../../types";
import type {
  CodeAnnotationDraftInput,
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
} from "../../code-annotations/types";
import { isSameCodeAnnotationPath } from "../../code-annotations/utils/codeAnnotations";
import { loadCodeMirrorExtensionsForEditorLanguage } from "../utils/codemirrorLanguageExtensions";
import {
  parseLineMarkersFromDiff,
  type GitLineMarkers,
} from "../utils/gitLineMarkers";
import {
  isLikelyWindowsFsPath,
  normalizeComparablePath,
  normalizeFsPath,
  resolveFileReadTarget,
  resolveGitRootWorkspacePrefix,
  resolveGitStatusPathCandidates,
  resolveWorkspacePathCandidates,
} from "../../../utils/workspacePaths";
import { reduceExternalChangeSyncState } from "../externalChangeStateMachine";
import {
  resolveFileRenderProfile,
} from "../utils/fileRenderProfile";
import { getFileDocumentSnapshotMetrics } from "../utils/fileDocumentSnapshot";
import {
  createFileEditorTypingDiagnosticsSession,
  type FileEditorTypingDiagnosticsSession,
} from "../utils/fileEditorTypingDiagnostics";
import { loadFileViewStyles } from "../../../styles/featureStyleLoaders";
import {
  resolveDefaultFileViewMode,
  resolveFileViewSurface,
} from "../utils/fileViewSurface";
import { FileViewBody } from "./FileViewBody";
import type { FileCodeMirrorEditorHandle } from "./FileCodeMirrorEditor";
import { FileViewNavigationPanel } from "./FileViewNavigationPanel";
import { useFileDocumentState } from "../hooks/useFileDocumentState";
import { useFileExternalSync } from "../hooks/useFileExternalSync";
import { useFileNavigation } from "../hooks/useFileNavigation";
import { useFilePreviewPayload } from "../hooks/useFilePreviewPayload";
import {
  isThemeMutationAttribute,
} from "../../theme/utils/themeAppearance";
import {
  DEFAULT_FILE_RENDER_PRESSURE,
  type FileRenderPressure,
} from "../types/fileRenderPressure";
import {
  resolveFastMarkdownProfileInputs,
  resolveFastMarkdownRendererProfile,
  type FastMarkdownRendererProfileId,
} from "../../markdown/fastMarkdownRenderer";
import {
  buildDetachedFileExplorerSession,
  openNewDetachedFileExplorerWindow,
} from "../detachedFileExplorer";
import {
  EDITOR_LINE_RANGE_SYNC_DELAY_MS,
  EXTERNAL_CHANGE_POLL_INTERVAL_MS,
  formatEditorLineRangeKey,
  formatFileSize,
  hasGitLineMarkers,
  isSameEditorLineRange,
  resolveAbsolutePath,
  resolveDeclarationCodeSelectionAnchor,
  resolveEditorTheme,
  type AnnotationWidgetCallbacks,
  type EditorTheme,
} from "./fileViewPanelShared";
import { resolveFileMarkdownFastFeatureFlags } from "../utils/fileMarkdownFeatureFlags";

export { resolveEditorAnnotationWidgetOrder } from "./fileViewPanelShared";

function resetGitLineMarkersIfNeeded(markers: GitLineMarkers): GitLineMarkers {
  if (markers.added.length === 0 && markers.modified.length === 0) {
    return markers;
  }
  return { added: [], modified: [] };
}

type FileViewPanelProps = {
  workspaceId: string;
  workspaceName?: string | null;
  workspacePath: string;
  gitRoot?: string | null;
  customSpecRoot?: string | null;
  filePath: string;
  gitStatusFiles?: GitFileStatus[];
  openTabs?: string[];
  activeTabPath?: string | null;
  onActivateTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;
  onCloseAllTabs?: () => void;
  fileReferenceMode?: "path" | "none";
  onFileReferenceModeChange?: (mode: "path" | "none") => void;
  activeFileLineRange?: { startLine: number; endLine: number } | null;
  onActiveFileLineRangeChange?: (range: { startLine: number; endLine: number } | null) => void;
  onActiveCodeAnchorChange?: (anchor: IntentCanvasCodeSelectionAnchor | null) => void;
  onAssociateIntentCanvasCodeAnchor?: (anchor: IntentCanvasCodeSelectionAnchor) => Promise<void> | void;
  initialMode?: "edit" | "preview";
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  editorSplitLayout?: "vertical" | "horizontal";
  onToggleEditorSplitLayout?: () => void;
  isEditorFileMaximized?: boolean;
  onToggleEditorFileMaximized?: () => void;
  navigationTarget?: {
    path: string;
    line: number;
    column: number;
    requestId: number;
  } | null;
  highlightMarkers?: GitLineMarkers | null;
  onNavigateToLocation?: (
    path: string,
    location: { line: number; column: number },
  ) => void;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  onCreateCodeAnnotation?: (annotation: CodeAnnotationDraftInput) => void;
  onRemoveCodeAnnotation?: (annotationId: string) => void;
  codeAnnotations?: CodeAnnotationSelection[];
  headerLayout?: "stacked" | "single-row";
  onSingleRowLeadingAction?: () => void;
  singleRowLeadingDirection?: "left" | "right";
  singleRowLeadingLabel?: string;
    externalChangeMonitoringEnabled?: boolean;
    externalChangeTransportMode?: "watcher" | "polling";
    externalChangePollIntervalMs?: number;
    externalChangeApplyMode?: "auto" | "manual";
    externalChangeAutoApplyDebounceMs?: number;
    markdownPreviewSnapshotMode?: "stable" | "live";
    fileRenderPressure?: FileRenderPressure;
  saveFileShortcut?: string | null;
  findInFileShortcut?: string | null;
  onSaveSuccess?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

export function FileViewPanel({
  workspaceId,
  workspaceName = null,
  workspacePath,
  gitRoot = null,
  customSpecRoot = null,
  filePath,
  gitStatusFiles,
  openTabs,
  activeTabPath,
  onActivateTab,
  onCloseTab,
  onCloseAllTabs,
  activeFileLineRange = null,
  onActiveFileLineRangeChange,
  onActiveCodeAnchorChange,
  onAssociateIntentCanvasCodeAnchor,
  initialMode = "edit",
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  editorSplitLayout = "vertical",
  onToggleEditorSplitLayout,
  isEditorFileMaximized = false,
  onToggleEditorFileMaximized,
  navigationTarget = null,
  highlightMarkers = null,
  onNavigateToLocation,
  onClose,
  onInsertText,
  onCreateCodeAnnotation,
  onRemoveCodeAnnotation,
  codeAnnotations = [],
  headerLayout = "stacked",
  onSingleRowLeadingAction,
  singleRowLeadingDirection = "left",
  singleRowLeadingLabel,
    externalChangeMonitoringEnabled = false,
    externalChangeTransportMode = "polling",
    externalChangePollIntervalMs = EXTERNAL_CHANGE_POLL_INTERVAL_MS,
    externalChangeApplyMode = "auto",
    externalChangeAutoApplyDebounceMs = 0,
    markdownPreviewSnapshotMode = "stable",
    fileRenderPressure = DEFAULT_FILE_RENDER_PRESSURE,
  saveFileShortcut = "cmd+s",
  findInFileShortcut = "cmd+f",
  onSaveSuccess,
  onDirtyChange,
}: FileViewPanelProps) {
  const { t } = useTranslation();
  useEffect(() => {
    void loadFileViewStyles();
  }, []);
  const renderProfile = useMemo(() => resolveFileRenderProfile(filePath), [filePath]);
  const defaultMode = useMemo(
    () => resolveDefaultFileViewMode(renderProfile, initialMode),
    [initialMode, renderProfile],
  );
  const isImage = renderProfile.kind === "image";
  const skipTextRead = renderProfile.previewSourceKind !== "inline-bytes";
  const canEditDocument = renderProfile.editCapability !== "read-only";
  const [mode, setMode] = useState<"preview" | "edit">(
    () => defaultMode,
  );
  const [editorTheme, setEditorTheme] = useState<EditorTheme>(() => resolveEditorTheme());
  const [gitLineMarkers, setGitLineMarkers] = useState<GitLineMarkers>({
    added: [],
    modified: [],
  });
  const [annotationDraft, setAnnotationDraft] = useState<{
    lineRange: CodeAnnotationLineRange;
    source: "file-preview-mode" | "file-edit-mode";
    body: string;
  } | null>(null);
  const [markdownPreviewOverride, setMarkdownPreviewOverride] = useState<{
    key: string;
    content: string;
    truncated: boolean;
  } | null>(null);
  const markdownPreviewOverrideRequestRef = useRef(0);
  const [editorLocalLineRange, setEditorLocalLineRange] =
    useState<CodeAnnotationLineRange | null>(() => activeFileLineRange);
  const annotationDraftBodyRef = useRef("");
  const editorLocalLineRangeRef = useRef<CodeAnnotationLineRange | null>(
    activeFileLineRange,
  );
  const pendingEditorLineRangeRef = useRef<CodeAnnotationLineRange | null>(
    activeFileLineRange,
  );
  const editorLineRangeSyncTimerRef = useRef<number | null>(null);
  const activeCodeAnchorResolveTimerRef = useRef<number | null>(null);
  const activeCodeAnchorResolveEpochRef = useRef(0);
  const lastPublishedEditorLineRangeKeyRef = useRef(
    formatEditorLineRangeKey(activeFileLineRange),
  );
  const [activeDeclarationCodeAnchor, setActiveDeclarationCodeAnchor] =
    useState<IntentCanvasCodeSelectionAnchor | null>(null);
  const cmRef = useRef<FileCodeMirrorEditorHandle | null>(null);
  const lastReportedLineRangeRef = useRef<string>("");
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const tabContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const activeAnnotationLineRange =
    annotationDraft?.source === "file-edit-mode"
      ? annotationDraft.lineRange
      : editorLocalLineRange ?? activeFileLineRange;
  const effectiveAnnotationDraftBody = annotationDraft
    ? annotationDraftBodyRef.current || annotationDraft.body
    : "";
  const effectiveAnnotationDraft = useMemo(
    () =>
      annotationDraft
        ? {
            ...annotationDraft,
            body: effectiveAnnotationDraftBody,
          }
        : null,
    [annotationDraft, effectiveAnnotationDraftBody],
  );
  const beginAnnotationDraft = useCallback(
    (
      lineRange: CodeAnnotationLineRange,
      source: "file-preview-mode" | "file-edit-mode",
    ) => {
      annotationDraftBodyRef.current = "";
      setAnnotationDraft({
        lineRange: {
          startLine: lineRange.startLine,
          endLine: lineRange.endLine,
        },
        source,
        body: "",
      });
    },
    [],
  );
  const handleStartEditorAnnotation = useCallback(() => {
    const lineRange =
      annotationDraft?.source === "file-edit-mode"
        ? annotationDraft.lineRange
        : editorLocalLineRangeRef.current ?? activeAnnotationLineRange;
    if (!lineRange) {
      return;
    }
    beginAnnotationDraft(lineRange, "file-edit-mode");
  }, [activeAnnotationLineRange, annotationDraft, beginAnnotationDraft]);
  const handleConfirmAnnotationDraft = useCallback((bodyOverride?: string) => {
    if (!annotationDraft) {
      return;
    }
    const body = (bodyOverride ?? annotationDraftBodyRef.current ?? annotationDraft.body).trim();
    if (!body) {
      return;
    }
    onCreateCodeAnnotation?.({
      path: filePath,
      lineRange: annotationDraft.lineRange,
      body,
      source: annotationDraft.source,
    });
    annotationDraftBodyRef.current = "";
    setAnnotationDraft(null);
  }, [annotationDraft, filePath, onCreateCodeAnnotation]);
  const clearPendingEditorLineRangeSync = useCallback(() => {
    if (editorLineRangeSyncTimerRef.current !== null) {
      window.clearTimeout(editorLineRangeSyncTimerRef.current);
      editorLineRangeSyncTimerRef.current = null;
    }
  }, []);
  const clearPendingActiveCodeAnchorResolve = useCallback(() => {
    if (activeCodeAnchorResolveTimerRef.current !== null) {
      window.clearTimeout(activeCodeAnchorResolveTimerRef.current);
      activeCodeAnchorResolveTimerRef.current = null;
    }
  }, []);
  const scheduleEditorLineRangePublish = useCallback(
    (lineRange: CodeAnnotationLineRange | null) => {
      pendingEditorLineRangeRef.current = lineRange;
      clearPendingEditorLineRangeSync();
      editorLineRangeSyncTimerRef.current = window.setTimeout(() => {
        editorLineRangeSyncTimerRef.current = null;
        const pendingLineRange = pendingEditorLineRangeRef.current;
        const pendingKey = formatEditorLineRangeKey(pendingLineRange);
        if (pendingKey === lastPublishedEditorLineRangeKeyRef.current) {
          return;
        }
        lastPublishedEditorLineRangeKeyRef.current = pendingKey;
        startTransition(() => {
          setEditorLocalLineRange((current) =>
            isSameEditorLineRange(current, pendingLineRange) ? current : pendingLineRange,
          );
          onActiveFileLineRangeChange?.(pendingLineRange);
        });
      }, EDITOR_LINE_RANGE_SYNC_DELAY_MS);
    },
    [clearPendingEditorLineRangeSync, onActiveFileLineRangeChange],
  );
  const handleEditorLineRangeChange = useCallback(
    (lineRange: CodeAnnotationLineRange | null) => {
      if (isSameEditorLineRange(editorLocalLineRangeRef.current, lineRange)) {
        return;
      }
      editorLocalLineRangeRef.current = lineRange;
      scheduleEditorLineRangePublish(lineRange);
    },
    [scheduleEditorLineRangePublish],
  );
  const [fileReferenceShouldRender, setFileReferenceShouldRender] = useState(false);
  const [fileReferenceVisible, setFileReferenceVisible] = useState(false);
  const usesSingleRowHeader = headerLayout === "single-row";
  const splitResizeCleanupRef = useRef<(() => void) | null>(null);
  const pendingOpenFindPanelRef = useRef(false);
  const gitRootWorkspacePrefix = useMemo(
    () => resolveGitRootWorkspacePrefix(workspacePath, gitRoot),
    [gitRoot, workspacePath],
  );
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; path: string }>();
    if (!gitStatusFiles) {
      return map;
    }
    for (const entry of gitStatusFiles) {
      const entryPath = entry.path?.trim();
      const entryStatus = entry.status?.trim();
      if (!entryPath || !entryStatus) {
        continue;
      }
      const candidates = resolveGitStatusPathCandidates(
        workspacePath,
        gitRootWorkspacePrefix,
        entryPath,
      );
      for (const candidate of candidates) {
        if (!map.has(candidate)) {
          map.set(candidate, { status: entryStatus, path: entryPath });
        }
      }
    }
    return map;
  }, [gitRootWorkspacePrefix, gitStatusFiles, workspacePath]);
  const fileReadTarget = useMemo(
    () => resolveFileReadTarget(workspacePath, filePath, customSpecRoot),
    [workspacePath, filePath, customSpecRoot],
  );
  const workspaceRelativeFilePath = fileReadTarget.workspaceRelativePath;
  const resolvedWorkspaceName = useMemo(() => {
    const explicitName = workspaceName?.trim();
    if (explicitName) {
      return explicitName;
    }
    const pathSegments = normalizeFsPath(workspacePath).split("/").filter(Boolean);
    return pathSegments[pathSegments.length - 1] ?? (workspacePath.trim() || workspaceId);
  }, [workspaceId, workspaceName, workspacePath]);
  const matchedGitStatus = useMemo(() => {
    const fileCandidates = new Set<string>([
      ...resolveWorkspacePathCandidates(workspacePath, workspaceRelativeFilePath),
      ...resolveWorkspacePathCandidates(workspacePath, filePath),
    ]);
    for (const candidate of fileCandidates) {
      const matched = gitStatusMap.get(candidate);
      if (matched) {
        return matched;
      }
    }
    return null;
  }, [
    filePath,
    gitStatusMap,
    workspacePath,
    workspaceRelativeFilePath,
  ]);
  const fileGitStatus = matchedGitStatus?.status ?? null;
  const gitDiffTargetPath = matchedGitStatus?.path ?? workspaceRelativeFilePath;
  const resolveMatchedGitStatusByPath = useCallback(
    (path: string) => {
      for (const candidate of resolveWorkspacePathCandidates(workspacePath, path)) {
        const matched = gitStatusMap.get(candidate);
        if (matched) {
          return matched;
        }
      }
      return null;
    },
    [gitStatusMap, workspacePath],
  );
  const fileGitStatusClass = fileGitStatus ? `git-${fileGitStatus.toLowerCase()}` : "";
  const absolutePath = useMemo(
    () =>
      fileReadTarget.domain === "workspace"
        ? resolveAbsolutePath(workspacePath, workspaceRelativeFilePath)
        : fileReadTarget.normalizedInputPath,
    [workspacePath, workspaceRelativeFilePath, fileReadTarget],
  );
  const caseInsensitivePathCompare = useMemo(
    () => isLikelyWindowsFsPath(normalizeFsPath(workspacePath)),
    [workspacePath],
  );
  const isSameWorkspacePath = useCallback(
    (leftPath: string, rightPath: string) =>
      normalizeComparablePath(leftPath, caseInsensitivePathCompare) ===
      normalizeComparablePath(rightPath, caseInsensitivePathCompare),
    [caseInsensitivePathCompare],
  );
  const {
    content,
    setContent,
    cacheDraftContent,
    documentSnapshot,
    replaceDocumentSnapshot,
    error,
    isDirty,
    isLoading,
    isSaving,
    savedContentRef,
    latestIsDirtyRef,
    externalDiskSnapshotRef,
    truncated,
    handleSave: handleDocumentSave,
  } = useFileDocumentState({
    workspaceId,
    customSpecRoot,
    workspaceRelativeFilePath,
    fileReadTarget,
    skipTextRead,
    externalAbsoluteReadOnlyMessage: t("files.externalAbsoluteReadOnly"),
  });
  const currentFileRenderToken = useMemo(
    () =>
      [
        workspaceId,
        workspaceRelativeFilePath,
        documentSnapshot.snapshotVersion,
      ].join("\u001f"),
    [documentSnapshot.snapshotVersion, workspaceId, workspaceRelativeFilePath],
  );
  const latestFileRenderTokenRef = useRef(currentFileRenderToken);
  latestFileRenderTokenRef.current = currentFileRenderToken;
  const editorDraftContentRef = useRef(content);
  const [editorDraftDirty, setEditorDraftDirty] = useState(false);
  const effectiveIsDirty = isDirty || editorDraftDirty;
  latestIsDirtyRef.current = effectiveIsDirty;
  const typingDiagnosticsRef = useRef<FileEditorTypingDiagnosticsSession>(
    createFileEditorTypingDiagnosticsSession({
      workspaceId,
      filePath,
      fileKind: renderProfile.kind,
      byteLength: null,
      lineCount: null,
    }),
  );

  useEffect(() => {
    typingDiagnosticsRef.current = createFileEditorTypingDiagnosticsSession({
      workspaceId,
      filePath,
      fileKind: renderProfile.kind,
      byteLength: null,
      lineCount: null,
    });
  }, [filePath, renderProfile.kind, workspaceId]);

  useEffect(() => {
    editorDraftContentRef.current = content;
    setEditorDraftDirty(false);
  }, [content]);

  const handleEditorContentDraftChange = useCallback(
    (nextContent: string) => {
      editorDraftContentRef.current = nextContent;
      if (!isLoading) {
        cacheDraftContent(nextContent);
      }
      const nextIsDirty = nextContent !== savedContentRef.current;
      latestIsDirtyRef.current = nextIsDirty;
      setEditorDraftDirty((current) => (current === nextIsDirty ? current : nextIsDirty));
    },
    [cacheDraftContent, isLoading, latestIsDirtyRef, savedContentRef],
  );

  const flushEditorDraftToDocument = useCallback(() => {
    setContent(editorDraftContentRef.current);
  }, [setContent]);

  const handleEditorContentPublished = useCallback(() => {
    typingDiagnosticsRef.current.recordPublishedUpdate();
  }, []);

  const handleEditorTypingInput = useCallback((durationMs: number) => {
    typingDiagnosticsRef.current.recordInput(durationMs);
  }, []);

  const activeDeclarationLineRange = editorLocalLineRange ?? activeFileLineRange;

  useEffect(() => {
    const resolveEpoch = activeCodeAnchorResolveEpochRef.current + 1;
    activeCodeAnchorResolveEpochRef.current = resolveEpoch;
    clearPendingActiveCodeAnchorResolve();

    if (!activeDeclarationLineRange) {
      startTransition(() => {
        setActiveDeclarationCodeAnchor(null);
      });
      return;
    }

    activeCodeAnchorResolveTimerRef.current = window.setTimeout(() => {
      activeCodeAnchorResolveTimerRef.current = null;
      if (activeCodeAnchorResolveEpochRef.current !== resolveEpoch) {
        return;
      }
      const nextAnchor = resolveDeclarationCodeSelectionAnchor({
        filePath,
        content: editorDraftContentRef.current,
        lineRange: activeDeclarationLineRange,
      });
      startTransition(() => {
        setActiveDeclarationCodeAnchor(nextAnchor);
      });
    }, EDITOR_LINE_RANGE_SYNC_DELAY_MS);

    return clearPendingActiveCodeAnchorResolve;
  }, [
    activeDeclarationLineRange,
    clearPendingActiveCodeAnchorResolve,
    filePath,
  ]);

  useEffect(() => {
    onActiveCodeAnchorChange?.(activeDeclarationCodeAnchor);
  }, [
    activeDeclarationCodeAnchor,
    onActiveCodeAnchorChange,
  ]);

  const handleAssociateIntentCanvasCodeAnchor = useCallback(() => {
    if (!activeDeclarationCodeAnchor) {
      pushErrorToast({
        title: t("files.associateIntentCanvasUnavailableTitle"),
        message: t("files.associateIntentCanvasUnavailable"),
        variant: "info",
        durationMs: 4200,
      });
      return;
    }
    onAssociateIntentCanvasCodeAnchor?.(activeDeclarationCodeAnchor);
  }, [activeDeclarationCodeAnchor, onAssociateIntentCanvasCodeAnchor, t]);

  const {
    externalChangeConflict,
    externalPendingRefresh,
    externalCompareOpen,
    externalAutoSyncAt,
    externalChangeSyncState,
    handleExternalReloadFromDisk,
    handleExternalApplyPendingRefresh,
    handleExternalKeepLocal,
    handleExternalToggleCompare,
    setExternalChangeSyncState,
    setExternalChangeConflict,
    setExternalPendingRefresh,
    setExternalCompareOpen,
    setExternalAutoSyncAt,
  } = useFileExternalSync({
    filePath,
    workspaceId,
    workspaceRelativeFilePath,
    fileReadTargetDomain: fileReadTarget.domain,
    externalChangeMonitoringEnabled,
    externalChangeTransportMode,
    externalChangePollIntervalMs,
    externalChangeApplyMode,
    externalChangeAutoApplyDebounceMs,
    isBinary: skipTextRead,
    isDirty: effectiveIsDirty,
    isLoading,
    caseInsensitivePathCompare,
    replaceDocumentSnapshot,
    previewSnapshotVersion: documentSnapshot.snapshotVersion,
    fileRenderPressure,
    savedContentRef,
    latestIsDirtyRef,
    externalDiskSnapshotRef,
    autoSyncedMessage: t("files.externalChangeAutoSynced"),
  });
  const handleSave = useCallback(async () => {
    flushEditorDraftToDocument();
    const saved = await handleDocumentSave();
    if (!saved) {
      return;
    }
    typingDiagnosticsRef.current.recordTauriFileWrite();
    setEditorDraftDirty(false);
    setExternalChangeSyncState((current) =>
      reduceExternalChangeSyncState(current, { type: "file-loaded" }),
    );
    setExternalChangeConflict(null);
    setExternalPendingRefresh(null);
    setExternalCompareOpen(false);
    setExternalAutoSyncAt(null);
    onSaveSuccess?.();
  }, [
    flushEditorDraftToDocument,
    handleDocumentSave,
    onSaveSuccess,
    setExternalChangeConflict,
    setExternalPendingRefresh,
    setExternalChangeSyncState,
    setExternalCompareOpen,
    setExternalAutoSyncAt,
  ]);
  const {
    isDefinitionLoading,
    isReferencesLoading,
    navigationError,
    definitionCandidates,
    setDefinitionCandidates,
    referenceResults,
    setReferenceResults,
    navigateToLocation,
    runDefinitionFromCursor,
    runReferencesFromCursor,
    resolveDefinitionAtOffset,
    openFindPanelInEditor,
    toggleFindPanelInEditor,
  } = useFileNavigation({
    workspaceId,
    workspacePath,
    filePath,
    absolutePath,
    caseInsensitivePathCompare,
    isSameWorkspacePath,
    navigationTarget,
    isLoading,
    t,
    onNavigateToLocation,
    setMode,
    cmRef,
  });
  const hasExplicitHighlightMarkers = useMemo(
    () => hasGitLineMarkers(highlightMarkers),
    [highlightMarkers],
  );
  const effectiveGitLineMarkers = useMemo(
    () => (hasExplicitHighlightMarkers ? highlightMarkers! : gitLineMarkers),
    [hasExplicitHighlightMarkers, highlightMarkers, gitLineMarkers],
  );
  const gitAddedLineNumberSet = useMemo(
    () => new Set(effectiveGitLineMarkers.added),
    [effectiveGitLineMarkers.added],
  );
  const gitModifiedLineNumberSet = useMemo(
    () => new Set(effectiveGitLineMarkers.modified),
    [effectiveGitLineMarkers.modified],
  );

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

  const [imageInfo, setImageInfo] = useState<{
    width: number;
    height: number;
    sizeBytes: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImageSrc(null);
    setImageInfo(null);
    setImageLoadError(null);
    if (!isImage) return;

    const fallbackToAssetUrl = () => {
      try {
        return convertFileSrc(absolutePath);
      } catch {
        return null;
      }
    };

    readLocalImageDataUrl(workspaceId, absolutePath)
      .then((dataUrl) => {
        if (cancelled) return;
        setImageSrc(dataUrl ?? fallbackToAssetUrl());
      })
      .catch(() => {
        if (cancelled) return;
        setImageSrc(fallbackToAssetUrl());
      });

    return () => {
      cancelled = true;
    };
  }, [absolutePath, isImage, workspaceId]);

  useEffect(() => {
    setImageInfo(null);
    if (!imageSrc) return;
    let cancelled = false;
    fetch(imageSrc)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to read image bytes: ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          setImageInfo((prev) =>
            prev
              ? { ...prev, sizeBytes: blob.size }
              : { width: 0, height: 0, sizeBytes: blob.size },
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageInfo(null);
        }
      });
    return () => { cancelled = true; };
  }, [imageSrc]);

  const handleImageLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImageLoadError(null);
      setImageInfo((prev) => ({
        width: img.naturalWidth,
        height: img.naturalHeight,
        sizeBytes: prev?.sizeBytes ?? null,
      }));
    },
    [],
  );
  const handleImageError = useCallback(() => {
    setImageInfo(null);
    setImageLoadError(t("files.imagePreviewLoadFailed"));
  }, [t]);

  useEffect(() => {
    const normalizedStatus = (fileGitStatus ?? "").toUpperCase();
    if (hasExplicitHighlightMarkers) {
      setGitLineMarkers(resetGitLineMarkersIfNeeded);
      return;
    }
    if (fileReadTarget.domain !== "workspace") {
      setGitLineMarkers(resetGitLineMarkersIfNeeded);
      return;
    }
    if (!normalizedStatus || normalizedStatus === "D" || skipTextRead) {
      setGitLineMarkers(resetGitLineMarkersIfNeeded);
      return;
    }

    let cancelled = false;
    const requestRenderToken = latestFileRenderTokenRef.current;
    getGitFileFullDiff(workspaceId, gitDiffTargetPath)
      .then((diff) => {
        if (cancelled || latestFileRenderTokenRef.current !== requestRenderToken) {
          return;
        }
        setGitLineMarkers(parseLineMarkersFromDiff(diff));
      })
      .catch(() => {
        if (!cancelled && latestFileRenderTokenRef.current === requestRenderToken) {
          setGitLineMarkers(resetGitLineMarkersIfNeeded);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    workspaceId,
    gitDiffTargetPath,
    fileGitStatus,
    fileReadTarget.domain,
    hasExplicitHighlightMarkers,
    skipTextRead,
  ]);

  useEffect(() => () => clearPendingEditorLineRangeSync(), [
    clearPendingEditorLineRangeSync,
  ]);
  useEffect(() => () => clearPendingActiveCodeAnchorResolve(), [
    clearPendingActiveCodeAnchorResolve,
  ]);

  useEffect(() => {
    if (editorLocalLineRangeRef.current !== null || activeFileLineRange === null) {
      return;
    }
    editorLocalLineRangeRef.current = activeFileLineRange;
    pendingEditorLineRangeRef.current = activeFileLineRange;
    lastPublishedEditorLineRangeKeyRef.current =
      formatEditorLineRangeKey(activeFileLineRange);
    setEditorLocalLineRange(activeFileLineRange);
  }, [activeFileLineRange]);

  // Reset mode when file changes
  useEffect(() => {
    pendingOpenFindPanelRef.current = false;
    setMode(defaultMode);
    clearPendingEditorLineRangeSync();
    clearPendingActiveCodeAnchorResolve();
    activeCodeAnchorResolveEpochRef.current += 1;
    editorLocalLineRangeRef.current = null;
    pendingEditorLineRangeRef.current = null;
    lastPublishedEditorLineRangeKeyRef.current = "none";
    setEditorLocalLineRange(null);
    setActiveDeclarationCodeAnchor(null);
    onActiveFileLineRangeChange?.(null);
    lastReportedLineRangeRef.current = "";
  }, [
    clearPendingEditorLineRangeSync,
    clearPendingActiveCodeAnchorResolve,
    defaultMode,
    filePath,
    onActiveFileLineRangeChange,
  ]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
      return;
    }
    const updateTheme = () => {
      setEditorTheme((prev) => {
        const next = resolveEditorTheme();
        return prev === next ? prev : next;
      });
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (isThemeMutationAttribute(mutation.attributeName)) {
          updateTheme();
          return;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    const media =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: light)")
        : null;
    const handleMediaChange = () => updateTheme();
    if (media?.addEventListener) {
      media.addEventListener("change", handleMediaChange);
    } else if (media?.addListener) {
      media.addListener(handleMediaChange);
    }
    return () => {
      observer.disconnect();
      if (media?.removeEventListener) {
        media.removeEventListener("change", handleMediaChange);
      } else if (media?.removeListener) {
        media.removeListener(handleMediaChange);
      }
    };
  }, []);

  useEffect(() => {
    onDirtyChange?.(effectiveIsDirty);
  }, [effectiveIsDirty, onDirtyChange]);

  // Auto-focus CodeMirror when entering edit mode
  useEffect(() => {
    if (mode === "edit" && !isLoading && !truncated) {
      requestAnimationFrame(() => {
        cmRef.current?.view?.focus();
      });
    }
  }, [mode, isLoading, truncated]);

  const languageExtensionRequestRef = useRef(0);
  const [languageExtensions, setLanguageExtensions] =
    useState<ReactCodeMirrorProps["extensions"]>([]);

  useEffect(() => {
    const requestId = languageExtensionRequestRef.current + 1;
    languageExtensionRequestRef.current = requestId;
    if (mode !== "edit" || !renderProfile.editorLanguage) {
      setLanguageExtensions([]);
      return;
    }
    loadCodeMirrorExtensionsForEditorLanguage(renderProfile.editorLanguage)
      .then((extensions) => {
        if (languageExtensionRequestRef.current === requestId) {
          setLanguageExtensions(extensions);
        }
      })
      .catch((error) => {
        console.error("[file-view] failed to load CodeMirror language extension:", error);
        if (languageExtensionRequestRef.current === requestId) {
          setLanguageExtensions([]);
        }
      });
  }, [mode, renderProfile.editorLanguage]);

  // Keyboard shortcut: Cmd+S / Ctrl+S (works in any mode, including preview)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }
      if (matchesShortcutForPlatform(event, saveFileShortcut)) {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSave, saveFileShortcut]);

  // Handle close with unsaved changes
  const handleClose = useCallback(() => {
    if (effectiveIsDirty) {
      const confirmed = window.confirm(t("files.discardChangesMessage"));
      if (!confirmed) return;
    }
    onClose();
  }, [effectiveIsDirty, onClose, t]);

  // Switch to edit mode
  const handleEnterEdit = useCallback(() => {
    if (truncated || !canEditDocument) return;
    setMode("edit");
    requestAnimationFrame(() => {
      cmRef.current?.view?.focus();
    });
  }, [canEditDocument, truncated]);

  // Switch to preview mode
  const handleEnterPreview = useCallback(() => {
    flushEditorDraftToDocument();
    setMode("preview");
    clearPendingEditorLineRangeSync();
    editorLocalLineRangeRef.current = null;
    pendingEditorLineRangeRef.current = null;
    lastPublishedEditorLineRangeKeyRef.current = "none";
    setEditorLocalLineRange(null);
    onActiveFileLineRangeChange?.(null);
    lastReportedLineRangeRef.current = "";
  }, [
    clearPendingEditorLineRangeSync,
    flushEditorDraftToDocument,
    onActiveFileLineRangeChange,
  ]);

  const handleOpenFindPanel = useCallback(() => {
    if (skipTextRead || truncated) {
      return;
    }
    pendingOpenFindPanelRef.current = true;
    if (mode !== "edit") {
      setMode("edit");
      return;
    }
    if (toggleFindPanelInEditor()) {
      pendingOpenFindPanelRef.current = false;
    }
  }, [mode, skipTextRead, toggleFindPanelInEditor, truncated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!matchesShortcutForPlatform(event, findInFileShortcut)) {
        return;
      }
      const panelRoot = panelRootRef.current;
      const target = event.target;
      if (!panelRoot || !(target instanceof Node) || !panelRoot.contains(target)) {
        return;
      }
      if (isEditableShortcutTarget(target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handleOpenFindPanel();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [findInFileShortcut, handleOpenFindPanel]);

  useEffect(() => {
    if (!pendingOpenFindPanelRef.current) {
      return;
    }
    if (mode !== "edit" || isLoading || truncated) {
      return;
    }
    let rafId = 0;
    let attemptCount = 0;
    const attemptOpen = () => {
      attemptCount += 1;
      if (openFindPanelInEditor()) {
        pendingOpenFindPanelRef.current = false;
        return;
      }
      if (attemptCount < 10) {
        rafId = window.requestAnimationFrame(attemptOpen);
      }
    };
    rafId = window.requestAnimationFrame(attemptOpen);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isLoading, mode, openFindPanelInEditor, truncated]);

  useEffect(() => {
    const shouldLoadPreviewOverride =
      mode === "preview" &&
      truncated &&
      renderProfile.kind === "markdown" &&
      fileReadTarget.domain === "workspace";
    const overrideKey = `${workspaceId}:${workspaceRelativeFilePath}`;
    if (!shouldLoadPreviewOverride) {
      setMarkdownPreviewOverride(null);
      return;
    }

    let cancelled = false;
    const requestRenderToken = latestFileRenderTokenRef.current;
    markdownPreviewOverrideRequestRef.current += 1;
    const requestId = markdownPreviewOverrideRequestRef.current;
    readWorkspaceFilePreview(workspaceId, workspaceRelativeFilePath)
      .then((response) => {
        if (
          cancelled ||
          requestId !== markdownPreviewOverrideRequestRef.current ||
          latestFileRenderTokenRef.current !== requestRenderToken
        ) {
          return;
        }
        setMarkdownPreviewOverride({
          key: overrideKey,
          content: response.content ?? "",
          truncated: Boolean(response.truncated),
        });
      })
      .catch(() => {
        if (
          cancelled ||
          requestId !== markdownPreviewOverrideRequestRef.current ||
          latestFileRenderTokenRef.current !== requestRenderToken
        ) {
          return;
        }
        setMarkdownPreviewOverride(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    fileReadTarget.domain,
    mode,
    renderProfile.kind,
    truncated,
    workspaceId,
    workspaceRelativeFilePath,
  ]);

  const effectiveMarkdownPreviewContent = markdownPreviewOverride?.content ?? content;

  // Syntax highlighted lines for code preview
  const previewMetrics = useMemo(() => {
    if (
      mode === "preview" &&
      renderProfile.kind === "markdown" &&
      markdownPreviewOverride?.content
    ) {
      return {
        byteLength: 0,
        lineCount: 0,
        truncated: false,
      };
    }
    return getFileDocumentSnapshotMetrics(documentSnapshot);
  }, [documentSnapshot, markdownPreviewOverride, mode, renderProfile.kind]);
  const viewSurface = useMemo(
    () => resolveFileViewSurface(renderProfile, mode, previewMetrics),
    [mode, previewMetrics, renderProfile],
  );
  const markdownFastFeatureFlags = useMemo(resolveFileMarkdownFastFeatureFlags, []);
  const markdownRendererProfile = useMemo<FastMarkdownRendererProfileId | undefined>(() => {
    if (viewSurface.kind !== "markdown-preview") {
      return undefined;
    }
    return resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: effectiveMarkdownPreviewContent,
        featureFlags: markdownFastFeatureFlags,
      }),
    );
  }, [effectiveMarkdownPreviewContent, markdownFastFeatureFlags, viewSurface.kind]);
  const previewPayloadEnabled =
    mode === "preview" &&
    (viewSurface.kind === "pdf-preview" ||
      viewSurface.kind === "tabular-preview" ||
      viewSurface.kind === "document-preview");
  const {
    payload: previewPayload,
    isLoading: previewPayloadLoading,
    error: previewPayloadError,
  } = useFilePreviewPayload({
    workspaceId,
    customSpecRoot,
    fileReadTarget,
    absolutePath,
    renderProfile,
    content,
    truncated,
    enabled: previewPayloadEnabled,
  });
    const previewLanguage = renderProfile.previewLanguage;
    const shouldBuildCodePreviewLines =
      viewSurface.kind === "code-preview" && documentSnapshot.lineCount <= 1_000;
    const highlightedPreviewLanguage = useMemo(
      () => (shouldBuildCodePreviewLines && !viewSurface.useLowCostPreview
        ? previewLanguage
        : null),
      [previewLanguage, shouldBuildCodePreviewLines, viewSurface.useLowCostPreview],
    );
    const lines = useMemo(
      () =>
        shouldBuildCodePreviewLines
          ? documentSnapshot.getLines(0, documentSnapshot.lineCount)
          : [],
      [documentSnapshot, shouldBuildCodePreviewLines],
    );
  const visibleCodeAnnotations = useMemo(
    () =>
      codeAnnotations.filter((annotation) =>
        isSameCodeAnnotationPath(annotation.path, filePath),
      ),
    [codeAnnotations, filePath],
  );
  const highlightedLines = useMemo(
    () =>
      lines.map((line) => {
        const html = highlightLine(line, highlightedPreviewLanguage);
        return html || "&nbsp;";
      }),
    [highlightedPreviewLanguage, lines],
  );
  const annotationWidgetLabels = useMemo(
    () => ({
      title: t("files.annotationDraft"),
      remove: t("files.annotationRemove"),
      placeholder: t("files.annotationPlaceholder"),
      cancel: t("common.cancel"),
      submit: t("files.annotationSubmit"),
    }),
    [t],
  );
  const annotationWidgetCallbacks = useMemo<AnnotationWidgetCallbacks>(
    () => ({
      onDraftCancel: () => {
        annotationDraftBodyRef.current = "";
        setAnnotationDraft(null);
      },
      onDraftConfirm: handleConfirmAnnotationDraft,
      onRemoveAnnotation: onRemoveCodeAnnotation,
    }),
    [handleConfirmAnnotationDraft, onRemoveCodeAnnotation],
  );
  const editorCodeAnnotations = useMemo(
    () =>
      visibleCodeAnnotations.filter(
        (annotation) => annotation.source === "file-edit-mode",
      ),
    [visibleCodeAnnotations],
  );
  const editorAnnotationDraft =
    effectiveAnnotationDraft?.source === "file-edit-mode"
      ? effectiveAnnotationDraft
      : null;

  const visibleTabs = openTabs && openTabs.length > 0 ? openTabs : [filePath];
  const canCloseAllTabs = Boolean(onCloseAllTabs && visibleTabs.length > 0);
  const visibleActiveFileLineRange = editorLocalLineRange ?? activeFileLineRange;
  const activeFileLineLabel = visibleActiveFileLineRange
    ? visibleActiveFileLineRange.startLine === visibleActiveFileLineRange.endLine
      ? `L${visibleActiveFileLineRange.startLine}`
      : `L${visibleActiveFileLineRange.startLine}-L${visibleActiveFileLineRange.endLine}`
    : null;

  useEffect(() => {
    if (activeFileLineLabel) {
      setFileReferenceShouldRender(true);
      setFileReferenceVisible(true);
      return;
    }
    if (!fileReferenceShouldRender) {
      return;
    }
    setFileReferenceVisible(false);
    const timerId = window.setTimeout(() => {
      setFileReferenceShouldRender(false);
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [activeFileLineLabel, fileReferenceShouldRender]);

  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const openTabContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      if (!canCloseAllTabs) {
        return;
      }
      event.preventDefault();
      const container = tabsContainerRef.current;
      const containerRect = container?.getBoundingClientRect();
      const panelRoot = panelRootRef.current;
      const panelRootRect = panelRoot?.getBoundingClientRect();
      if (!container || !containerRect || !panelRoot || !panelRootRect) {
        return;
      }
      const menuWidth = 156;
      const menuHeight = 44;
      const relativeX = event.clientX - panelRootRect.left + 8;
      const minX = 8;
      const maxX = Math.max(minX, panelRoot.clientWidth - menuWidth - 8);
      const clampedX = Math.min(
        Math.max(minX, relativeX),
        maxX,
      );
      const baseY = containerRect.bottom - panelRootRect.top + 6;
      const minY = 8;
      const maxY = Math.max(minY, panelRoot.clientHeight - menuHeight - 8);
      const clampedY = Math.min(Math.max(minY, baseY), maxY);
      setTabContextMenu({
        visible: true,
        x: clampedX,
        y: clampedY,
      });
    },
    [canCloseAllTabs],
  );

  const handleCloseAllTabs = useCallback(() => {
    onCloseAllTabs?.();
    closeTabContextMenu();
  }, [closeTabContextMenu, onCloseAllTabs]);

  const handleOpenDetachedTab = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, tabPath: string) => {
      event.preventDefault();
      event.stopPropagation();
      void openNewDetachedFileExplorerWindow(
        buildDetachedFileExplorerSession({
          workspaceId,
          workspaceName: resolvedWorkspaceName,
          workspacePath,
          gitRoot,
          initialFilePath: tabPath,
          defaultSidebarCollapsed: true,
        }),
      ).catch((error) => {
        pushErrorToast({
          title: t("files.openDetachedTab"),
          message: error instanceof Error ? error.message : String(error),
        });
      });
    },
    [gitRoot, resolvedWorkspaceName, t, workspaceId, workspacePath],
  );

  useEffect(() => {
    if (!tabContextMenu.visible) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        closeTabContextMenu();
        return;
      }
      if (tabContextMenuRef.current?.contains(target)) {
        return;
      }
      closeTabContextMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTabContextMenu();
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeTabContextMenu, tabContextMenu.visible]);

  useEffect(() => {
    return () => {
      splitResizeCleanupRef.current?.();
      splitResizeCleanupRef.current = null;
    };
  }, []);

  const handleFooterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button,a,input,textarea,select,[role='button'],[role='menuitem']",
        )
      ) {
        return;
      }
      const footer = event.currentTarget;
      const splitRoot = footer.closest(".content.is-editor-split-vertical") as HTMLElement | null;
      if (!splitRoot) {
        return;
      }
      const editorLayer = splitRoot.querySelector(
        ".content-layer--editor",
      ) as HTMLElement | null;
      const chatLayer = splitRoot.querySelector(
        ".content-layer--editor-companion",
      ) as HTMLElement | null;
      if (!editorLayer || !chatLayer) {
        return;
      }
      const editorRect = editorLayer.getBoundingClientRect();
      const chatRect = chatLayer.getBoundingClientRect();
      const totalHeight = editorRect.height + chatRect.height;
      if (totalHeight <= 0) {
        return;
      }

      event.preventDefault();

      const startY = event.clientY;
      const startEditorHeight = editorRect.height;
      const minEditorHeight = Math.max(140, totalHeight * 0.28);
      const maxEditorHeight = Math.min(totalHeight - 120, totalHeight * 0.82);
      if (maxEditorHeight <= minEditorHeight) {
        return;
      }

      document.body.classList.add("editor-split-resizing");

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        document.body.classList.remove("editor-split-resizing");
        splitResizeCleanupRef.current = null;
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const nextHeight = Math.min(
          maxEditorHeight,
          Math.max(minEditorHeight, startEditorHeight + deltaY),
        );
        const nextRatio = (nextHeight / totalHeight) * 100;
        splitRoot.style.setProperty("--editor-split-ratio", nextRatio.toFixed(2));
      };

      const handlePointerUp = () => {
        cleanup();
      };

      splitResizeCleanupRef.current?.();
      splitResizeCleanupRef.current = cleanup;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [],
  );

  // ── Topbar ──
  const renderTopbarActions = (className = "fvp-topbar-right") => (
    <div className={className}>
      {canEditDocument && (
        <>
          {mode === "preview" ? (
            <div className="fvp-action-group fvp-preview-tools" role="group">
              <button
                type="button"
                className="fvp-action-btn"
                onClick={handleEnterEdit}
                disabled={truncated || !canEditDocument}
                title={truncated ? t("files.fileTooLarge") : t("files.edit")}
              >
                <Pencil size={14} aria-hidden />
                <span>{t("files.edit")}</span>
              </button>
            </div>
          ) : (
            <div className="fvp-action-group" role="group">
              {onAssociateIntentCanvasCodeAnchor ? (
                <button
                  type="button"
                  className={`ghost fvp-action-btn fvp-intent-canvas-anchor-btn ${
                    activeDeclarationCodeAnchor ? "is-active" : "is-empty"
                  }`}
                  onClick={handleAssociateIntentCanvasCodeAnchor}
                  title={
                    activeDeclarationCodeAnchor
                      ? t("files.associateIntentCanvasTitle", {
                          symbol: activeDeclarationCodeAnchor.symbolName,
                        })
                      : t("files.associateIntentCanvasUnavailable")
                  }
                >
                  <ExternalLink size={14} aria-hidden />
                  <span>{t("files.associateIntentCanvas")}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="ghost fvp-action-btn"
                onClick={runDefinitionFromCursor}
                aria-busy={isDefinitionLoading}
                title={t("files.gotoDefinition")}
              >
                <Code size={14} aria-hidden />
                <span>
                  {isDefinitionLoading
                    ? t("files.navigating")
                    : t("files.gotoDefinition")}
                </span>
              </button>
              <button
                type="button"
                className="ghost fvp-action-btn"
                onClick={runReferencesFromCursor}
                aria-busy={isReferencesLoading}
                title={t("files.findReferences")}
              >
                <Search size={14} aria-hidden />
                <span>
                  {isReferencesLoading
                    ? t("files.searchingReferences")
                    : t("files.findReferences")}
                </span>
              </button>
              <button
                type="button"
                className="ghost fvp-action-btn"
                onClick={handleEnterPreview}
              >
                <Eye size={14} aria-hidden />
                <span>{t("files.preview")}</span>
              </button>
              <button
                type="button"
                className={`primary fvp-action-btn fvp-save-btn ${effectiveIsDirty ? "" : "is-saved"}`}
                onClick={handleSave}
                disabled={!effectiveIsDirty || isSaving}
              >
                <Save size={14} aria-hidden />
                <span>{isSaving ? t("files.saving") : effectiveIsDirty ? t("files.save") : t("files.saved")}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderTopbar = () => (
    <div className="fvp-topbar">
      <div className="fvp-topbar-left">
        <button
          type="button"
          className="icon-button fvp-back"
          onClick={handleClose}
          aria-label={t("files.backToChat")}
          title={t("files.backToChat")}
        >
          <ArrowLeft size={16} aria-hidden />
        </button>
        <span
          className={`fvp-filepath ${fileGitStatusClass}`.trim()}
          title={filePath}
        >
          {filePath}
        </span>
        {effectiveIsDirty && <span className="fvp-dirty-dot" aria-label={t("files.unsavedChanges")} />}
        {truncated && <span className="fvp-truncated">{t("files.truncated")}</span>}
      </div>
      {renderTopbarActions()}
    </div>
  );

    const renderExternalChangeNotice = () => {
      if (externalChangeSyncState === "in-sync") {
        return null;
      }
      if (externalPendingRefresh) {
        return (
          <div className="fvp-external-change-banner is-pending" role="status" aria-live="polite">
            <div className="fvp-external-change-banner-copy">
              <strong>{t("files.externalChangePendingTitle")}</strong>
              <span>
                {t("files.externalChangePendingBody", {
                  count: externalPendingRefresh.updateCount,
                })}
              </span>
            </div>
            <div className="fvp-external-change-banner-actions">
              <button
                type="button"
                className="ghost fvp-action-btn"
                onClick={handleExternalToggleCompare}
              >
                {externalCompareOpen ? t("files.externalChangeHideCompare") : t("files.externalChangeCompare")}
              </button>
              <button
                type="button"
                className="ghost fvp-action-btn"
                onClick={handleExternalKeepLocal}
              >
                {t("files.externalChangeKeepCurrent")}
              </button>
              <button
                type="button"
                className="primary fvp-action-btn"
                onClick={handleExternalApplyPendingRefresh}
              >
                {t("files.externalChangeRefreshPreview")}
              </button>
            </div>
          </div>
        );
      }
      if (externalChangeSyncState !== "external-changed-dirty" || !externalChangeConflict) {
        return (
        <div className="fvp-external-change-banner is-auto-sync" role="status" aria-live="polite">
          {t("files.externalChangeAutoSynced")}
        </div>
      );
    }
    return (
      <div className="fvp-external-change-banner is-conflict" role="status" aria-live="polite">
        <div className="fvp-external-change-banner-copy">
          <strong>{t("files.externalChangeConflictTitle")}</strong>
          <span>
            {t("files.externalChangeConflictBody", {
              count: externalChangeConflict.updateCount,
            })}
          </span>
        </div>
        <div className="fvp-external-change-banner-actions">
          <button
            type="button"
            className="ghost fvp-action-btn"
            onClick={handleExternalToggleCompare}
          >
            {externalCompareOpen ? t("files.externalChangeHideCompare") : t("files.externalChangeCompare")}
          </button>
          <button
            type="button"
            className="ghost fvp-action-btn"
            onClick={handleExternalKeepLocal}
          >
            {t("files.externalChangeKeepLocal")}
          </button>
          <button
            type="button"
            className="primary fvp-action-btn"
            onClick={handleExternalReloadFromDisk}
          >
            {t("files.externalChangeReload")}
          </button>
        </div>
      </div>
    );
    };

  const renderExternalComparePanel = () => {
    const diskSnapshot = externalChangeConflict ?? externalPendingRefresh;
    if (!externalCompareOpen || !diskSnapshot) {
      return null;
    }
    const latestLocalContent = editorDraftContentRef.current;
    const localPreview =
      latestLocalContent.length > 6_000
        ? `${latestLocalContent.slice(0, 6_000)}\n\n...`
        : latestLocalContent;
    const diskPreview =
      diskSnapshot.diskContent.length > 6_000
        ? `${diskSnapshot.diskContent.slice(0, 6_000)}\n\n...`
        : diskSnapshot.diskContent;
    return (
      <div className="fvp-external-compare">
        <div className="fvp-external-compare-column">
          <header>{t("files.externalChangeCompareLocal")}</header>
          <pre>{localPreview}</pre>
        </div>
        <div className="fvp-external-compare-column">
          <header>{t("files.externalChangeCompareDisk")}</header>
          <pre>{diskPreview}</pre>
        </div>
      </div>
    );
  };

  const renderTabs = (className?: string) => (
    <div
      ref={tabsContainerRef}
      className={`fvp-tabs${className ? ` ${className}` : ""}`}
      role="tablist"
      aria-label="Open files"
      onContextMenu={openTabContextMenu}
    >
      <div className="fvp-tabs-track">
        {visibleTabs.map((tabPath) => {
          const isActive = (activeTabPath ?? filePath) === tabPath;
          const tabName = tabPath.split("/").pop() || tabPath;
          const tabGitStatus = resolveMatchedGitStatusByPath(tabPath)?.status ?? null;
          const tabGitStatusClass = tabGitStatus ? `git-${tabGitStatus.toLowerCase()}` : "";
          return (
            <div
              key={tabPath}
              className={`fvp-tab ${isActive ? "is-active" : ""} ${tabGitStatusClass}`.trim()}
              role="presentation"
            >
              <button
                type="button"
                className="fvp-tab-main"
                role="tab"
                aria-selected={isActive}
                onClick={() => onActivateTab?.(tabPath)}
                onDoubleClick={() => onToggleEditorFileMaximized?.()}
                onContextMenu={openTabContextMenu}
                title={tabPath}
                data-tauri-drag-region="false"
              >
                <span className="fvp-tab-main-content">
                  <FileIcon filePath={tabPath} className="fvp-tab-icon" />
                  <span className="fvp-tab-main-label">{tabName}</span>
                </span>
              </button>
              <button
                type="button"
                className="fvp-tab-detach"
                aria-label={t("files.openDetachedTabFor", { name: tabName })}
                title={t("files.openDetachedTab")}
                onClick={(event) => handleOpenDetachedTab(event, tabPath)}
                onContextMenu={openTabContextMenu}
                data-tauri-drag-region="false"
              >
                <ExternalLink size={11} aria-hidden />
              </button>
              {onCloseTab ? (
                <button
                  type="button"
                  className="fvp-tab-close"
                  aria-label={`Close ${tabName}`}
                  onClick={() => onCloseTab(tabPath)}
                  onContextMenu={openTabContextMenu}
                  data-tauri-drag-region="false"
                >
                  <X size={11} aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSingleRowHeader = () => (
    <div className="fvp-header-row">
      <button
        type="button"
        className="icon-button fvp-back"
        onClick={onSingleRowLeadingAction ?? handleClose}
        aria-label={singleRowLeadingLabel ?? t("files.backToChat")}
        title={singleRowLeadingLabel ?? t("files.backToChat")}
        data-tauri-drag-region="false"
      >
        {singleRowLeadingDirection === "right" && onSingleRowLeadingAction ? (
          <ArrowRight size={16} aria-hidden />
        ) : (
          <ArrowLeft size={16} aria-hidden />
        )}
      </button>
      <div className="fvp-header-row-tabs">
        {renderTabs("fvp-tabs-inline")}
      </div>
      <div className="fvp-header-row-right">
        {effectiveIsDirty ? <span className="fvp-dirty-dot" aria-label={t("files.unsavedChanges")} /> : null}
        {truncated ? <span className="fvp-truncated">{t("files.truncated")}</span> : null}
        {renderTopbarActions("fvp-header-actions")}
      </div>
    </div>
  );

  // ── Content area ──
  const renderContent = () => (
    <FileViewBody
      filePath={filePath}
      documentKey={`${workspaceId}:${fileReadTarget.domain}:${workspaceRelativeFilePath}`}
      imageSrc={imageSrc}
      imageInfo={imageInfo}
      handleImageLoad={handleImageLoad}
      handleImageError={handleImageError}
      imageLoadError={imageLoadError}
      error={error}
      isLoading={isLoading}
      previewPayload={previewPayload}
      previewPayloadLoading={previewPayloadLoading}
      previewPayloadError={previewPayloadError}
      viewSurface={viewSurface}
        documentSnapshot={documentSnapshot}
        content={content}
        setContent={setContent}
        onEditorContentDraftChange={handleEditorContentDraftChange}
        onEditorContentPublished={handleEditorContentPublished}
        onEditorTypingInput={handleEditorTypingInput}
        fileRenderPressure={fileRenderPressure}
        markdownPreviewSnapshotMode={markdownPreviewSnapshotMode}
        markdownPreviewRefreshKey={externalAutoSyncAt}
        markdownPreviewContentOverride={markdownPreviewOverride?.content ?? null}
        markdownRendererProfile={markdownRendererProfile}
        markdownFastFeatureFlags={markdownFastFeatureFlags}
        cmRef={cmRef}
      onActiveFileLineRangeChange={handleEditorLineRangeChange}
      languageExtensions={languageExtensions}
      gitLineMarkers={effectiveGitLineMarkers}
      editorCodeAnnotations={editorCodeAnnotations}
      editorAnnotationDraft={editorAnnotationDraft}
      annotationWidgetLabels={annotationWidgetLabels}
      annotationWidgetCallbacks={annotationWidgetCallbacks}
      runDefinitionFromCursor={runDefinitionFromCursor}
      runReferencesFromCursor={runReferencesFromCursor}
      resolveDefinitionAtOffset={resolveDefinitionAtOffset}
      onPreviewAnnotationStart={(lineRange) =>
        beginAnnotationDraft(lineRange, "file-preview-mode")
      }
      annotationDraft={effectiveAnnotationDraft}
      codeAnnotations={visibleCodeAnnotations}
      onRemoveCodeAnnotation={onRemoveCodeAnnotation}
      onAnnotationDraftBodyChange={(body) => {
        annotationDraftBodyRef.current = body;
      }}
      onAnnotationDraftCancel={() => {
        annotationDraftBodyRef.current = "";
        setAnnotationDraft(null);
      }}
      onAnnotationDraftConfirm={handleConfirmAnnotationDraft}
      lastReportedLineRangeRef={lastReportedLineRangeRef}
      saveFileShortcut={saveFileShortcut}
      handleSave={handleSave}
      editorTheme={editorTheme}
      previewLanguage={previewLanguage}
      highlightedLines={highlightedLines}
      lines={lines}
      gitAddedLineNumberSet={gitAddedLineNumberSet}
      gitModifiedLineNumberSet={gitModifiedLineNumberSet}
      formatFileSize={formatFileSize}
      t={t}
    />
  );

  // ── Footer ──
  const renderFooter = () => (
    <div
      className="fvp-footer"
      onPointerDown={handleFooterPointerDown}
      title={t("layout.resizePlanPanel")}
    >
      <div className="fvp-footer-left">
        {canEditDocument && mode === "edit" && effectiveIsDirty && (
          <span className="fvp-footer-hint">
            <span className="fvp-dirty-dot" />
            {t("files.unsavedChanges")}
            <span className="fvp-footer-shortcut">{t("files.saveShortcut")}</span>
          </span>
        )}
        {canEditDocument && mode === "edit" && !effectiveIsDirty && (
          <span className="fvp-footer-hint fvp-footer-saved">{t("files.saved")}</span>
        )}
        {(mode === "preview" && (truncated || !canEditDocument)) && (
          <span className="fvp-footer-hint">{t("files.readOnly")}</span>
        )}
      </div>
      <div className="fvp-footer-right">
        {fileReferenceShouldRender ? (
          <div
            className={`fvp-file-reference-bar${fileReferenceVisible ? " is-visible" : ""}`}
            role="group"
            aria-label={t("composer.fileReference")}
          >
            <span className="fvp-file-reference-label">{t("composer.activeFile")}:</span>
            <code className="fvp-file-reference-path" title={filePath}>
              {filePath.split("/").pop() || filePath}
            </code>
            {activeFileLineLabel ? (
              <span className="fvp-file-reference-lines">{activeFileLineLabel}</span>
            ) : null}
            {viewSurface.kind === "editor" && activeAnnotationLineRange ? (
              <button
                type="button"
                className="fvp-annotation-trigger fvp-file-reference-annotation"
                onClick={handleStartEditorAnnotation}
              >
                {t("files.annotateForAi")}
              </button>
            ) : null}
          </div>
        ) : null}
        {mode === "preview" && onInsertText && content.trim().length > 0 && (
          <button
            type="button"
            className="ghost fvp-action-btn"
            onClick={() => {
              const fence = previewLanguage ? `\`\`\`${previewLanguage}` : "```";
              const snippet = `${filePath}\n${fence}\n${content}\n\`\`\``;
              onInsertText(snippet);
            }}
          >
            {t("files.addToChat")}
          </button>
        )}
        {!skipTextRead && !truncated ? (
          <button
            type="button"
            className="ghost fvp-action-btn fvp-find-toggle"
            aria-label={t("files.openFind")}
            title={t("files.openFind")}
            onClick={handleOpenFindPanel}
          >
            <FileSearch size={12} aria-hidden />
          </button>
        ) : null}
        {onToggleEditorFileMaximized ? (
          <button
            type="button"
            className="ghost fvp-action-btn fvp-maximize-toggle"
            aria-label={isEditorFileMaximized ? t("common.restore") : t("menu.maximize")}
            title={isEditorFileMaximized ? t("common.restore") : t("menu.maximize")}
            onClick={onToggleEditorFileMaximized}
          >
            {isEditorFileMaximized ? (
              <Minimize2 size={12} aria-hidden />
            ) : (
              <Maximize2 size={12} aria-hidden />
            )}
          </button>
        ) : null}
        {onToggleEditorSplitLayout ? (
          <button
            type="button"
            className={`ghost fvp-action-btn fvp-layout-toggle${
              editorSplitLayout === "horizontal" ? " is-side-by-side" : ""
            }`}
            aria-label={
              editorSplitLayout === "horizontal"
                ? t("files.switchToStackedSplit")
                : t("files.switchToSideBySideSplit")
            }
            title={
              editorSplitLayout === "horizontal"
                ? t("files.switchToStackedSplit")
                : t("files.switchToSideBySideSplit")
            }
            onClick={onToggleEditorSplitLayout}
          >
            {editorSplitLayout === "horizontal" ? (
              <Rows2 size={12} aria-hidden />
            ) : (
              <Columns2 size={12} aria-hidden />
            )}
          </button>
        ) : null}
        <OpenAppMenu
          path={absolutePath}
          openTargets={openTargets}
          selectedOpenAppId={selectedOpenAppId}
          onSelectOpenAppId={onSelectOpenAppId}
          iconById={openAppIconById}
        />
      </div>
    </div>
  );

  const renderNavigationPanel = () => (
    <FileViewNavigationPanel
      workspacePath={workspacePath}
      navigationError={navigationError}
      definitionCandidates={definitionCandidates}
      onCloseDefinitionCandidates={() => setDefinitionCandidates([])}
      referenceResults={referenceResults}
      onCloseReferenceResults={() => setReferenceResults(null)}
      onNavigateToLocation={navigateToLocation}
      t={t}
    />
  );

  return (
    <div className={`fvp${usesSingleRowHeader ? " fvp-single-row-header" : ""}`} ref={panelRootRef}>
      {usesSingleRowHeader ? renderSingleRowHeader() : renderTabs()}
      {tabContextMenu.visible && canCloseAllTabs ? (
        <div
          ref={tabContextMenuRef}
          className="fvp-tab-context-menu"
          role="menu"
          style={{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }}
        >
          <button
            type="button"
            className="fvp-tab-context-menu-item"
            role="menuitem"
            onClick={handleCloseAllTabs}
          >
            {t("files.closeAllTabs")}
          </button>
        </div>
      ) : null}
      {!usesSingleRowHeader ? renderTopbar() : null}
      {renderExternalChangeNotice()}
      {renderExternalComparePanel()}
      <div className="fvp-body">{renderContent()}</div>
      {renderNavigationPanel()}
      {renderFooter()}
    </div>
  );
}
