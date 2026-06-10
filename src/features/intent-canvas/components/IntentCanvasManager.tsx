import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Copy from "lucide-react/dist/esm/icons/copy";
import FileSearch from "lucide-react/dist/esm/icons/file-search";
import FileText from "lucide-react/dist/esm/icons/file-text";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import LinkIcon from "lucide-react/dist/esm/icons/link";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import MessageSquareText from "lucide-react/dist/esm/icons/message-square-text";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Save from "lucide-react/dist/esm/icons/save";
import Search from "lucide-react/dist/esm/icons/search";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";

import { cn } from "../../../lib/utils";
import type { WorkspaceInfo } from "../../../types";
import { ThreadDeleteConfirmBubble } from "../../threads/components/ThreadDeleteConfirmBubble";
import type {
  CanvasEvidenceRef,
  CanvasSemanticEdge,
  CanvasSemanticGraph,
  CanvasSemanticNode,
  CanvasSourceAnchor,
  IntentCanvasDocument,
  IntentCanvasIndexEntry,
  IntentCanvasOpenRequest,
  IntentCanvasWorkspaceRef,
} from "../types";
import {
  appendIntentCanvasDocumentFromRequest,
  cloneIntentCanvasDocument,
  createIntentCanvasDocument,
  deleteIntentCanvasDocument,
  deleteIntentCanvasDocuments,
  loadIntentCanvasDocument,
  loadIntentCanvasIndex,
  saveIntentCanvasDocument,
} from "../services/intentCanvasStorage";
import {
  isProjectMapRelationshipScanFresh,
  loadProjectMapRelationshipImportSourceState,
  type ProjectMapRelationshipImportSourceState,
} from "../services/relationshipImportQueries";
import { buildIntentCanvasTransmissionContext } from "../utils/context";
import { buildIntentCanvasAiContext, sanitizeIntentCanvasScene } from "../utils/scene";

type IntentCanvasSourceLocation = { line: number; column: number };
type IntentCanvasOpenSourceFile = (path: string, location?: IntentCanvasSourceLocation) => void;

export type IntentCanvasManagerProps = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  openRequest?: IntentCanvasOpenRequest | null;
  onOpenRequestConsumed?: (requestId: number) => void;
  onAttachToThread?: (document: IntentCanvasDocument) => Promise<void> | void;
  onOpenProjectMap?: () => void;
  onOpenSourceFile?: IntentCanvasOpenSourceFile;
};

type IntentCanvasManagerStatus = "idle" | "loading" | "ready" | "error";
type IntentCanvasManagerAction = "open" | "duplicate" | "delete";

type IntentCanvasActionPrompt = {
  action: IntentCanvasManagerAction;
  entry: IntentCanvasIndexEntry;
};

type IntentCanvasEditorProps = {
  document: IntentCanvasDocument;
  activeThreadId: string | null;
  isSaving: boolean;
  onBack: () => void;
  onSave: (document: IntentCanvasDocument) => Promise<IntentCanvasDocument>;
  onAttachToThread?: (document: IntentCanvasDocument) => Promise<void> | void;
  onOpenProjectMap?: () => void;
  onOpenSourceFile?: IntentCanvasOpenSourceFile;
  managerErrorMessage?: string | null;
};

const EMPTY_CANVAS_ENTRIES: IntentCanvasIndexEntry[] = [];
const EMPTY_SOURCE_BACKLINKS: IntentCanvasSourceBacklink[] = [];
const EMPTY_EVIDENCE_BACKLINKS: IntentCanvasEvidenceBacklink[] = [];
const LazyExcalidraw = lazy(async () => {
  const module = await import("@excalidraw/excalidraw");
  return { default: module.Excalidraw };
});

type RelationshipSourceRuntimeState =
  | { status: "idle"; value: null; error: null }
  | { status: "loading"; value: null; error: null }
  | { status: "ready"; value: ProjectMapRelationshipImportSourceState; error: null }
  | { status: "error"; value: null; error: string };

type IntentCanvasSourceBacklink = {
  id: string;
  label: string;
  detail: string;
  path: string;
  location: IntentCanvasSourceLocation | null;
  unresolved: boolean;
};

type IntentCanvasEvidenceBacklink = {
  id: string;
  label: string;
  detail: string;
  path: string | null;
  location: IntentCanvasSourceLocation | null;
  evidenceIds: string[];
  unresolved: boolean;
};

type IntentCanvasTraceabilityProjection = {
  importedGraphCount: number;
  staleGraphCount: number;
  unresolvedAnchorCount: number;
  refreshableGraphCount: number;
  codeSelectionBacklinks: IntentCanvasSourceBacklink[];
  sourceBacklinks: IntentCanvasSourceBacklink[];
  evidenceBacklinks: IntentCanvasEvidenceBacklink[];
};

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDateTime(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function parseMultilineLinks(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function linksToText(values: string[]): string {
  return values.join("\n");
}

function buildWorkspaceRef(workspace: WorkspaceInfo): IntentCanvasWorkspaceRef {
  return {
    id: workspace.id,
    name: workspace.name ?? null,
  };
}

function isProjectMapRelationshipGraph(graph: CanvasSemanticGraph): boolean {
  return graph.sourceSnapshot?.kind === "project-map-relations";
}

function getSourceAnchorPath(anchor: CanvasSourceAnchor | null | undefined): string | null {
  if (!anchor) {
    return null;
  }
  if (anchor.kind === "code-symbol") {
    return anchor.filePath;
  }
  if (anchor.kind === "relationship-node") {
    return anchor.filePath ?? null;
  }
  return null;
}

function normalizeSourceColumn(value: number | null | undefined): number {
  return value && value > 0 ? value : 1;
}

function getSourceAnchorLocation(anchor: CanvasSourceAnchor | null | undefined): IntentCanvasSourceLocation | null {
  if (!anchor || anchor.kind !== "code-symbol") {
    return null;
  }
  const range = anchor.definitionRange ?? anchor.selectionRange ?? null;
  if (!range?.startLine || range.startLine < 1) {
    return null;
  }
  return {
    line: range.startLine,
    column: normalizeSourceColumn(range.startColumn),
  };
}

function getEvidenceRefLocation(ref: CanvasEvidenceRef | null | undefined): IntentCanvasSourceLocation | null {
  if (!ref?.line || ref.line < 1) {
    return null;
  }
  return { line: ref.line, column: 1 };
}

function isRelationshipAnchorRuntimeUnresolved(
  anchor: CanvasSourceAnchor | null | undefined,
  sourceState: ProjectMapRelationshipImportSourceState | null,
): boolean {
  if (!anchor || !sourceState || anchor.kind === "code-symbol") {
    return false;
  }
  if (!sourceState.exists) {
    return true;
  }
  if (anchor.kind === "relationship-node") {
    return !sourceState.fileNodeIds.has(anchor.nodeId);
  }
  return !sourceState.relationEdgeIds.has(anchor.edgeId);
}

function isRelationshipAnchorRuntimeResolved(
  anchor: CanvasSourceAnchor | null | undefined,
  sourceState: ProjectMapRelationshipImportSourceState | null,
): boolean {
  if (!anchor || !sourceState?.exists || anchor.kind === "code-symbol") {
    return false;
  }
  if (anchor.kind === "relationship-node") {
    return sourceState.fileNodeIds.has(anchor.nodeId);
  }
  return sourceState.relationEdgeIds.has(anchor.edgeId);
}

function isGraphSnapshotStale(
  graph: CanvasSemanticGraph,
  sourceState: ProjectMapRelationshipImportSourceState | null,
): boolean {
  const importedScanRunId = graph.sourceSnapshot?.scanRunId;
  if (!importedScanRunId || !sourceState?.scan?.scanRunId) {
    return false;
  }
  return !isProjectMapRelationshipScanFresh({
    importedScanRunId,
    latestScanRunId: sourceState.scan.scanRunId,
  });
}

function isGraphRefreshable(
  graph: CanvasSemanticGraph,
  sourceState: ProjectMapRelationshipImportSourceState | null,
): boolean {
  return graph.nodes.some((node) => isRelationshipAnchorRuntimeResolved(node.sourceAnchor, sourceState))
    || graph.edges.some((edge) => isRelationshipAnchorRuntimeResolved(edge.sourceAnchor, sourceState));
}

function createSourceBacklink(input: {
  graph: CanvasSemanticGraph;
  node: CanvasSemanticNode;
  sourceState: ProjectMapRelationshipImportSourceState | null;
}): IntentCanvasSourceBacklink | null {
  const path = getSourceAnchorPath(input.node.sourceAnchor);
  if (!path) {
    return null;
  }
  const location = getSourceAnchorLocation(input.node.sourceAnchor);
  return {
    id: `${input.graph.graphId}:node:${input.node.id}`,
    label: input.node.label,
    detail: location ? `${path}:${location.line}` : path,
    path,
    location,
    unresolved: Boolean(input.node.unresolved)
      || isRelationshipAnchorRuntimeUnresolved(input.node.sourceAnchor, input.sourceState),
  };
}

function createEvidenceBacklink(input: {
  graph: CanvasSemanticGraph;
  edge: CanvasSemanticEdge;
  sourceState: ProjectMapRelationshipImportSourceState | null;
}): IntentCanvasEvidenceBacklink | null {
  const evidenceIds = input.edge.evidenceIds ?? [];
  const evidenceRefs = input.edge.evidenceRefs ?? [];
  if (!evidenceIds.length && !evidenceRefs.length) {
    return null;
  }
  const primaryRef = evidenceRefs.find((ref) => Boolean(ref.path)) ?? evidenceRefs[0] ?? null;
  const path = primaryRef?.path?.trim() || null;
  return {
    id: `${input.graph.graphId}:edge:${input.edge.id}`,
    label: input.edge.label ?? input.edge.relationKind,
    detail: primaryRef?.label ?? evidenceIds[0] ?? input.edge.relationKind,
    path,
    location: getEvidenceRefLocation(primaryRef),
    evidenceIds,
    unresolved: Boolean(input.edge.unresolved)
      || isRelationshipAnchorRuntimeUnresolved(input.edge.sourceAnchor, input.sourceState),
  };
}

function formatCodeSelectionLineLabel(startLine: number, endLine: number): string {
  return startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
}

function getCodeSelectionFileName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function createCodeSelectionBacklink(graph: CanvasSemanticGraph): IntentCanvasSourceBacklink | null {
  const selection = graph.sourceSelection;
  if (!selection?.filePath) {
    return null;
  }
  const lineLabel = formatCodeSelectionLineLabel(selection.startLine, selection.endLine);
  return {
    id: `${graph.graphId}:code-selection:${selection.filePath}:${lineLabel}`,
    label: selection.symbolName,
    detail: `${getCodeSelectionFileName(selection.filePath)} · ${lineLabel}`,
    path: selection.filePath,
    location: {
      line: selection.declarationLine,
      column: 1,
    },
    unresolved: false,
  };
}

function buildTraceabilityProjection(
  graphs: CanvasSemanticGraph[],
  sourceState: ProjectMapRelationshipImportSourceState | null,
): IntentCanvasTraceabilityProjection {
  const codeSelectionBacklinks = new Map<string, IntentCanvasSourceBacklink>();
  graphs.forEach((graph) => {
    const codeSelectionBacklink = createCodeSelectionBacklink(graph);
    if (codeSelectionBacklink) {
      codeSelectionBacklinks.set(codeSelectionBacklink.id, codeSelectionBacklink);
    }
  });

  const relationshipGraphs = graphs.filter(isProjectMapRelationshipGraph);
  if (!relationshipGraphs.length) {
    return {
      importedGraphCount: 0,
      staleGraphCount: 0,
      unresolvedAnchorCount: 0,
      refreshableGraphCount: 0,
      codeSelectionBacklinks: Array.from(codeSelectionBacklinks.values()),
      sourceBacklinks: EMPTY_SOURCE_BACKLINKS,
      evidenceBacklinks: EMPTY_EVIDENCE_BACKLINKS,
    };
  }

  const sourceBacklinks = new Map<string, IntentCanvasSourceBacklink>();
  const evidenceBacklinks = new Map<string, IntentCanvasEvidenceBacklink>();
  let unresolvedAnchorCount = 0;

  relationshipGraphs.forEach((graph) => {
    graph.nodes.forEach((node) => {
      if (Boolean(node.unresolved) || isRelationshipAnchorRuntimeUnresolved(node.sourceAnchor, sourceState)) {
        unresolvedAnchorCount += 1;
      }
      const backlink = createSourceBacklink({ graph, node, sourceState });
      if (backlink) {
        sourceBacklinks.set(`${backlink.path}:${backlink.location?.line ?? ""}:${backlink.label}`, backlink);
      }
    });
    graph.edges.forEach((edge) => {
      if (Boolean(edge.unresolved) || isRelationshipAnchorRuntimeUnresolved(edge.sourceAnchor, sourceState)) {
        unresolvedAnchorCount += 1;
      }
      const backlink = createEvidenceBacklink({ graph, edge, sourceState });
      if (backlink) {
        evidenceBacklinks.set(backlink.id, backlink);
      }
    });
  });

  return {
    importedGraphCount: relationshipGraphs.length,
    staleGraphCount: relationshipGraphs.filter((graph) => isGraphSnapshotStale(graph, sourceState)).length,
    unresolvedAnchorCount,
    refreshableGraphCount: relationshipGraphs.filter((graph) => isGraphRefreshable(graph, sourceState)).length,
    codeSelectionBacklinks: Array.from(codeSelectionBacklinks.values()),
    sourceBacklinks: Array.from(sourceBacklinks.values()),
    evidenceBacklinks: Array.from(evidenceBacklinks.values()),
  };
}

function resolveIntentCanvasTheme(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "dark";
  }
  const root = document.documentElement;
  const presetAppearance = root.dataset.themePresetAppearance;
  if (presetAppearance === "light" || presetAppearance === "dark") {
    return presetAppearance;
  }
  if (root.dataset.theme === "system" && typeof window !== "undefined") {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return root.dataset.theme === "light" ? "light" : "dark";
}

function useIntentCanvasTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() => resolveIntentCanvasTheme());

  useEffect(() => {
    if (
      typeof document === "undefined" ||
      typeof window === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return undefined;
    }
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(resolveIntentCanvasTheme());
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-preset-appearance"],
    });
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: light)");
    const handleSystemThemeChange = () => {
      setTheme(resolveIntentCanvasTheme());
    };
    mediaQuery?.addEventListener?.("change", handleSystemThemeChange);
    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener?.("change", handleSystemThemeChange);
    };
  }, []);

  return theme;
}

function IntentCanvasEditor({
  document,
  activeThreadId,
  isSaving,
  onBack,
  onSave,
  onAttachToThread,
  onOpenProjectMap,
  onOpenSourceFile,
  managerErrorMessage = null,
}: IntentCanvasEditorProps) {
  const { t, i18n } = useTranslation();
  const excalidrawTheme = useIntentCanvasTheme();
  const [title, setTitle] = useState(document.title);
  const [summary, setSummary] = useState(document.summary);
  const [fileLinksText, setFileLinksText] = useState(linksToText(document.links.filePaths));
  const [nodeLinksText, setNodeLinksText] = useState(linksToText(document.links.projectMapNodeIds));
  const [threadLinksText, setThreadLinksText] = useState(linksToText(document.links.threadIds));
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const [relationshipSourceState, setRelationshipSourceState] =
    useState<RelationshipSourceRuntimeState>({ status: "idle", value: null, error: null });
  const [elementCount, setElementCount] = useState(
    document.scene.elements.filter((element) => !element.isDeleted).length,
  );
  const sceneRef = useRef(document.scene);

  useEffect(() => {
    setTitle(document.title);
    setSummary(document.summary);
    setFileLinksText(linksToText(document.links.filePaths));
    setNodeLinksText(linksToText(document.links.projectMapNodeIds));
    setThreadLinksText(linksToText(document.links.threadIds));
    setIsDirty(false);
    setSaveError(null);
    sceneRef.current = document.scene;
    setElementCount(document.scene.elements.filter((element) => !element.isDeleted).length);
  }, [document]);

  const initialData = useMemo<ExcalidrawInitialDataState>(
    () => ({
      elements: document.scene.elements,
      appState: document.scene.appState,
      files: document.scene.files,
    }),
    [document.scene.appState, document.scene.elements, document.scene.files],
  );

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setSaveError(null);
  }, []);

  const handleSceneChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const nextScene = sanitizeIntentCanvasScene(elements, appState, files);
      sceneRef.current = nextScene;
      setElementCount(elements.filter((element) => !element.isDeleted).length);
      setIsDirty(true);
    },
    [],
  );

  const buildDraftDocument = useCallback(
    (options: { includeActiveThread: boolean }): IntentCanvasDocument => {
      const threadIds = parseMultilineLinks(threadLinksText);
      const nextThreadIds =
        options.includeActiveThread && activeThreadId
          ? Array.from(new Set([...threadIds, activeThreadId]))
          : threadIds;
      const safeTitle = title.trim() || t("intentCanvas.untitled");
      const safeSummary = summary.trim();
      const nextScene = sceneRef.current;
      return {
        ...document,
        title: safeTitle,
        summary: safeSummary,
        links: {
          filePaths: parseMultilineLinks(fileLinksText),
          projectMapNodeIds: parseMultilineLinks(nodeLinksText),
          threadIds: nextThreadIds,
        },
        scene: nextScene,
        aiContext: buildIntentCanvasAiContext(nextScene, safeSummary),
      };
    },
    [activeThreadId, document, fileLinksText, nodeLinksText, summary, t, threadLinksText, title],
  );

  const handleSave = useCallback(async () => {
    try {
      const savedDocument = await onSave(buildDraftDocument({ includeActiveThread: false }));
      setIsDirty(false);
      setSaveError(null);
      return savedDocument;
    } catch (error) {
      const message = normalizeError(error);
      setSaveError(message);
      return null;
    }
  }, [buildDraftDocument, onSave]);

  const handleAttachToThread = useCallback(async () => {
    if (!onAttachToThread) {
      return;
    }
    try {
      const savedDocument = await onSave(buildDraftDocument({ includeActiveThread: true }));
      setIsDirty(false);
      setSaveError(null);
      await onAttachToThread(savedDocument);
    } catch (error) {
      setSaveError(normalizeError(error));
    }
  }, [buildDraftDocument, onAttachToThread, onSave]);

  const metadataChange = useCallback((next: () => void) => {
    next();
    markDirty();
  }, [markDirty]);

  const langCode = i18n.resolvedLanguage?.startsWith("zh") || i18n.language.startsWith("zh")
    ? "zh-CN"
    : "en";
  const hasProjectMapImportSource =
    document.links.projectMapNodeIds.length > 0 ||
    document.semanticGraphs.some((graph) => graph.sourceSnapshot?.kind === "project-map-relations");
  const relationshipGraphSourceKey = useMemo(
    () => document.semanticGraphs
      .filter(isProjectMapRelationshipGraph)
      .map((graph) => `${graph.graphId}:${graph.sourceSnapshot?.scanRunId ?? "unknown"}`)
      .join("|"),
    [document.semanticGraphs],
  );
  const runtimeRelationshipSourceState =
    relationshipSourceState.status === "ready" ? relationshipSourceState.value : null;
  const traceabilityProjection = useMemo(
    () => buildTraceabilityProjection(document.semanticGraphs, runtimeRelationshipSourceState),
    [document.semanticGraphs, runtimeRelationshipSourceState],
  );

  useEffect(() => {
    if (!relationshipGraphSourceKey) {
      setRelationshipSourceState({ status: "idle", value: null, error: null });
      return undefined;
    }
    let cancelled = false;
    setRelationshipSourceState({ status: "loading", value: null, error: null });
    loadProjectMapRelationshipImportSourceState({
      workspaceId: document.workspace.id,
    })
      .then((sourceState) => {
        if (!cancelled) {
          setRelationshipSourceState({ status: "ready", value: sourceState, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRelationshipSourceState({
            status: "error",
            value: null,
            error: normalizeError(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [document.workspace.id, relationshipGraphSourceKey]);

  const handleOpenBacklink = useCallback((backlink: IntentCanvasSourceBacklink | IntentCanvasEvidenceBacklink) => {
    if (!onOpenSourceFile || !backlink.path || backlink.unresolved) {
      return;
    }
    onOpenSourceFile(backlink.path, backlink.location ?? undefined);
  }, [onOpenSourceFile]);

  return (
    <section className="intent-canvas-editor" aria-label={t("intentCanvas.editor.ariaLabel")}> 
      <header className="intent-canvas-editor-topbar">
        <div className="intent-canvas-editor-titlebar">
          <button type="button" className="intent-canvas-icon-button" onClick={onBack}>
            <ArrowLeft aria-hidden />
            <span>{t("intentCanvas.editor.back")}</span>
          </button>
          <div className="intent-canvas-editor-title-meta">
            <h2>{title.trim() || t("intentCanvas.untitled")}</h2>
          </div>
        </div>
        {onOpenProjectMap && hasProjectMapImportSource ? (
          <button
            type="button"
            className="intent-canvas-source-link"
            onClick={onOpenProjectMap}
          >
            <LinkIcon aria-hidden />
            {t("intentCanvas.editor.backToProjectMap")}
          </button>
        ) : null}
        <div className="intent-canvas-editor-actions">
          <span className={cn("intent-canvas-save-state", isDirty && "is-dirty")}>
            {isSaving ? t("intentCanvas.saving") : isDirty ? t("intentCanvas.unsaved") : t("intentCanvas.saved")}
          </span>
          <button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            <Save aria-hidden />
            {t("intentCanvas.editor.save")}
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => void handleAttachToThread()}
            disabled={isSaving || !onAttachToThread}
          >
            <MessageSquareText aria-hidden />
            {t("intentCanvas.editor.attachToThread")}
          </button>
        </div>
      </header>

      <div
        className={cn(
          "intent-canvas-editor-body",
          leftRailCollapsed && "is-left-collapsed",
          rightRailCollapsed && "is-right-collapsed",
        )}
      >
        <aside className={cn("intent-canvas-rail is-left", leftRailCollapsed && "is-collapsed")}>
          <div className="intent-canvas-rail-header">
            <span>{t("intentCanvas.editor.leftRail")}</span>
            <button
              type="button"
              className="intent-canvas-rail-toggle"
              onClick={() => setLeftRailCollapsed((current) => !current)}
              aria-label={
                leftRailCollapsed
                  ? t("intentCanvas.editor.expandLeftRail")
                  : t("intentCanvas.editor.collapseLeftRail")
              }
              title={
                leftRailCollapsed
                  ? t("intentCanvas.editor.expandLeftRail")
                  : t("intentCanvas.editor.collapseLeftRail")
              }
            >
              <ArrowLeft aria-hidden className={leftRailCollapsed ? "is-flipped" : undefined} />
              <span>
                {leftRailCollapsed
                  ? t("intentCanvas.editor.expandLeftRail")
                  : t("intentCanvas.editor.collapseLeftRail")}
              </span>
            </button>
          </div>
          {!leftRailCollapsed ? (
            <>
              <section className="intent-canvas-card">
                <h3>{t("intentCanvas.editor.metadata")}</h3>
                <label>
                  <span>{t("intentCanvas.editor.title")}</span>
                  <input
                    value={title}
                    onChange={(event) => metadataChange(() => setTitle(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>{t("intentCanvas.editor.summary")}</span>
                  <textarea
                    value={summary}
                    rows={5}
                    placeholder={t("intentCanvas.editor.summaryPlaceholder")}
                    onChange={(event) => metadataChange(() => setSummary(event.currentTarget.value))}
                  />
                </label>
              </section>
              <section className="intent-canvas-card">
                <h3>{t("intentCanvas.editor.links")}</h3>
                <label>
                  <span>{t("intentCanvas.editor.fileLinks")}</span>
                  <textarea
                    value={fileLinksText}
                    rows={4}
                    placeholder="src/services/order.ts"
                    onChange={(event) => metadataChange(() => setFileLinksText(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>{t("intentCanvas.editor.projectMapNodeLinks")}</span>
                  <textarea
                    value={nodeLinksText}
                    rows={3}
                    placeholder="project-map-node-id"
                    onChange={(event) => metadataChange(() => setNodeLinksText(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>{t("intentCanvas.editor.threadLinks")}</span>
                  <textarea
                    value={threadLinksText}
                    rows={3}
                    placeholder={activeThreadId ?? "thread-id"}
                    onChange={(event) => metadataChange(() => setThreadLinksText(event.currentTarget.value))}
                  />
                </label>
              </section>
            </>
          ) : null}
        </aside>

        <main className="intent-canvas-excalidraw-shell">
          <Suspense
            fallback={
              <div className="intent-canvas-loading">
                <LoaderCircle aria-hidden className="is-spinning" /> {t("intentCanvas.loading")}
              </div>
            }
          >
            <LazyExcalidraw
              key={document.id}
              initialData={initialData}
              onChange={handleSceneChange}
              name={title.trim() || document.title}
              langCode={langCode}
              gridModeEnabled
              objectsSnapModeEnabled
              theme={excalidrawTheme}
              UIOptions={{
                canvasActions: {
                  loadScene: false,
                  saveToActiveFile: false,
                  export: false,
                },
              }}
            />
          </Suspense>
        </main>

        <aside className={cn("intent-canvas-rail is-right", rightRailCollapsed && "is-collapsed")}>
          <div className="intent-canvas-rail-header">
            <span>{t("intentCanvas.editor.rightRail")}</span>
            <button
              type="button"
              className="intent-canvas-rail-toggle"
              onClick={() => setRightRailCollapsed((current) => !current)}
              aria-label={
                rightRailCollapsed
                  ? t("intentCanvas.editor.expandRightRail")
                  : t("intentCanvas.editor.collapseRightRail")
              }
              title={
                rightRailCollapsed
                  ? t("intentCanvas.editor.expandRightRail")
                  : t("intentCanvas.editor.collapseRightRail")
              }
            >
              <ArrowLeft aria-hidden className={rightRailCollapsed ? undefined : "is-flipped"} />
              <span>
                {rightRailCollapsed
                  ? t("intentCanvas.editor.expandRightRail")
                  : t("intentCanvas.editor.collapseRightRail")}
              </span>
            </button>
          </div>
          {!rightRailCollapsed ? (
            <>
              <section className="intent-canvas-card is-accent">
                <h3>{t("intentCanvas.editor.aiContext")}</h3>
                <p>{t("intentCanvas.editor.aiContextHint")}</p>
                <dl className="intent-canvas-metrics">
                  <div>
                    <dt>{t("intentCanvas.editor.elements")}</dt>
                    <dd>{elementCount}</dd>
                  </div>
                  <div>
                    <dt>{t("intentCanvas.editor.files")}</dt>
                    <dd>{parseMultilineLinks(fileLinksText).length}</dd>
                  </div>
                  <div>
                    <dt>{t("intentCanvas.editor.nodes")}</dt>
                    <dd>{parseMultilineLinks(nodeLinksText).length}</dd>
                  </div>
                </dl>
              </section>
              {traceabilityProjection.importedGraphCount > 0 || traceabilityProjection.codeSelectionBacklinks.length > 0 ? (
                <section className="intent-canvas-card intent-canvas-source-trace-card">
                  <h3>{t("intentCanvas.editor.sourceTraceability")}</h3>
                  <p>{t("intentCanvas.editor.sourceTraceabilityHint")}</p>
                  <dl className="intent-canvas-metrics intent-canvas-source-health">
                    <div>
                      <dt>{t("intentCanvas.editor.sourceImportedGraphs")}</dt>
                      <dd>{traceabilityProjection.importedGraphCount}</dd>
                    </div>
                    <div className={traceabilityProjection.staleGraphCount > 0 ? "is-warning" : undefined}>
                      <dt>{t("intentCanvas.editor.sourceStaleGraphs")}</dt>
                      <dd>{traceabilityProjection.staleGraphCount}</dd>
                    </div>
                    <div className={traceabilityProjection.unresolvedAnchorCount > 0 ? "is-warning" : undefined}>
                      <dt>{t("intentCanvas.editor.sourceUnresolvedAnchors")}</dt>
                      <dd>{traceabilityProjection.unresolvedAnchorCount}</dd>
                    </div>
                  </dl>
                  {relationshipSourceState.status === "loading" ? (
                    <p className="intent-canvas-source-notice">
                      <LoaderCircle aria-hidden className="is-spinning" />
                      {t("intentCanvas.editor.sourceStatusLoading")}
                    </p>
                  ) : null}
                  {relationshipSourceState.status === "error" ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceStatusError", { message: relationshipSourceState.error })}
                    </p>
                  ) : null}
                  {relationshipSourceState.status === "ready" && !relationshipSourceState.value.exists ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceStatusUnavailable")}
                    </p>
                  ) : null}
                  {relationshipSourceState.status === "ready" && relationshipSourceState.value.scan ? (
                    <button
                      type="button"
                      className="intent-canvas-source-notice intent-canvas-source-link-notice"
                      onClick={onOpenProjectMap}
                      disabled={!onOpenProjectMap}
                      title={t("intentCanvas.editor.sourceRefreshHint")}
                    >
                      <GitBranch aria-hidden />
                      {t("intentCanvas.editor.sourceLatestScan", {
                        scanRunId: relationshipSourceState.value.scan.scanRunId,
                      })}
                    </button>
                  ) : null}
                  {traceabilityProjection.staleGraphCount > 0 ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceStaleNotice", {
                        count: traceabilityProjection.staleGraphCount,
                      })}
                    </p>
                  ) : null}
                  {traceabilityProjection.unresolvedAnchorCount > 0 ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceUnresolvedNotice", {
                        count: traceabilityProjection.unresolvedAnchorCount,
                      })}
                    </p>
                  ) : null}
                  {traceabilityProjection.codeSelectionBacklinks.length > 0 ? (
                    <div className="intent-canvas-source-list">
                      <strong>{t("intentCanvas.editor.sourceCodeSelection")}</strong>
                      {traceabilityProjection.codeSelectionBacklinks.slice(0, 4).map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          className="intent-canvas-source-action"
                          onClick={() => handleOpenBacklink(source)}
                          disabled={!onOpenSourceFile}
                          aria-label={t("intentCanvas.editor.sourceOpenCodeSelection", {
                            path: source.path,
                            line: source.location?.line ?? 1,
                          })}
                          title={source.path}
                        >
                          <FileText aria-hidden />
                          <span>{source.label}</span>
                          <small>{source.detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {traceabilityProjection.sourceBacklinks.length > 0 ? (
                    <div className="intent-canvas-source-list">
                      <strong>{t("intentCanvas.editor.sourceFiles")}</strong>
                      {traceabilityProjection.sourceBacklinks.slice(0, 6).map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          className={cn("intent-canvas-source-action", source.unresolved && "is-unresolved")}
                          onClick={() => handleOpenBacklink(source)}
                          disabled={!onOpenSourceFile || source.unresolved}
                          aria-label={
                            source.location
                              ? t("intentCanvas.editor.sourceOpenFileAtLine", {
                                  path: source.path,
                                  line: source.location.line,
                                })
                              : t("intentCanvas.editor.sourceOpenFile", { path: source.path })
                          }
                          title={source.unresolved ? t("intentCanvas.editor.sourceOpenUnavailable") : source.detail}
                        >
                          <FileText aria-hidden />
                          <span>{source.label}</span>
                          <small>{source.detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {traceabilityProjection.evidenceBacklinks.length > 0 ? (
                    <div className="intent-canvas-source-list">
                      <strong>{t("intentCanvas.editor.sourceEvidence")}</strong>
                      {traceabilityProjection.evidenceBacklinks.slice(0, 6).map((evidence) => (
                        <button
                          key={evidence.id}
                          type="button"
                          className={cn("intent-canvas-source-action", evidence.unresolved && "is-unresolved")}
                          onClick={() => handleOpenBacklink(evidence)}
                          disabled={!onOpenSourceFile || !evidence.path || evidence.unresolved}
                          aria-label={t("intentCanvas.editor.sourceEvidenceOpen", {
                            label: evidence.label,
                          })}
                          title={
                            evidence.path && !evidence.unresolved
                              ? evidence.detail
                              : t("intentCanvas.editor.sourceEvidenceNoFile")
                          }
                        >
                          <FileSearch aria-hidden />
                          <span>{evidence.label}</span>
                          <small>{evidence.detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {onOpenProjectMap ? (
                    <button
                      type="button"
                      className="intent-canvas-source-refresh"
                      onClick={onOpenProjectMap}
                      disabled={traceabilityProjection.refreshableGraphCount === 0}
                      title={t("intentCanvas.editor.sourceRefreshHint")}
                    >
                      <RefreshCw aria-hidden />
                      {t("intentCanvas.editor.sourceRefresh")}
                    </button>
                  ) : null}
                </section>
              ) : null}
              <section className="intent-canvas-card">
                <h3>{t("intentCanvas.editor.contextPreview")}</h3>
                <pre>{JSON.stringify(
                  buildIntentCanvasTransmissionContext(buildDraftDocument({ includeActiveThread: false })),
                  null,
                  2,
                )}</pre>
              </section>
              {saveError || managerErrorMessage ? (
                <p className="intent-canvas-error" role="alert">{saveError ?? managerErrorMessage}</p>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>

      <footer className="intent-canvas-editor-statusbar">
        <span>{document.id}</span>
        <span>{document.mode}</span>
        <span>{t("intentCanvas.editor.updated", { time: formatDateTime(document.updatedAt) })}</span>
      </footer>
    </section>
  );
}

export function IntentCanvasManager({
  activeWorkspace,
  activeThreadId,
  openRequest = null,
  onOpenRequestConsumed,
  onAttachToThread,
  onOpenProjectMap,
  onOpenSourceFile,
}: IntentCanvasManagerProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<IntentCanvasManagerStatus>("idle");
  const [entries, setEntries] = useState<IntentCanvasIndexEntry[]>(EMPTY_CANVAS_ENTRIES);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDocument, setActiveDocument] = useState<IntentCanvasDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionPrompt, setActionPrompt] = useState<IntentCanvasActionPrompt | null>(null);
  const [confirmingCanvasActionId, setConfirmingCanvasActionId] = useState<string | null>(null);
  const [selectedCanvasIds, setSelectedCanvasIds] = useState<Set<string>>(() => new Set());
  const [isBulkDeletePromptOpen, setIsBulkDeletePromptOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const handledOpenRequestIdsRef = useRef<Set<number>>(new Set());

  const workspaceRef = useMemo(
    () => (activeWorkspace ? buildWorkspaceRef(activeWorkspace) : null),
    [activeWorkspace],
  );

  const refreshIndex = useCallback(async () => {
    if (!activeWorkspace) {
      setEntries(EMPTY_CANVAS_ENTRIES);
      setWarnings([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const result = await loadIntentCanvasIndex(activeWorkspace.id);
    setEntries(result.value);
    setWarnings(result.warnings);
    setStatus("ready");
  }, [activeWorkspace]);

  useEffect(() => {
    let cancelled = false;
    if (!activeWorkspace) {
      setEntries(EMPTY_CANVAS_ENTRIES);
      setWarnings([]);
      setErrorMessage(null);
      setActiveDocument(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    loadIntentCanvasIndex(activeWorkspace.id)
      .then((result) => {
        if (!cancelled) {
          setEntries(result.value);
          setWarnings(result.warnings);
          setStatus("ready");
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(normalizeError(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace]);

  useEffect(() => {
    setSelectedCanvasIds(new Set<string>());
    setIsBulkDeletePromptOpen(false);
    setActionPrompt(null);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    setSelectedCanvasIds((current) => {
      const availableCanvasIds = new Set(entries.map((entry) => entry.id));
      const next = new Set<string>();
      let changed = false;
      current.forEach((canvasId) => {
        if (availableCanvasIds.has(canvasId)) {
          next.add(canvasId);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [entries]);

  const saveDocument = useCallback(
    async (documentToSave: IntentCanvasDocument) => {
      if (!activeWorkspace) {
        throw new Error(t("intentCanvas.errors.noWorkspace"));
      }
      setIsSaving(true);
      try {
        const savedDocument = await saveIntentCanvasDocument(activeWorkspace.id, documentToSave);
        setActiveDocument(savedDocument);
        await refreshIndex();
        return savedDocument;
      } finally {
        setIsSaving(false);
      }
    },
    [activeWorkspace, refreshIndex, t],
  );

  const openCanvas = useCallback(
    async (canvasId: string) => {
      if (!activeWorkspace) {
        return;
      }
      setStatus("loading");
      try {
        const document = await loadIntentCanvasDocument(activeWorkspace.id, canvasId);
        setActiveDocument(document);
        setStatus("ready");
        setErrorMessage(null);
      } catch (error) {
        setStatus("error");
        setErrorMessage(normalizeError(error));
      }
    },
    [activeWorkspace],
  );

  const createCanvas = useCallback(
    async (request?: IntentCanvasOpenRequest | null) => {
      if (!activeWorkspace || !workspaceRef) {
        setErrorMessage(t("intentCanvas.errors.noWorkspace"));
        return;
      }
      try {
        const document = createIntentCanvasDocument({ workspace: workspaceRef, request });
        const savedDocument = await saveDocument(document);
        setActiveDocument(savedDocument);
        setErrorMessage(null);
      } catch (error) {
        setStatus("error");
        setErrorMessage(normalizeError(error));
      }
    },
    [activeWorkspace, saveDocument, t, workspaceRef],
  );

  const appendCanvas = useCallback(
    async (request: IntentCanvasOpenRequest) => {
      try {
        let baseDocument = activeDocument;
        if (request.canvasId && (!baseDocument || baseDocument.id !== request.canvasId)) {
          if (!activeWorkspace) {
            setErrorMessage(t("intentCanvas.errors.noWorkspace"));
            return;
          }
          baseDocument = await loadIntentCanvasDocument(activeWorkspace.id, request.canvasId);
        }
        if (!baseDocument) {
          await createCanvas(request);
          return;
        }
        const nextDocument = appendIntentCanvasDocumentFromRequest({
          document: baseDocument,
          request,
        });
        const savedDocument = await saveDocument(nextDocument);
        setActiveDocument(savedDocument);
        setErrorMessage(null);
      } catch (error) {
        setStatus("error");
        setErrorMessage(normalizeError(error));
      }
    },
    [activeDocument, activeWorkspace, createCanvas, saveDocument, t],
  );

  useEffect(() => {
    if (!openRequest || !activeWorkspace || !workspaceRef) {
      return;
    }
    if (handledOpenRequestIdsRef.current.has(openRequest.requestId)) {
      return;
    }
    handledOpenRequestIdsRef.current.add(openRequest.requestId);
    onOpenRequestConsumed?.(openRequest.requestId);
    const executeRequest = async () => {
      if (openRequest.target === "append") {
        await appendCanvas(openRequest);
      } else if (openRequest.canvasId) {
        await openCanvas(openRequest.canvasId);
      } else {
        await createCanvas(openRequest);
      }
    };
    void executeRequest();
  }, [activeWorkspace, appendCanvas, createCanvas, onOpenRequestConsumed, openCanvas, openRequest, workspaceRef]);

  const handleCanvasActionRequest = useCallback(
    (entry: IntentCanvasIndexEntry, action: IntentCanvasManagerAction) => {
      setActionPrompt((current) => (current?.entry.id === entry.id && current.action === action ? null : { action, entry }));
    },
    [],
  );

  const handleDuplicateCanvas = useCallback(
    async (entry: IntentCanvasIndexEntry) => {
      if (!activeWorkspace || !workspaceRef) {
        return;
      }
      const sourceDocument = await loadIntentCanvasDocument(activeWorkspace.id, entry.id);
      const copiedDocument = cloneIntentCanvasDocument({ workspace: workspaceRef, source: sourceDocument });
      const savedDocument = await saveDocument(copiedDocument);
      setActiveDocument(savedDocument);
    },
    [activeWorkspace, saveDocument, workspaceRef],
  );

  const confirmCanvasAction = useCallback(
    async () => {
      if (!actionPrompt) {
        return;
      }
      const { action, entry } = actionPrompt;
      setConfirmingCanvasActionId(entry.id);
      try {
        if (action === "open") {
          await openCanvas(entry.id);
        } else if (action === "duplicate") {
          await handleDuplicateCanvas(entry);
        } else if (activeWorkspace) {
          await deleteIntentCanvasDocument(activeWorkspace.id, entry.id);
          if (activeDocument?.id === entry.id) {
            setActiveDocument(null);
          }
          setSelectedCanvasIds((current) => {
            if (!current.has(entry.id)) {
              return current;
            }
            const next = new Set(current);
            next.delete(entry.id);
            return next;
          });
          await refreshIndex();
        }
        setActionPrompt(null);
      } catch (error) {
        setErrorMessage(normalizeError(error));
      } finally {
        setConfirmingCanvasActionId(null);
      }
    },
    [actionPrompt, activeDocument?.id, activeWorkspace, handleDuplicateCanvas, openCanvas, refreshIndex],
  );

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return entries;
    }
    return entries.filter((entry) => {
      const searchable = [entry.title, entry.summary, entry.mode, entry.path].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [entries, searchQuery]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedCanvasIds.has(entry.id)),
    [entries, selectedCanvasIds],
  );

  const allFilteredEntriesSelected = filteredEntries.length > 0
    && filteredEntries.every((entry) => selectedCanvasIds.has(entry.id));

  const toggleCanvasSelection = useCallback((canvasId: string) => {
    setSelectedCanvasIds((current) => {
      const next = new Set(current);
      if (next.has(canvasId)) {
        next.delete(canvasId);
      } else {
        next.add(canvasId);
      }
      return next;
    });
    setIsBulkDeletePromptOpen(false);
  }, []);

  const toggleFilteredCanvasSelection = useCallback(() => {
    setSelectedCanvasIds((current) => {
      const next = new Set(current);
      const shouldSelectAll = filteredEntries.some((entry) => !next.has(entry.id));
      filteredEntries.forEach((entry) => {
        if (shouldSelectAll) {
          next.add(entry.id);
        } else {
          next.delete(entry.id);
        }
      });
      if (next.size === current.size && Array.from(next).every((canvasId) => current.has(canvasId))) {
        return current;
      }
      return next;
    });
    setIsBulkDeletePromptOpen(false);
  }, [filteredEntries]);

  const clearCanvasSelection = useCallback(() => {
    setSelectedCanvasIds((current) => (current.size === 0 ? current : new Set<string>()));
    setIsBulkDeletePromptOpen(false);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    if (!activeWorkspace || selectedEntries.length === 0) {
      return;
    }
    const deletedCanvasIds = selectedEntries.map((entry) => entry.id);
    setIsBulkDeleting(true);
    try {
      await deleteIntentCanvasDocuments(activeWorkspace.id, deletedCanvasIds);
      if (activeDocument && deletedCanvasIds.includes(activeDocument.id)) {
        setActiveDocument(null);
      }
      setSelectedCanvasIds(new Set<string>());
      setIsBulkDeletePromptOpen(false);
      setActionPrompt(null);
      await refreshIndex();
    } catch (error) {
      setErrorMessage(normalizeError(error));
    } finally {
      setIsBulkDeleting(false);
    }
  }, [activeDocument, activeWorkspace, refreshIndex, selectedEntries]);

  if (!activeWorkspace) {
    return (
      <section className="intent-canvas-manager is-empty">
        <div className="intent-canvas-empty-state">
          <FolderOpen aria-hidden />
          <h2>{t("intentCanvas.manager.noWorkspaceTitle")}</h2>
          <p>{t("intentCanvas.manager.noWorkspaceBody")}</p>
        </div>
      </section>
    );
  }

  if (activeDocument) {
    return (
      <IntentCanvasEditor
        document={activeDocument}
        activeThreadId={activeThreadId}
        isSaving={isSaving}
        onBack={() => {
          setActiveDocument(null);
          void refreshIndex();
        }}
        onSave={saveDocument}
        onAttachToThread={onAttachToThread}
        onOpenProjectMap={onOpenProjectMap}
        onOpenSourceFile={onOpenSourceFile}
        managerErrorMessage={errorMessage}
      />
    );
  }

  return (
    <section className="intent-canvas-manager" aria-label={t("intentCanvas.manager.ariaLabel")}> 
      <header className="intent-canvas-manager-hero">
        <div className="intent-canvas-manager-identity">
          <h2>{t("intentCanvas.manager.title")}</h2>
          <p>{t("intentCanvas.manager.subtitle")}</p>
        </div>
        <label className="intent-canvas-search">
          <Search aria-hidden />
          <input
            value={searchQuery}
            placeholder={t("intentCanvas.manager.searchPlaceholder")}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </label>
        <div className="intent-canvas-manager-actions">
          <span className="intent-canvas-manager-count">
            <FileText aria-hidden />
            {t("intentCanvas.manager.count", { count: filteredEntries.length })}
          </span>
          <button
            type="button"
            onClick={toggleFilteredCanvasSelection}
            disabled={filteredEntries.length === 0 || status === "loading"}
          >
            {allFilteredEntriesSelected
              ? t("intentCanvas.manager.clearSelection")
              : t("intentCanvas.manager.selectAll")}
          </button>
          <button type="button" onClick={() => void refreshIndex()} disabled={status === "loading"}>
            <RefreshCw aria-hidden className={status === "loading" ? "is-spinning" : undefined} />
            {t("intentCanvas.manager.refresh")}
          </button>
          {onOpenProjectMap ? (
            <button type="button" onClick={onOpenProjectMap}>
              <GitBranch aria-hidden />
              {t("intentCanvas.manager.projectMap")}
            </button>
          ) : null}
          <button type="button" className="is-primary" onClick={() => void createCanvas()}>
            <Plus aria-hidden />
            {t("intentCanvas.manager.newCanvas")}
          </button>
        </div>
      </header>

      {warnings.map((warning) => (
        <p key={warning} className="intent-canvas-warning" role="status">{warning}</p>
      ))}
      {errorMessage ? <p className="intent-canvas-error" role="alert">{errorMessage}</p> : null}
      {selectedEntries.length > 0 ? (
        <div className="intent-canvas-bulk-toolbar" role="status">
          <span>{t("intentCanvas.manager.selectedCount", { count: selectedEntries.length })}</span>
          <div className="intent-canvas-bulk-actions">
            <button type="button" onClick={clearCanvasSelection} disabled={isBulkDeleting}>
              {t("intentCanvas.manager.clearSelection")}
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                setActionPrompt(null);
                setIsBulkDeletePromptOpen(true);
              }}
              disabled={isBulkDeleting}
            >
              <Trash2 aria-hidden />
              {t("intentCanvas.manager.deleteSelected", { count: selectedEntries.length })}
            </button>
          </div>
          {isBulkDeletePromptOpen ? (
            <div className="intent-canvas-action-popover-shell is-bulk">
              <ThreadDeleteConfirmBubble
                threadName={t("intentCanvas.manager.selectedCount", { count: selectedEntries.length })}
                title={t("intentCanvas.manager.bulkDelete")}
                message={t("intentCanvas.manager.bulkDeleteConfirm", { count: selectedEntries.length })}
                hint={t("intentCanvas.manager.bulkDeleteHint")}
                confirmLabel={t("intentCanvas.manager.deleteSelected", { count: selectedEntries.length })}
                isDeleting={isBulkDeleting}
                onCancel={() => setIsBulkDeletePromptOpen(false)}
                onConfirm={() => void confirmBulkDelete()}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "loading" && entries.length === 0 ? (
        <div className="intent-canvas-loading"><LoaderCircle aria-hidden className="is-spinning" /> {t("intentCanvas.loading")}</div>
      ) : filteredEntries.length === 0 ? (
        <div className="intent-canvas-empty-state">
          <FileText aria-hidden />
          <h3>{t("intentCanvas.manager.emptyTitle")}</h3>
          <p>{t("intentCanvas.manager.emptyBody")}</p>
          <button type="button" className="is-primary" onClick={() => void createCanvas()}>
            <Plus aria-hidden />
            {t("intentCanvas.manager.newCanvas")}
          </button>
        </div>
      ) : (
        <div className="intent-canvas-grid" role="list">
          {filteredEntries.map((entry) => (
            <article
              key={entry.id}
              className={cn("intent-canvas-card-tile", selectedCanvasIds.has(entry.id) && "is-selected")}
              role="listitem"
            >
              <label className="intent-canvas-card-selection">
                <input
                  type="checkbox"
                  checked={selectedCanvasIds.has(entry.id)}
                  onChange={() => toggleCanvasSelection(entry.id)}
                  aria-label={t("intentCanvas.manager.selectCanvas", { title: entry.title })}
                />
                <span>{t("intentCanvas.manager.selectCanvasShort")}</span>
              </label>
              <button
                type="button"
                className="intent-canvas-card-open"
                onClick={() => handleCanvasActionRequest(entry, "open")}
              >
                <span className="intent-canvas-card-mode">{entry.mode}</span>
                <h3>{entry.title}</h3>
                <p>{entry.summary || t("intentCanvas.manager.noSummary")}</p>
                <dl>
                  <div><dt>{t("intentCanvas.manager.elements")}</dt><dd>{entry.elementCount}</dd></div>
                  <div><dt>{t("intentCanvas.manager.files")}</dt><dd>{entry.linkedFileCount}</dd></div>
                  <div><dt>{t("intentCanvas.manager.nodes")}</dt><dd>{entry.linkedProjectMapNodeCount}</dd></div>
                </dl>
                <span className="intent-canvas-card-updated">
                  {t("intentCanvas.manager.updated", { time: formatDateTime(entry.updatedAt) })}
                </span>
              </button>
              <div className="intent-canvas-card-actions">
                <button
                  type="button"
                  onClick={() => handleCanvasActionRequest(entry, "duplicate")}
                  aria-label={t("intentCanvas.manager.duplicate")}
                  title={t("intentCanvas.manager.duplicate")}
                >
                  <Copy aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleCanvasActionRequest(entry, "open")}
                  aria-label={t("intentCanvas.manager.open")}
                  title={t("intentCanvas.manager.open")}
                >
                  <LinkIcon aria-hidden />
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => handleCanvasActionRequest(entry, "delete")}
                  aria-label={t("intentCanvas.manager.delete")}
                  title={t("intentCanvas.manager.delete")}
                >
                  <Trash2 aria-hidden />
                </button>
              </div>
              {actionPrompt?.entry.id === entry.id ? (
                <div className="intent-canvas-action-popover-shell">
                  <ThreadDeleteConfirmBubble
                    threadName={entry.title}
                    title={t(`intentCanvas.manager.${actionPrompt.action}`)}
                    message={t(`intentCanvas.manager.${actionPrompt.action}Confirm`, { title: entry.title })}
                    hint={t(`intentCanvas.manager.${actionPrompt.action}Hint`)}
                    confirmLabel={t(`intentCanvas.manager.${actionPrompt.action}`)}
                    isDeleting={confirmingCanvasActionId === entry.id}
                    onCancel={() => setActionPrompt(null)}
                    onConfirm={() => void confirmCanvasAction()}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
