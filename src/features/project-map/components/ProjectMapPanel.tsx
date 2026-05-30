import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, WheelEvent } from "react";
import { useTranslation } from "react-i18next";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ArrowDownRightFromCircle from "lucide-react/dist/esm/icons/arrow-down-right-from-circle";
import ArrowUpLeftFromCircle from "lucide-react/dist/esm/icons/arrow-up-left-from-circle";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import Folder from "lucide-react/dist/esm/icons/folder";
import Globe2 from "lucide-react/dist/esm/icons/globe-2";
import HardDrive from "lucide-react/dist/esm/icons/hard-drive";
import ListChecks from "lucide-react/dist/esm/icons/list-checks";
import RefreshCcw from "lucide-react/dist/esm/icons/refresh-ccw";
import Network from "lucide-react/dist/esm/icons/network";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in";
import ZoomOut from "lucide-react/dist/esm/icons/zoom-out";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { cn } from "../../../lib/utils";
import type { EngineType, ModelOption, WorkspaceInfo } from "../../../types";
import { useProjectMapDataset } from "../hooks/useProjectMapDataset";
import {
  normalizeEngineType,
  useProjectMapGenerationOptions,
} from "../hooks/useProjectMapGenerationOptions";
import type { ProjectMapDatasetController } from "../hooks/useProjectMapDataset";
import {
  PROJECT_MAP_DEFAULT_FOCUS_ZOOM,
  PROJECT_MAP_DEFAULT_OVERVIEW_ZOOM,
  PROJECT_MAP_GRAPH_HEIGHT,
  PROJECT_MAP_GRAPH_WIDTH,
  clampProjectMapGraphZoom,
  buildInteractiveProjectMapLayout,
  buildProjectMapMiniMapProjection,
  buildProjectMapNodeIndex,
  buildProjectMapViewState,
  calculateProjectMapFitViewport,
  getProjectMapCoreNode,
  getSortedProjectMapChildren,
  getVisibleProjectMapLenses,
  normalizeProjectMapProjectionNodes,
  resetProjectMapViewState,
  resolveVisibleProjectMapNodes,
  settleProjectMapLayout,
  type ProjectMapGraphNodePosition,
  type ProjectMapGraphViewport,
} from "../utils/interactiveLayout";
import { PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID } from "../utils/incrementalGeneration";
import {
  formatProjectMapDateTime,
  getProjectMapGenerationQueue,
  getProjectMapRecentRuns,
  translateProjectMapNodeKind,
} from "../utils/display";
import { getProjectMapUnassignedDiscoveryChildren } from "../services/projectMapNodeOrganizer";
import {
  ProjectMapArtifactChip,
  ProjectMapDiagramChip,
  ProjectMapSourceChip,
  normalizeProjectMapArtifactForDisplay,
  type ProjectMapTraceTarget,
} from "./ProjectMapTraceChips";
import {
  ProjectMapGenerationQueueBanner,
  ProjectMapGenerationTaskDrawer,
} from "./ProjectMapTaskDrawer";
import type {
  ProjectMapDataset,
  ProjectMapGenerationRequest,
  ProjectMapCandidate,
  ProjectMapLens,
  ProjectMapLayoutPreset,
  ProjectMapNode,
  ProjectMapPreferredLanguage,
  ProjectMapProfile,
  ProjectMapRelatedArtifact,
  ProjectMapStorageLocation,
} from "../types";

type ProjectMapPanelProps = {
  activeWorkspace?: WorkspaceInfo | null;
  workspaceName?: string | null;
  selectedEngine?: EngineType | null;
  selectedModelId?: string | null;
  models?: ModelOption[];
  dataset?: ProjectMapDataset;
  datasetController?: ProjectMapDatasetController;
  onOpenEvidenceFile?: (path: string, location?: { line: number; column: number }) => void;
};

type GraphViewport = ProjectMapGraphViewport;

type GraphViewSnapshot = {
  focusNodeId: string | null;
  selectedNodeId: string | null;
};

type GraphNodeDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  nodeIds: string[];
  originPositions: Map<string, ProjectMapGraphNodePosition>;
  previewPositions: Map<string, ProjectMapGraphNodePosition>;
  didMove: boolean;
};

const ZOOM_STEP = 0.1;
const MINI_MAP_SIZE = { width: 180, height: 118 };
const DETAIL_PANEL_FOCUS_OFFSET_MIN = 160;
const DETAIL_PANEL_FOCUS_OFFSET_MAX = 240;
const CANVAS_CONTROLS_COLLAPSED_STORAGE_KEY = "ccgui.projectMap.canvasControlsCollapsed";

function readCanvasControlsCollapsedPreference(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return true;
  }

  try {
    const storedValue = window.localStorage.getItem(CANVAS_CONTROLS_COLLAPSED_STORAGE_KEY);
    return storedValue === null ? true : storedValue === "true";
  } catch {
    return true;
  }
}

function writeCanvasControlsCollapsedPreference(collapsed: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(CANVAS_CONTROLS_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // UI preference persistence is best-effort.
  }
}

function normalizePathForComparing(value: string): string {
  return value.replace(/[\\/]+$/g, "").replace(/\\/g, "/");
}

function resolveGenerationWritePath(
  workspacePath: string | null,
  storageKey: string,
  storageLocation: ProjectMapStorageLocation,
  writePath: string,
): string {
  if (storageLocation === "project" && workspacePath) {
    const pathSeparator = workspacePath.includes("\\") ? "\\" : "/";
    const trimmedWorkspacePath = workspacePath.replace(/[\\/]+$/g, "");
    return `${trimmedWorkspacePath}${pathSeparator}.ccgui${pathSeparator}project-map${pathSeparator}${storageKey}`;
  }

  if (storageLocation === "global" && workspacePath) {
    const expected = normalizePathForComparing(
      `${workspacePath.replace(/[\\/]+$/g, "")}/.ccgui/project-map/${storageKey}`,
    );
    const normalized = normalizePathForComparing(writePath);
    const isCaseInsensitive = typeof process !== "undefined" && process.platform === "win32";
    if (isCaseInsensitive ? normalized.toLowerCase() === expected.toLowerCase() : normalized === expected) {
      return `.ccgui/project-map/${storageKey}`;
    }
  }

  return writePath;
}

function resolveSelectedGenerationModel(
  selectedModelId: string | null | undefined,
  models: ModelOption[] | undefined,
): string | null {
  const trimmedSelection = selectedModelId?.trim() ?? "";
  if (!trimmedSelection) {
    return null;
  }
  const matchedModel = models?.find(
    (model) => model.id === trimmedSelection || model.model === trimmedSelection,
  );
  return matchedModel?.model ?? trimmedSelection;
}

function getDetailPanelFocusOffset(input: {
  canvasElement: HTMLDivElement | null;
  isDetailCollapsed: boolean;
}): number {
  if (input.isDetailCollapsed) {
    return 0;
  }

  const detailPanel = input.canvasElement?.querySelector<HTMLElement>(".project-map-detail-panel");
  const detailWidth = detailPanel?.getBoundingClientRect().width ?? 0;
  const fallbackWidth = 478;
  const offset = Math.max(
    DETAIL_PANEL_FOCUS_OFFSET_MIN,
    (detailWidth > 0 ? detailWidth : fallbackWidth) / 2,
  );
  return -Math.min(DETAIL_PANEL_FOCUS_OFFSET_MAX, offset);
}

function buildLensIndex(lenses: ProjectMapLens[]): Map<string, ProjectMapLens> {
  return new Map(lenses.map((lens) => [lens.id, lens]));
}

function buildNeighborSet(
  nodes: ProjectMapNode[],
  selectedNodeId: string | null,
  hoverNodeId: string | null,
  isFocusedView: boolean,
): Set<string> {
  const focusNodeId = hoverNodeId ?? (isFocusedView ? selectedNodeId : null);
  if (!focusNodeId) {
    return new Set(nodes.map((node) => node.id));
  }
  const focusedNode = nodes.find((node) => node.id === focusNodeId);
  if (!focusedNode) {
    return new Set(nodes.map((node) => node.id));
  }
  return new Set([
    focusedNode.id,
    focusedNode.parentId ?? "",
    ...focusedNode.children,
    ...nodes
      .filter((node) => node.children.includes(focusedNode.id))
      .map((node) => node.id),
  ].filter(Boolean));
}

function getDescendantStats(
  node: ProjectMapNode,
  nodeIndex: Map<string, ProjectMapNode>,
): {
  count: number;
  stale: number;
  candidate: number;
} {
  const children = getSortedProjectMapChildren(node, nodeIndex);
  return {
    count: children.length,
    stale: children.filter((child) => child.stale).length,
    candidate: children.filter((child) => child.candidate).length,
  };
}

function getProfileSummary(profile: Partial<ProjectMapProfile> | null | undefined): {
  language: string;
  shapes: string;
} {
  const language =
    typeof profile?.primaryLanguage === "string" && profile.primaryLanguage
      ? profile.primaryLanguage
      : "unknown";
  const shapes =
    Array.isArray(profile?.shapes) && profile.shapes.length > 0
      ? profile.shapes.join(" / ")
      : "unknown";
  return { language, shapes };
}

function resolveProjectMapPreferredLanguage(
  language: string | null | undefined,
): ProjectMapPreferredLanguage {
  return language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function isCandidateAfterCompletedCalibration(
  dataset: ProjectMapDataset,
  node: ProjectMapNode,
): boolean {
  const generatedRun = dataset.runs.find((run) => run.id === node.generatedBy.runId);
  return Boolean(
    node.candidate &&
      generatedRun?.status === "completed" &&
      generatedRun.generationIntent === "calibrateNode" &&
      generatedRun.requestScope?.kind === "node" &&
      generatedRun.requestScope.nodeId === node.id,
  );
}

export function ProjectMapPanel({
  activeWorkspace = null,
  workspaceName,
  selectedEngine = null,
  selectedModelId = null,
  models,
  dataset: controlledDataset,
  datasetController: providedDatasetController,
  onOpenEvidenceFile,
}: ProjectMapPanelProps) {
  const { t, i18n } = useTranslation();
  const preferredLanguage = resolveProjectMapPreferredLanguage(
    i18n.resolvedLanguage ?? i18n.language,
  );
  const selectedGenerationModel = useMemo(
    () => resolveSelectedGenerationModel(selectedModelId, models),
    [models, selectedModelId],
  );
  const generationDefaults = useMemo(
    () => ({
      engine: selectedEngine,
      model: selectedGenerationModel,
    }),
    [selectedEngine, selectedGenerationModel],
  );
  const internalDatasetController = useProjectMapDataset(
    controlledDataset || providedDatasetController ? null : activeWorkspace,
    { generationDefaults, preferredLanguage },
  );
  const datasetController = providedDatasetController ?? internalDatasetController;
  const dataset = controlledDataset ?? datasetController.dataset;
  const projectionNodes = useMemo(
    () => normalizeProjectMapProjectionNodes(dataset.nodes),
    [dataset.nodes],
  );
  const nodeIndex = useMemo(() => buildProjectMapNodeIndex(projectionNodes), [projectionNodes]);
  const visibleLenses = useMemo(() => getVisibleProjectMapLenses(dataset), [dataset]);
  const lensIndex = useMemo(() => buildLensIndex(dataset.lenses), [dataset.lenses]);
  const rootNode = getProjectMapCoreNode(dataset);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => rootNode?.id ?? null,
  );
  const [deleteConfirmNodeId, setDeleteConfirmNodeId] = useState<string | null>(null);
  const [viewHistory, setViewHistory] = useState<GraphViewSnapshot[]>([]);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [isLensStripCollapsed, setIsLensStripCollapsed] = useState(true);
  const [isProjectMapChromeCollapsed, setIsProjectMapChromeCollapsed] = useState(false);
  const [isCanvasControlsCollapsed, setIsCanvasControlsCollapsed] = useState(
    readCanvasControlsCollapsedPreference,
  );
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [candidateBatchMessage, setCandidateBatchMessage] = useState<string | null>(null);
  const [isConfirmingAllCandidates, setIsConfirmingAllCandidates] = useState(false);
  const [selectedGraphNodeIds, setSelectedGraphNodeIds] = useState<Set<string>>(new Set());
  const [dragPreviewPositions, setDragPreviewPositions] = useState<
    Record<string, ProjectMapGraphNodePosition>
  >({});
  const [viewport, setViewport] = useState<GraphViewport>({
    zoom: PROJECT_MAP_DEFAULT_OVERVIEW_ZOOM,
    pan: { x: 0, y: 0 },
  });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const nodeDragRef = useRef<GraphNodeDragState | null>(null);
  const suppressNextNodeClickRef = useRef(false);
  const lastAutoFitGraphKeyRef = useRef<string | null>(null);
  const visibleNodes = useMemo(
    () => resolveVisibleProjectMapNodes(dataset, focusNodeId),
    [dataset, focusNodeId],
  );
  const visibleNodeIdSignature = useMemo(
    () => visibleNodes.map((node) => node.id).join("|"),
    [visibleNodes],
  );
  const autoFitGraphKey = useMemo(
    () =>
      [
        dataset.manifest.storageKey,
        focusNodeId ?? "overview",
        dataset.viewState?.layoutPreset ?? "radial",
        visibleNodeIdSignature,
        isDetailCollapsed ? "detail-collapsed" : "detail-open",
      ].join("::"),
    [
      dataset.manifest.storageKey,
      dataset.viewState?.layoutPreset,
      focusNodeId,
      isDetailCollapsed,
      visibleNodeIdSignature,
    ],
  );
  const selectedNode =
    (selectedNodeId ? nodeIndex.get(selectedNodeId) : null) ??
    (focusNodeId ? nodeIndex.get(focusNodeId) : rootNode) ??
    visibleNodes[0] ??
    null;
  const deleteConfirmNode = deleteConfirmNodeId ? nodeIndex.get(deleteConfirmNodeId) ?? null : null;
  const graphLayout = useMemo(
    () =>
      buildInteractiveProjectMapLayout({
        dataset,
        visibleNodes,
        focusNodeId,
      }),
    [dataset, focusNodeId, visibleNodes],
  );
  const renderGraphLayout = useMemo(() => {
    const previewById = new Map(Object.entries(dragPreviewPositions));
    if (previewById.size === 0) {
      return graphLayout;
    }

    const positions = graphLayout.positions.map((position) => previewById.get(position.id) ?? position);
    const positionById = new Map(positions.map((position) => [position.id, position]));
    const edges = graphLayout.edges.flatMap((edge) => {
      const source = positionById.get(edge.source.id);
      const target = positionById.get(edge.target.id);
      return source && target ? [{ ...edge, source, target }] : [];
    });
    return {
      ...graphLayout,
      positions,
      edges,
    };
  }, [dragPreviewPositions, graphLayout]);
  const miniMapProjection = useMemo(() => {
    if (!renderGraphLayout.rootNodeId) {
      return null;
    }
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    return buildProjectMapMiniMapProjection({
      positions: renderGraphLayout.positions,
      nodes: visibleNodes,
      rootNodeId: renderGraphLayout.rootNodeId,
      viewport,
      canvasSize: {
        width: canvasRect?.width && canvasRect.width > 0 ? canvasRect.width : 1100,
        height: canvasRect?.height && canvasRect.height > 0 ? canvasRect.height : 680,
      },
      miniMapSize: MINI_MAP_SIZE,
    });
  }, [renderGraphLayout, viewport, visibleNodes]);
  const neighborNodeIds = useMemo(
    () => buildNeighborSet(visibleNodes, selectedNode?.id ?? null, hoverNodeId, Boolean(focusNodeId)),
    [focusNodeId, hoverNodeId, selectedNode?.id, visibleNodes],
  );
  const projectName = workspaceName?.trim() || dataset.manifest.projectName;
  const candidateCount =
    dataset.nodes.filter((node) => node.candidate).length +
    (dataset.candidates ?? []).filter((candidate) => candidate.status === "pending").length;
  const unassignedDiscoveryCount = useMemo(
    () => getProjectMapUnassignedDiscoveryChildren(dataset).length,
    [dataset],
  );
  const firstCandidateNode = useMemo(
    () => dataset.nodes.find((node) => node.candidate) ?? null,
    [dataset.nodes],
  );
  const firstPendingReviewCandidate = useMemo(
    () => (dataset.candidates ?? []).find((candidate) => candidate.status === "pending") ?? null,
    [dataset.candidates],
  );
  const pendingCandidateByNodeId = useMemo(() => {
    const entries = new Map<string, ProjectMapCandidate>();
    for (const candidate of dataset.candidates ?? []) {
      if (candidate.status !== "pending") {
        continue;
      }
      const targetNodeId = candidate.targetNodeId ?? candidate.patch.nodeId;
      if (!entries.has(targetNodeId)) {
        entries.set(targetNodeId, candidate);
      }
    }
    return entries;
  }, [dataset.candidates]);
  const staleCount = dataset.nodes.filter((node) => node.stale).length;
  const generationQueue = useMemo(() => getProjectMapGenerationQueue(dataset.runs), [dataset.runs]);
  const recentRuns = useMemo(() => getProjectMapRecentRuns(dataset.runs), [dataset.runs]);
  const activeGenerationRun = generationQueue[0] ?? null;
  const queuedGenerationRuns = generationQueue.slice(1);
  const previousGenerationQueueCountRef = useRef(generationQueue.length);
  const hubNodes = rootNode ? getSortedProjectMapChildren(rootNode, nodeIndex) : [];
  const detectedLensCount = visibleLenses.filter((lens) => lens.status === "detected").length;
  const candidateLensCount = visibleLenses.filter((lens) => lens.status === "candidate").length;
  const activeLens = selectedNode ? lensIndex.get(selectedNode.lensId) ?? null : null;
  const isPersistenceBacked = Boolean(activeWorkspace?.id) && !controlledDataset;
  const profileSummary = getProfileSummary(dataset.profile);
  const previousViewSnapshot = viewHistory.at(-1) ?? null;
  const hasBackToParentFallback = Boolean(focusNodeId);
  const backToPreviousLabel = previousViewSnapshot
    ? t("projectMap.backToPrevious")
    : t("projectMap.backToParent");
  const fitGraphToViewport = useCallback(() => {
    if (!graphLayout.rootNodeId) {
      return;
    }

    const bounds = graphLayout.bounds;
    if (!bounds) {
      return;
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const canvasSize = {
      width: canvasRect?.width && canvasRect.width > 0 ? canvasRect.width : 1100,
      height: canvasRect?.height && canvasRect.height > 0 ? canvasRect.height : 680,
    };
    const fallbackZoom = focusNodeId
      ? PROJECT_MAP_DEFAULT_FOCUS_ZOOM
      : PROJECT_MAP_DEFAULT_OVERVIEW_ZOOM;
    const fittedViewport = calculateProjectMapFitViewport(bounds, canvasSize, fallbackZoom);
    const detailFocusOffset = getDetailPanelFocusOffset({
      canvasElement: canvasRef.current,
      isDetailCollapsed,
    });
    setViewport({
      ...fittedViewport,
      pan: {
        ...fittedViewport.pan,
        x: Number((fittedViewport.pan.x + detailFocusOffset).toFixed(2)),
      },
    });
  }, [focusNodeId, graphLayout.bounds, graphLayout.rootNodeId, isDetailCollapsed]);

  const persistGraphPositions = useCallback(
    async (input: {
      positions: ProjectMapGraphNodePosition[];
      preset?: ProjectMapLayoutPreset;
      pinnedNodeIds: Set<string>;
      updatedAt: string;
    }) => {
      const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
      await datasetController.updateDataset((currentDataset) => {
        const currentLayouts = currentDataset.viewState?.nodeLayouts ?? {};
        const retainedLayouts = Object.fromEntries(
          Object.entries(currentLayouts).filter(([nodeId]) => !visibleNodeIds.has(nodeId)),
        );
        return {
          ...currentDataset,
          manifest: {
            ...currentDataset.manifest,
            updatedAt: input.updatedAt,
          },
          viewState: {
            ...buildProjectMapViewState({
              current: currentDataset.viewState,
              preset: input.preset,
              positions: input.positions,
              pinnedNodeIds: input.pinnedNodeIds,
              updatedAt: input.updatedAt,
            }),
            nodeLayouts: {
              ...retainedLayouts,
              ...buildProjectMapViewState({
                current: currentDataset.viewState,
                preset: input.preset,
                positions: input.positions,
                pinnedNodeIds: input.pinnedNodeIds,
                updatedAt: input.updatedAt,
              }).nodeLayouts,
            },
          },
        };
      });
    },
    [datasetController, visibleNodes],
  );

  const clearGraphInteractionDraft = useCallback(() => {
    nodeDragRef.current = null;
    panStartRef.current = null;
    suppressNextNodeClickRef.current = false;
    setDragPreviewPositions({});
  }, []);

  const handleCanvasControlsToggle = useCallback(() => {
    setIsCanvasControlsCollapsed((current) => {
      const nextCollapsed = !current;
      writeCanvasControlsCollapsedPreference(nextCollapsed);
      return nextCollapsed;
    });
  }, []);

  const handleAutoLayout = useCallback(() => {
    if (!renderGraphLayout.rootNodeId) {
      return;
    }
    clearGraphInteractionDraft();
    const currentPinnedNodeIds = new Set(
      Object.entries(dataset.viewState?.nodeLayouts ?? {})
        .filter(([, layout]) => layout.pinned === true)
        .map(([nodeId]) => nodeId),
    );
    const settledPositions = settleProjectMapLayout({
      positions: renderGraphLayout.positions,
      nodes: visibleNodes,
      rootNodeId: renderGraphLayout.rootNodeId,
      preservePinned: true,
    });
    void persistGraphPositions({
      positions: settledPositions,
      pinnedNodeIds: currentPinnedNodeIds,
      updatedAt: new Date().toISOString(),
    });
  }, [clearGraphInteractionDraft, dataset.viewState?.nodeLayouts, persistGraphPositions, renderGraphLayout, visibleNodes]);

  const handleResetLayout = useCallback(() => {
    const updatedAt = new Date().toISOString();
    clearGraphInteractionDraft();
    void datasetController.updateDataset((currentDataset) => ({
      ...currentDataset,
      manifest: {
        ...currentDataset.manifest,
        updatedAt,
      },
      viewState: resetProjectMapViewState(currentDataset.viewState, updatedAt),
    }));
    setSelectedGraphNodeIds(new Set());
  }, [clearGraphInteractionDraft, datasetController]);

  const handleLayoutPresetChange = useCallback(
    (preset: ProjectMapLayoutPreset) => {
      clearGraphInteractionDraft();
      const currentPinnedNodeIds = new Set(
        Object.entries(dataset.viewState?.nodeLayouts ?? {})
          .filter(([, layout]) => layout.pinned === true)
          .map(([nodeId]) => nodeId),
      );
      const presetLayout = buildInteractiveProjectMapLayout({
        dataset: {
          ...dataset,
          viewState: {
            layoutPreset: preset,
            nodeLayouts: Object.fromEntries(
              Object.entries(dataset.viewState?.nodeLayouts ?? {}).filter(
                ([, layout]) => layout.pinned === true,
              ),
            ),
            updatedAt: dataset.viewState?.updatedAt,
          },
        },
        visibleNodes,
        focusNodeId,
        preset,
      });
      void persistGraphPositions({
        positions: presetLayout.positions,
        preset,
        pinnedNodeIds: currentPinnedNodeIds,
        updatedAt: new Date().toISOString(),
      });
    },
    [clearGraphInteractionDraft, dataset, focusNodeId, persistGraphPositions, visibleNodes],
  );

  useEffect(() => {
    if (generationQueue.length > previousGenerationQueueCountRef.current) {
      setIsTaskDrawerOpen(true);
    }
    previousGenerationQueueCountRef.current = generationQueue.length;
  }, [generationQueue.length]);

  useEffect(() => {
    if (!graphLayout.rootNodeId || !graphLayout.bounds) {
      return;
    }
    if (lastAutoFitGraphKeyRef.current === autoFitGraphKey) {
      return;
    }
    lastAutoFitGraphKeyRef.current = autoFitGraphKey;
    fitGraphToViewport();
  }, [autoFitGraphKey, fitGraphToViewport, graphLayout.bounds, graphLayout.rootNodeId]);

  useEffect(() => {
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    setSelectedGraphNodeIds((current) => {
      const nextSelection = new Set(
        [...current].filter((nodeId) => visibleNodeIds.has(nodeId)),
      );
      return nextSelection.size === current.size ? current : nextSelection;
    });
  }, [visibleNodes]);

  const handleNodeSelect = (node: ProjectMapNode) => {
    setHoverNodeId(null);
    setSelectedNodeId(node.id);
    setIsDetailCollapsed(false);
    setSelectedGraphNodeIds(new Set([node.id]));
  };

  const rememberCurrentView = () => {
    const snapshot: GraphViewSnapshot = {
      focusNodeId,
      selectedNodeId,
    };
    setViewHistory((current) => {
      const lastSnapshot = current.at(-1);
      if (
        lastSnapshot?.focusNodeId === snapshot.focusNodeId &&
        lastSnapshot.selectedNodeId === snapshot.selectedNodeId
      ) {
        return current;
      }
      return [...current.slice(-7), snapshot];
    });
  };

  const handleDrillIn = (node: ProjectMapNode | null) => {
    if (!node || node.children.length === 0 || node.id === rootNode?.id || focusNodeId === node.id) {
      return;
    }
    rememberCurrentView();
    setHoverNodeId(null);
    setSelectedNodeId(node.id);
    setFocusNodeId(node.id);
  };

  const handleDrillUp = (node: ProjectMapNode | null) => {
    if (!node?.parentId || node.parentId === rootNode?.id) {
      handleBackToOverview();
      return;
    }

    setHoverNodeId(null);
    setSelectedNodeId(node.parentId);
    setFocusNodeId(node.parentId);
  };

  const handleBackToOverview = () => {
    setFocusNodeId(null);
    setSelectedNodeId(rootNode?.id ?? null);
    setHoverNodeId(null);
    setViewHistory([]);
  };

  const handleBackToPreviousView = () => {
    if (previousViewSnapshot) {
      setFocusNodeId(previousViewSnapshot.focusNodeId);
      setSelectedNodeId(previousViewSnapshot.selectedNodeId ?? rootNode?.id ?? null);
      setHoverNodeId(null);
      setViewHistory((current) => current.slice(0, -1));
      return;
    }

    if (!focusNodeId) {
      return;
    }

    handleDrillUp(nodeIndex.get(focusNodeId) ?? null);
  };

  const handleCandidateReviewClick = () => {
    const targetNodeId =
      firstPendingReviewCandidate?.targetNodeId ??
      firstPendingReviewCandidate?.patch.nodeId ??
      firstCandidateNode?.id ??
      null;
    if (!targetNodeId) {
      return;
    }
    const targetNode = nodeIndex.get(targetNodeId) ?? null;
    if (!targetNode) {
      return;
    }

    setHoverNodeId(null);
    setSelectedNodeId(targetNode.id);
    setFocusNodeId(
      targetNode.parentId && targetNode.parentId !== rootNode?.id
        ? targetNode.parentId
        : null,
    );
    setIsDetailCollapsed(false);
  };

  const handleConfirmAllCandidatesClick = async () => {
    setIsConfirmingAllCandidates(true);
    setCandidateBatchMessage(null);
    try {
      const result = await datasetController.confirmAllCandidates();
      setCandidateBatchMessage(
        t("projectMap.confirmAllCandidatesResult", {
          confirmed: result.confirmed,
          skipped: result.skipped,
        }),
      );
    } finally {
      setIsConfirmingAllCandidates(false);
    }
  };

  const handleRequestDeleteSelectedNode = () => {
    if (!selectedNode) {
      return;
    }
    setDeleteConfirmNodeId(selectedNode.id);
  };

  const handleConfirmDeleteNode = async () => {
    if (!deleteConfirmNode) {
      setDeleteConfirmNodeId(null);
      return;
    }

    const parentId = deleteConfirmNode.parentId ?? null;
    const deleted = await datasetController.deleteNode(deleteConfirmNode.id);
    if (!deleted) {
      return;
    }
    setHoverNodeId(null);
    setSelectedNodeId(parentId);
    setFocusNodeId(parentId && parentId !== rootNode?.id ? parentId : null);
    if (!parentId) {
      setViewHistory([]);
    }
    setDeleteConfirmNodeId(null);
  };

  const handleOpenTraceTarget = useCallback(
    (target: ProjectMapTraceTarget) => {
      onOpenEvidenceFile?.(
        target.path,
        target.line ? { line: target.line, column: 1 } : undefined,
      );
    },
    [onOpenEvidenceFile],
  );

  const updateZoom = (nextZoom: number) => {
    setViewport((current) => ({
      ...current,
      zoom: clampProjectMapGraphZoom(nextZoom),
    }));
  };

  const handleCanvasPointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if ((event.target as HTMLElement).closest("button, aside, .project-map-node")) {
      return;
    }
    panStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.pan.x,
      originY: viewport.pan.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const updateNodeDragPreview = (
    event: PointerEvent<HTMLDivElement>,
  ): boolean => {
    const nodeDrag = nodeDragRef.current;
    if (!nodeDrag || nodeDrag.pointerId !== event.pointerId) {
      return false;
    }

    const deltaX = (event.clientX - nodeDrag.startClientX) / viewport.zoom;
    const deltaY = (event.clientY - nodeDrag.startClientY) / viewport.zoom;
    nodeDrag.didMove = nodeDrag.didMove || Math.hypot(deltaX, deltaY) > 3;
    const previewEntries = nodeDrag.nodeIds.flatMap((nodeId) => {
      const originPosition = nodeDrag.originPositions.get(nodeId);
      if (!originPosition) {
        return [];
      }
      return [
        [
          nodeId,
          {
            ...originPosition,
            x: Number((originPosition.x + deltaX).toFixed(2)),
            y: Number((originPosition.y + deltaY).toFixed(2)),
            pinned: true,
          },
        ] as const,
      ];
    });
    nodeDrag.previewPositions = new Map(previewEntries);
    setDragPreviewPositions(
      Object.fromEntries(previewEntries),
    );
    return true;
  };

  const finishNodeDrag = (event: PointerEvent<HTMLDivElement>): boolean => {
    const nodeDrag = nodeDragRef.current;
    if (!nodeDrag || nodeDrag.pointerId !== event.pointerId) {
      return false;
    }

    nodeDragRef.current = null;
    const draggedPositions = nodeDrag.nodeIds.flatMap((nodeId) => {
      const previewPosition = nodeDrag.previewPositions.get(nodeId);
      const originPosition = nodeDrag.originPositions.get(nodeId);
      return previewPosition ?? originPosition ?? [];
    });
    setSelectedGraphNodeIds(new Set(nodeDrag.nodeIds));
    suppressNextNodeClickRef.current = nodeDrag.didMove;
    if (draggedPositions.length > 0) {
      void persistGraphPositions({
        positions: draggedPositions,
        pinnedNodeIds: new Set(nodeDrag.nodeIds),
        updatedAt: new Date().toISOString(),
      }).finally(() => {
        setDragPreviewPositions({});
      });
    } else {
      setDragPreviewPositions({});
    }
    return true;
  };

  const handleCanvasPointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (updateNodeDragPreview(event)) {
      return;
    }

    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    setViewport((current) => ({
      ...current,
      pan: {
        x: start.originX + event.clientX - start.startX,
        y: start.originY + event.clientY - start.startY,
      },
    }));
  };

  const handleCanvasPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (finishNodeDrag(event)) {
      return;
    }

    if (panStartRef.current?.pointerId === event.pointerId) {
      panStartRef.current = null;
    }
  };

  const handleCanvasWheel = (event: WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, aside")) {
      return;
    }

    event.preventDefault();
    const canvasRect = event.currentTarget.getBoundingClientRect();
    const anchor = {
      x: event.clientX - canvasRect.left - canvasRect.width / 2,
      y: event.clientY - canvasRect.top - canvasRect.height / 2,
    };
    const zoomDelta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;

    setViewport((current) => {
      const nextZoom = clampProjectMapGraphZoom(current.zoom + zoomDelta);
      if (nextZoom === current.zoom) {
        return current;
      }

      const anchoredGraphPoint = {
        x: (anchor.x - current.pan.x) / current.zoom,
        y: (anchor.y - current.pan.y) / current.zoom,
      };

      return {
        zoom: nextZoom,
        pan: {
          x: Number((anchor.x - anchoredGraphPoint.x * nextZoom).toFixed(2)),
          y: Number((anchor.y - anchoredGraphPoint.y * nextZoom).toFixed(2)),
        },
      };
    });
  };

  const handleNodeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    node: ProjectMapNode,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleNodeSelect(node);
  };

  const handleNodePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    node: ProjectMapNode,
  ) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    event.stopPropagation();
    const positionById = new Map(renderGraphLayout.positions.map((position) => [position.id, position]));
    const nodeIds = selectedGraphNodeIds.has(node.id)
      ? [...selectedGraphNodeIds].filter((nodeId) => positionById.has(nodeId))
      : [node.id];
    const originPositions = new Map(
      nodeIds.flatMap((nodeId) => {
        const position = positionById.get(nodeId);
        return position ? [[nodeId, position]] : [];
      }),
    );
    if (originPositions.size === 0) {
      return;
    }

    nodeDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      nodeIds,
      originPositions,
      previewPositions: new Map(),
      didMove: false,
    };
    setSelectedNodeId(node.id);
    setIsDetailCollapsed(false);
    setSelectedGraphNodeIds(new Set(nodeIds));
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleNodePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (updateNodeDragPreview(event)) {
      event.stopPropagation();
    }
  };

  const handleNodePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (finishNodeDrag(event)) {
      event.stopPropagation();
    }
  };

  const handleNodeClick = (
    event: MouseEvent<HTMLDivElement>,
    node: ProjectMapNode,
  ) => {
    if (suppressNextNodeClickRef.current) {
      suppressNextNodeClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.shiftKey || event.metaKey) {
      setHoverNodeId(null);
      setSelectedNodeId(node.id);
      setIsDetailCollapsed(false);
      setSelectedGraphNodeIds((current) => {
        const nextSelection = new Set(current);
        if (nextSelection.has(node.id)) {
          nextSelection.delete(node.id);
        } else {
          nextSelection.add(node.id);
        }
        if (nextSelection.size === 0) {
          nextSelection.add(node.id);
        }
        return nextSelection;
      });
      return;
    }

    handleNodeSelect(node);
  };

  const handleMiniMapClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!miniMapProjection) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const graphPoint = miniMapProjection.unprojectPoint({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    const graphCenter = {
      x: PROJECT_MAP_GRAPH_WIDTH / 2,
      y: PROJECT_MAP_GRAPH_HEIGHT / 2,
    };
    setViewport((current) => ({
      ...current,
      pan: {
        x: Number((-(graphPoint.x - graphCenter.x) * current.zoom).toFixed(2)),
        y: Number((-(graphPoint.y - graphCenter.y) * current.zoom).toFixed(2)),
      },
    }));
  };

  const handleNodeDrillClick = (
    event: MouseEvent<HTMLButtonElement>,
    node: ProjectMapNode,
  ) => {
    event.stopPropagation();
    handleNodeSelect(node);
    handleDrillIn(node);
  };

  const handleNodeDrillUpClick = (
    event: MouseEvent<HTMLButtonElement>,
    node: ProjectMapNode,
  ) => {
    event.stopPropagation();
    handleDrillUp(node);
  };

  return (
    <section
      className={cn("project-map-panel", isProjectMapChromeCollapsed && "is-chrome-collapsed")}
      aria-label={t("projectMap.panelTitle")}
    >
      <header className={cn("project-map-topbar", isProjectMapChromeCollapsed && "is-collapsed")}>
        {isProjectMapChromeCollapsed ? (
          <>
            <div className="project-map-compact-title">
              <strong>{projectName}</strong>
              <span>{t("projectMap.compactSummary", { nodes: dataset.nodes.length, lenses: detectedLensCount })}</span>
            </div>
            <button
              className="project-map-toolbar-action project-map-chrome-toggle"
              type="button"
              aria-expanded={false}
              onClick={() => setIsProjectMapChromeCollapsed(false)}
            >
              <ChevronDown aria-hidden />
              {t("projectMap.expandChrome")}
            </button>
          </>
        ) : (
          <>
            <div className="project-map-header-copy">
              <div className="project-map-title-line">
                <span className="project-map-eyebrow">{t("projectMap.eyebrow")}</span>
                <h2>{t("projectMap.title", { projectName })}</h2>
              </div>
              <div className="project-map-meta-row">
                <span className="project-map-meta-pill is-primary">
                  {t("projectMap.lastGenerated", {
                    value: formatProjectMapDateTime(dataset.manifest.updatedAt),
                  })}
                </span>
                <span className="project-map-meta-pill">
                  {t("projectMap.storageKey", { value: dataset.manifest.storageKey })}
                </span>
                <span className="project-map-meta-pill is-profile">
                  {t("projectMap.profileSummary", {
                    language: profileSummary.language,
                    shapes: profileSummary.shapes,
                  })}
                </span>
              </div>
            </div>
            <div className="project-map-actions" role="group" aria-label={t("projectMap.chromeControls")}>
              <button
                className="project-map-toolbar-action project-map-chrome-toggle"
                type="button"
                aria-expanded
                onClick={() => setIsProjectMapChromeCollapsed(true)}
              >
                <ChevronUp aria-hidden />
                {t("projectMap.collapseChrome")}
              </button>
              {isPersistenceBacked ? (
                <div
                  className="project-map-storage-switch"
                  role="group"
                  aria-label={t("projectMap.storage.readLocation")}
                >
                  <span className="project-map-storage-label">
                    <HardDrive aria-hidden />
                    {t("projectMap.storage.readLocation")}
                  </span>
                  <button
                    type="button"
                    className={cn(datasetController.activeReadLocation === "global" && "is-active")}
                    aria-pressed={datasetController.activeReadLocation === "global"}
                    onClick={() => datasetController.switchReadLocation("global")}
                  >
                    <Globe2 aria-hidden />
                    {t("projectMap.storage.global")}
                  </button>
                  <button
                    type="button"
                    className={cn(datasetController.activeReadLocation === "project" && "is-active")}
                    aria-pressed={datasetController.activeReadLocation === "project"}
                    onClick={() => datasetController.switchReadLocation("project")}
                  >
                    <Folder aria-hidden />
                    {t("projectMap.storage.project")}
                  </button>
                </div>
              ) : null}
              {candidateCount > 0 ? (
                <>
                  <button
                    className="project-map-candidate-badge"
                    type="button"
                    onClick={handleCandidateReviewClick}
                    title={t("projectMap.candidateBadgeHint")}
                  >
                    {t("projectMap.candidateBadge", { count: candidateCount })}
                  </button>
                  <button
                    className="project-map-confirm-all-candidates"
                    type="button"
                    onClick={() => {
                      void handleConfirmAllCandidatesClick();
                    }}
                    disabled={isConfirmingAllCandidates}
                    title={t("projectMap.confirmAllCandidatesHint")}
                  >
                    {isConfirmingAllCandidates
                      ? t("projectMap.confirmingAllCandidates")
                      : t("projectMap.confirmAllCandidates")}
                  </button>
                </>
              ) : null}
              <button
                className={cn(
                  "project-map-toolbar-action project-map-task-button",
                  generationQueue.length > 0 && "has-active-task",
                )}
                type="button"
                aria-expanded={isTaskDrawerOpen}
                onClick={() => setIsTaskDrawerOpen((current) => !current)}
              >
                <ListChecks aria-hidden />
                {t("projectMap.tasks.button")}
                <span>{generationQueue.length}</span>
              </button>
              <button
                className="project-map-toolbar-action project-map-profile-action"
                type="button"
                onClick={datasetController.openGlobalCollection}
              >
                <Sparkles aria-hidden />
                {t("projectMap.collectFramework")}
              </button>
              {unassignedDiscoveryCount > 0 ? (
                <button
                  className="project-map-toolbar-action project-map-profile-action"
                  type="button"
                  onClick={() => {
                    datasetController.openUnassignedOrganizer();
                  }}
                >
                  <Sparkles aria-hidden />
                  {t("projectMap.organizeUnassigned", { count: unassignedDiscoveryCount })}
                </button>
              ) : null}
            </div>
          </>
        )}
      </header>

      <main className="project-map-stage" aria-label={t("projectMap.stageAria")}>
        {activeGenerationRun ? (
          <ProjectMapGenerationQueueBanner
            activeRun={activeGenerationRun}
            queuedCount={queuedGenerationRuns.length}
          />
        ) : null}
        {!isProjectMapChromeCollapsed ? (
          <div className={cn("project-map-lens-shell", isLensStripCollapsed && "is-collapsed")}>
            <div className="project-map-stage-toolbar">
              <div className="project-map-breadcrumb" aria-label={t("projectMap.breadcrumb")}>
                <button type="button" onClick={handleBackToOverview}>
                  <Network aria-hidden />
                  {t("projectMap.breadcrumbRoot")}
                </button>
                {activeLens && focusNodeId ? (
                  <>
                    <span>/</span>
                    <strong>{activeLens.title}</strong>
                  </>
                ) : null}
              </div>
              <div className="project-map-stage-stats">
                <span>{t("projectMap.totalNodes", { count: dataset.nodes.length })}</span>
                <span>{t("projectMap.lensStats", { detected: detectedLensCount, candidate: candidateLensCount })}</span>
                <span>{t("projectMap.staleNodes", { count: staleCount })}</span>
                <span>{t("projectMap.candidateNodes", { count: candidateCount })}</span>
                <button
                  className="project-map-lens-toggle"
                  type="button"
                  aria-expanded={!isLensStripCollapsed}
                  onClick={() => setIsLensStripCollapsed((current) => !current)}
                >
                  {isLensStripCollapsed ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
                  {isLensStripCollapsed ? t("projectMap.expandLenses") : t("projectMap.collapseLenses")}
                </button>
              </div>
            </div>

            {!isLensStripCollapsed ? (
              <div className="project-map-domain-strip" aria-label={t("projectMap.domainStrip")}>
                <button
                  className={cn("project-map-domain-chip", !focusNodeId && "is-active")}
                  type="button"
                  onClick={handleBackToOverview}
                >
                  <span>{t("projectMap.breadcrumbRoot")}</span>
                </button>
                {hubNodes.map((node) => (
                  <button
                    key={node.id}
                    className={cn("project-map-domain-chip", focusNodeId === node.id && "is-active")}
                    type="button"
                    onClick={() => {
                      handleNodeSelect(node);
                      handleDrillIn(node);
                      setIsLensStripCollapsed(true);
                    }}
                  >
                    <span>{lensIndex.get(node.lensId)?.shortTitle ?? node.lensId}</span>
                    <strong>{node.title}</strong>
                    <em>{t(`projectMap.lensStatus.${lensIndex.get(node.lensId)?.status ?? "candidate"}`)}</em>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {candidateBatchMessage ? (
          <div className="project-map-inline-status" role="status">
            {candidateBatchMessage}
          </div>
        ) : null}

        {datasetController.status === "error" && !controlledDataset ? (
          <div className="project-map-empty-state">
            <Crosshair aria-hidden />
            <h3>{t("projectMap.loadErrorTitle")}</h3>
            <p>{datasetController.error}</p>
            <button className="project-map-primary-button" type="button" onClick={datasetController.reload}>
              <RefreshCw aria-hidden />
              {t("projectMap.retryLoad")}
            </button>
          </div>
        ) : visibleNodes.length === 0 ? (
          <div className="project-map-empty-state">
            <Crosshair aria-hidden />
            <h3>{t("projectMap.emptyTitle")}</h3>
            <p>{t("projectMap.emptyDescription")}</p>
            <button
              className="project-map-empty-action"
              type="button"
              onClick={datasetController.openGlobalCollection}
            >
              <Sparkles aria-hidden />
              {t("projectMap.collectFramework")}
            </button>
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="project-map-graph-canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerEnd}
            onPointerCancel={handleCanvasPointerEnd}
            onWheel={handleCanvasWheel}
          >
            <div
              className={cn(
                "project-map-canvas-control-group",
                isCanvasControlsCollapsed && "is-collapsed",
              )}
              role="group"
              aria-label={t("projectMap.canvasControls")}
            >
              <button
                type="button"
                className="project-map-canvas-controls-toggle"
                onClick={handleCanvasControlsToggle}
                aria-expanded={!isCanvasControlsCollapsed}
                aria-label={
                  isCanvasControlsCollapsed
                    ? t("projectMap.expandCanvasControls")
                    : t("projectMap.collapseCanvasControls")
                }
              >
                {isCanvasControlsCollapsed ? <ChevronRight aria-hidden /> : <ChevronDown aria-hidden />}
                <span>{t("projectMap.layoutPreset")}</span>
              </button>
              {!isCanvasControlsCollapsed ? (
                <div className="project-map-canvas-controls-content">
                  <button
                    type="button"
                    onClick={() => updateZoom(viewport.zoom - ZOOM_STEP)}
                    aria-label={t("projectMap.zoomOut")}
                  >
                    <ZoomOut aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={fitGraphToViewport}
                  >
                    {t("projectMap.resetView")}
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoLayout}
                  >
                    {t("projectMap.autoLayout")}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetLayout}
                  >
                    {t("projectMap.resetLayout")}
                  </button>
                  <label className="project-map-layout-preset">
                    <span>{t("projectMap.layoutPreset")}</span>
                    <select
                      value={dataset.viewState?.layoutPreset ?? "radial"}
                      aria-label={t("projectMap.layoutPreset")}
                      onChange={(event) =>
                        handleLayoutPresetChange(event.currentTarget.value as ProjectMapLayoutPreset)
                      }
                    >
                      <option value="radial">{t("projectMap.layoutPresetRadial")}</option>
                      <option value="tree">{t("projectMap.layoutPresetTree")}</option>
                      <option value="force">{t("projectMap.layoutPresetForce")}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => updateZoom(viewport.zoom + ZOOM_STEP)}
                    aria-label={t("projectMap.zoomIn")}
                  >
                    <ZoomIn aria-hidden />
                  </button>
                  {previousViewSnapshot || hasBackToParentFallback ? (
                    <button
                      type="button"
                      onClick={handleBackToPreviousView}
                    >
                      <ArrowLeft aria-hidden />
                      {backToPreviousLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div
              className="project-map-graph-viewport"
              style={{
                transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
              }}
            >
              <svg
                className="project-map-graph-lines"
                viewBox={`0 0 ${PROJECT_MAP_GRAPH_WIDTH} ${PROJECT_MAP_GRAPH_HEIGHT}`}
                aria-hidden
              >
                {renderGraphLayout.edges.map((edge) => {
                  const isFocused =
                    neighborNodeIds.has(edge.source.id) &&
                    neighborNodeIds.has(edge.target.id);
                  return (
                    <line
                      key={edge.id}
                      x1={edge.source.x}
                      y1={edge.source.y}
                      x2={edge.target.x}
                      y2={edge.target.y}
                      className={cn("project-map-edge", isFocused && "is-focused")}
                    />
                  );
                })}
              </svg>
              {renderGraphLayout.positions.map((position) => {
                const node = nodeIndex.get(position.id);
                if (!node) {
                  return null;
                }
                const isSelected = selectedNode?.id === node.id;
                const isGroupSelected = selectedGraphNodeIds.has(node.id);
                const isFocused = neighborNodeIds.has(node.id);
                const isHub = node.parentId === rootNode?.id;
                const descendantStats = getDescendantStats(node, nodeIndex);
                return (
                  <div
                    key={node.id}
                    className={cn(
                      "project-map-node",
                      isHub && "is-hub",
                      node.id === rootNode?.id && "is-core",
                      `confidence-${node.confidence}`,
                      node.stale && "is-stale",
                      node.candidate && "is-candidate",
                      isSelected && "is-selected",
                      isGroupSelected && "is-group-selected",
                      position.pinned && "is-pinned",
                      !isFocused && "is-dimmed",
                    )}
                    role="button"
                    tabIndex={0}
                    style={{ left: position.x, top: position.y }}
                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                    onPointerMove={handleNodePointerMove}
                    onPointerUp={handleNodePointerEnd}
                    onPointerCancel={handleNodePointerEnd}
                    onClick={(event) => handleNodeClick(event, node)}
                    onKeyDown={(event) => handleNodeKeyDown(event, node)}
                    onDoubleClick={() => handleDrillIn(node)}
                    onMouseEnter={() => setHoverNodeId(node.id)}
                    onMouseLeave={() => setHoverNodeId(null)}
                    aria-pressed={isSelected}
                    aria-label={`${t("projectMap.nodeAria", { title: node.title })}: ${node.title}`}
                  >
                    <span className="project-map-node-kind">
                      {translateProjectMapNodeKind(t, node.nodeKind)}
                    </span>
                    <strong>{node.title}</strong>
                    <span>{lensIndex.get(node.lensId)?.shortTitle ?? node.lensId}</span>
                    <span className="project-map-node-status">
                      {node.stale ? t("projectMap.status.stale") : t("projectMap.status.current")}
                      {" · "}
                      {t(`projectMap.confidence.${node.confidence}`)}
                    </span>
                    {descendantStats.count > 0 ? (
                      <span className="project-map-node-counts">
                        {t("projectMap.nodeCounts", {
                          count: descendantStats.count,
                          stale: descendantStats.stale,
                          candidate: descendantStats.candidate,
                        })}
                      </span>
                    ) : null}
                    <span className="project-map-node-drill-actions">
                      {focusNodeId === node.id && node.parentId ? (
                        <button
                          className="project-map-node-drill-action is-up"
                          type="button"
                          onClick={(event) => handleNodeDrillUpClick(event, node)}
                          aria-label={t("projectMap.drillUpNode", { title: node.title })}
                          title={t("projectMap.drillUp")}
                        >
                          <ArrowUpLeftFromCircle aria-hidden />
                        </button>
                      ) : null}
                      {node.children.length > 0 && node.id !== rootNode?.id ? (
                        <button
                          className="project-map-node-drill-action is-down"
                          type="button"
                          onClick={(event) => handleNodeDrillClick(event, node)}
                          aria-label={t("projectMap.drillDownNode", { title: node.title })}
                          title={t("projectMap.drillDown")}
                        >
                          <ArrowDownRightFromCircle aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
            {miniMapProjection ? (
              <button
                className="project-map-mini-map"
                type="button"
                aria-label={t("projectMap.miniMap")}
                onClick={handleMiniMapClick}
                style={{
                  width: MINI_MAP_SIZE.width,
                  height: MINI_MAP_SIZE.height,
                }}
              >
                <svg
                  viewBox={`0 0 ${MINI_MAP_SIZE.width} ${MINI_MAP_SIZE.height}`}
                  aria-hidden
                >
                  <rect
                    className="project-map-mini-map-viewport"
                    x={miniMapProjection.viewport.left}
                    y={miniMapProjection.viewport.top}
                    width={Math.max(
                      8,
                      miniMapProjection.viewport.right - miniMapProjection.viewport.left,
                    )}
                    height={Math.max(
                      8,
                      miniMapProjection.viewport.bottom - miniMapProjection.viewport.top,
                    )}
                  />
                  {miniMapProjection.dots.map((dot) => (
                    <circle
                      key={dot.id}
                      className={cn(
                        "project-map-mini-map-dot",
                        dot.pinned && "is-pinned",
                        selectedGraphNodeIds.has(dot.id) && "is-selected",
                      )}
                      cx={dot.x}
                      cy={dot.y}
                      r={selectedGraphNodeIds.has(dot.id) ? 4 : 3}
                    />
                  ))}
                </svg>
              </button>
            ) : null}

            <DetailPanel
              node={selectedNode}
              dataset={dataset}
              pendingCandidate={
                selectedNode ? pendingCandidateByNodeId.get(selectedNode.id) ?? null : null
              }
              lens={selectedNode ? lensIndex.get(selectedNode.lensId) ?? null : null}
              staleCount={staleCount}
              unassignedDiscoveryCount={unassignedDiscoveryCount}
              pendingReviewCandidateCount={(dataset.candidates ?? []).filter((candidate) => candidate.status === "pending").length}
              canDrill={Boolean(selectedNode?.children.length && selectedNode.id !== rootNode?.id)}
              collapsed={isDetailCollapsed}
              onCollapsedChange={setIsDetailCollapsed}
              onBack={focusNodeId ? handleBackToOverview : null}
              onBackToPrevious={previousViewSnapshot || hasBackToParentFallback ? handleBackToPreviousView : null}
              backToPreviousLabel={backToPreviousLabel}
              onDrill={() => handleDrillIn(selectedNode)}
              onCompleteNode={() => selectedNode ? datasetController.openNodeGeneration("node", selectedNode) : undefined}
              onCalibrateNode={() => selectedNode ? datasetController.openNodeGeneration("calibrate", selectedNode) : undefined}
              onOrganizeUnassigned={datasetController.openUnassignedOrganizer}
              onConfirmCandidate={(candidateId) => {
                void datasetController.confirmCandidate(candidateId);
              }}
              onRejectCandidate={(candidateId) => {
                void datasetController.rejectCandidate(candidateId);
              }}
              onConfirmNodeCandidate={(nodeId) => {
                void datasetController.confirmNodeCandidate(nodeId);
              }}
              onRejectNodeCandidate={(nodeId) => {
                void datasetController.rejectNodeCandidate(nodeId);
              }}
              onDeleteNode={selectedNode ? handleRequestDeleteSelectedNode : null}
              onOpenTrace={onOpenEvidenceFile ? handleOpenTraceTarget : undefined}
            />
          </div>
        )}
      </main>
      <ProjectMapSettingsPanel
        activeWorkspace={activeWorkspace}
        dataset={dataset}
        disabled={!isPersistenceBacked}
        onUpdate={datasetController.updateDataset}
      />
      <GenerationConfirmationDialog
        activeWorkspace={activeWorkspace}
        request={datasetController.pendingRequest}
        storageKey={dataset.manifest.storageKey}
        onCancel={datasetController.closeGenerationRequest}
        onConfirm={datasetController.confirmGenerationRequest}
      />
      <DeleteNodeConfirmDialog
        node={deleteConfirmNode}
        onCancel={() => setDeleteConfirmNodeId(null)}
        onConfirm={() => {
          void handleConfirmDeleteNode();
        }}
      />
      {isTaskDrawerOpen ? (
        <ProjectMapGenerationTaskDrawer
          activeRun={activeGenerationRun}
          queuedRuns={queuedGenerationRuns}
          recentRuns={recentRuns}
          nodeIndex={nodeIndex}
          onCancelRun={datasetController.cancelGenerationRun}
          onClearFinished={datasetController.clearFinishedRuns}
          onClose={() => setIsTaskDrawerOpen(false)}
        />
      ) : null}
    </section>
  );
}

function DetailPanel({
  node,
  dataset,
  pendingCandidate,
  lens,
  staleCount,
  unassignedDiscoveryCount,
  pendingReviewCandidateCount,
  canDrill,
  collapsed,
  onCollapsedChange,
  onBack,
  onBackToPrevious,
  backToPreviousLabel,
  onDrill,
  onCompleteNode,
  onCalibrateNode,
  onOrganizeUnassigned,
  onConfirmCandidate,
  onRejectCandidate,
  onConfirmNodeCandidate,
  onRejectNodeCandidate,
  onDeleteNode,
  onOpenTrace,
}: {
  node: ProjectMapNode | null;
  dataset: ProjectMapDataset;
  pendingCandidate: ProjectMapCandidate | null;
  lens: ProjectMapLens | null;
  staleCount: number;
  unassignedDiscoveryCount: number;
  pendingReviewCandidateCount: number;
  canDrill: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onBack: (() => void) | null;
  onBackToPrevious: (() => void) | null;
  backToPreviousLabel: string;
  onDrill: () => void;
  onCompleteNode: () => void;
  onCalibrateNode: () => void;
  onOrganizeUnassigned: () => void;
  onConfirmCandidate: (candidateId: string) => void;
  onRejectCandidate: (candidateId: string) => void;
  onConfirmNodeCandidate: (nodeId: string) => void;
  onRejectNodeCandidate: (nodeId: string) => void;
  onDeleteNode: (() => void) | null;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  const { t } = useTranslation();
  const isCalibratedCandidate = node
    ? isCandidateAfterCompletedCalibration(dataset, node)
    : false;
  const moveSuggestedParent = pendingCandidate?.move?.suggestedParentId
    ? dataset.nodes.find((candidateNode) => candidateNode.id === pendingCandidate.move?.suggestedParentId) ?? null
    : null;
  const isUnassignedDiscoveriesNode = node?.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID;

  return (
    <aside
      className={cn("project-map-detail-panel", collapsed && "is-collapsed")}
      aria-label={t("projectMap.detailPanel")}
    >
      <div
        className="project-map-detail-control-group"
        role="group"
        aria-label={t("projectMap.viewNavigation")}
      >
        <button
          className="project-map-detail-toggle"
          type="button"
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? <ChevronLeft aria-hidden /> : <ChevronRight aria-hidden />}
          <span>
            {collapsed
              ? t("projectMap.expandDetail")
              : t("projectMap.collapseDetail")}
          </span>
        </button>
        {!collapsed && onBackToPrevious ? (
          <button
            className="project-map-back-button is-previous"
            type="button"
            onClick={onBackToPrevious}
          >
            <ArrowLeft aria-hidden />
            <span>{backToPreviousLabel}</span>
          </button>
        ) : null}
        {!collapsed && onBack ? (
          <button className="project-map-back-button" type="button" onClick={onBack}>
            <Network aria-hidden />
            <span>{t("projectMap.backToOverview")}</span>
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <div className="project-map-detail-peek">
          <span className="project-map-node-kind">
            {node ? translateProjectMapNodeKind(t, node.nodeKind) : t("projectMap.inspector")}
          </span>
          <strong>{node?.title ?? t("projectMap.emptyInspector")}</strong>
        </div>
      ) : null}
      {!collapsed ? (
        <>
          {node ? (
            <>
          <div className="project-map-inspector-heading">
            <span className="project-map-node-kind">{translateProjectMapNodeKind(t, node.nodeKind)}</span>
            <h3>{node.title}</h3>
            <p>{node.summary}</p>
            <div className="project-map-inspector-badges">
              {lens ? <span>{lens.title}</span> : null}
              {lens ? <span>{t(`projectMap.lensStatus.${lens.status}`)}</span> : null}
              <span className={`confidence-${node.confidence}`}>
                {t(`projectMap.confidence.${node.confidence}`)}
              </span>
              {node.stale ? <span>{t("projectMap.status.stale")}</span> : null}
              {node.candidate ? <span>{t("projectMap.status.candidate")}</span> : null}
            </div>
          </div>
          {node.candidate || pendingCandidate ? (
            <section className="project-map-candidate-notice">
              <h4>
                {t(
                  isCalibratedCandidate
                    ? "projectMap.candidateNotice.calibratedTitle"
                    : "projectMap.candidateNotice.title",
                )}
              </h4>
              <p>
                {pendingCandidate?.kind === "parentMove" && moveSuggestedParent
                  ? t("projectMap.candidateNotice.parentMoveBody", {
                      parent: moveSuggestedParent.title,
                      reason: pendingCandidate.move?.reason ?? "-",
                    })
                  : t(
                      isCalibratedCandidate
                        ? "projectMap.candidateNotice.calibratedBody"
                        : "projectMap.candidateNotice.body",
                    )}
              </p>
              <div className="project-map-candidate-actions">
                <button
                  type="button"
                  className="is-primary"
                  onClick={() =>
                    pendingCandidate
                      ? onConfirmCandidate(pendingCandidate.id)
                      : onConfirmNodeCandidate(node.id)
                  }
                >
                  {t("projectMap.candidateNotice.confirm")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    pendingCandidate
                      ? onRejectCandidate(pendingCandidate.id)
                      : onRejectNodeCandidate(node.id)
                  }
                >
                  {t("projectMap.candidateNotice.reject")}
                </button>
              </div>
            </section>
          ) : null}
          {isUnassignedDiscoveriesNode ? (
            <section className="project-map-candidate-notice">
              <h4>{t("projectMap.unassignedOrganizer.title")}</h4>
              <p>
                {t("projectMap.unassignedOrganizer.body", {
                  count: unassignedDiscoveryCount,
                  candidates: pendingReviewCandidateCount,
                })}
              </p>
              <div className="project-map-candidate-actions">
                <button
                  type="button"
                  className="is-primary"
                  disabled={unassignedDiscoveryCount === 0}
                  onClick={onOrganizeUnassigned}
                >
                  {t("projectMap.unassignedOrganizer.organize")}
                </button>
              </div>
            </section>
          ) : null}

          <section>
            <h4>{t("projectMap.detail.coreDescription")}</h4>
            <p>{node.detail.coreDescription}</p>
          </section>
          <InspectorList
            title={t("projectMap.detail.keyFacts")}
            items={node.detail.keyFacts}
          />
          <InspectorList
            title={t("projectMap.detail.keyLogic")}
            items={node.detail.keyLogic}
          />
          <InspectorList
            title={t("projectMap.detail.riskSignals")}
            items={node.detail.riskSignals}
            emptyLabel={t("projectMap.none")}
          />
          {(node.detail.diagramArtifacts ?? []).length > 0 ? (
            <section>
              <h4>{t("projectMap.detail.diagrams")}</h4>
              <div className="project-map-artifact-list">
                {(node.detail.diagramArtifacts ?? []).map((diagram) => (
                  <ProjectMapDiagramChip
                    key={`${diagram.id}-${diagram.path}`}
                    diagram={diagram}
                    onOpenTrace={onOpenTrace}
                  />
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h4>{t("projectMap.detail.relatedArtifacts")}</h4>
            <div className="project-map-artifact-list">
              {node.detail.relatedArtifacts
                .map(normalizeProjectMapArtifactForDisplay)
                .filter((artifact): artifact is ProjectMapRelatedArtifact => Boolean(artifact))
                .map((artifact) => (
                  <ProjectMapArtifactChip
                    key={`${artifact.type}-${artifact.label}-${artifact.path ?? artifact.ref ?? ""}`}
                    artifact={artifact}
                    onOpenTrace={onOpenTrace}
                  />
                ))}
            </div>
          </section>
          <section>
            <h4>{t("projectMap.evidenceTitle")}</h4>
            <div className="project-map-source-list">
              {node.sources.map((source) => (
                <ProjectMapSourceChip
                  key={`${source.type}-${source.label}-${source.path ?? source.hash ?? ""}`}
                  source={source}
                  onOpenTrace={onOpenTrace}
                />
              ))}
            </div>
          </section>
          <section>
            <h4>{t("projectMap.detail.generation")}</h4>
            <dl className="project-map-definition-grid">
              <div>
                <dt>{t("projectMap.detail.lastGeneratedAt")}</dt>
                <dd>{formatProjectMapDateTime(node.lastGeneratedAt)}</dd>
              </div>
              <div>
                <dt>{t("projectMap.detail.generatedBy")}</dt>
                <dd>
                  {node.generatedBy.engine} / {node.generatedBy.model}
                </dd>
              </div>
              <div>
                <dt>{t("projectMap.runLogTitle")}</dt>
                <dd>
                  {t("projectMap.runLogSummary", {
                    runId: dataset.runs[0]?.id ?? "-",
                    stale: staleCount,
                  })}
                </dd>
              </div>
            </dl>
          </section>
          <div className="project-map-node-actions">
            {canDrill ? (
              <button type="button" onClick={onDrill}>
                {t("projectMap.drillIn")}
              </button>
            ) : null}
            <button type="button" onClick={onCompleteNode}>{t("projectMap.completeNode")}</button>
            <button type="button" onClick={onCalibrateNode}>{t("projectMap.calibrateNode")}</button>
            {onDeleteNode ? (
              <button className="is-danger" type="button" onClick={onDeleteNode}>
                <Trash2 aria-hidden />
                {t("projectMap.deleteNode")}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p>{t("projectMap.emptyInspector")}</p>
      )}
      </>
      ) : null}
    </aside>
  );
}

function InspectorList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
}) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </section>
  );
}

function ProjectMapSettingsPanel({
  activeWorkspace,
  dataset,
  disabled,
  onUpdate,
}: {
  activeWorkspace: WorkspaceInfo | null;
  dataset: ProjectMapDataset;
  disabled: boolean;
  onUpdate: (updater: (dataset: ProjectMapDataset) => ProjectMapDataset) => Promise<void>;
}) {
  const { t } = useTranslation();
  const settings = dataset.autoIngestionSettings;
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [isSavingEnablement, setIsSavingEnablement] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<EngineType>(() =>
    normalizeEngineType(settings.engine),
  );
  const [selectedModel, setSelectedModel] = useState(settings.model);
  const generationOptions = useProjectMapGenerationOptions({
    workspace: activeWorkspace,
    selectedEngine,
  });

  useEffect(() => {
    if (isConfiguratorOpen) {
      return;
    }
    setSelectedEngine(normalizeEngineType(settings.engine));
    setSelectedModel(settings.model);
  }, [isConfiguratorOpen, settings.engine, settings.model]);

  useEffect(() => {
    if (!isConfiguratorOpen || generationOptions.modelsLoading) {
      return;
    }
    if (generationOptions.models.length === 0) {
      setSelectedModel("");
      return;
    }
    const selectedModelStillExists = generationOptions.models.some(
      (model) => model.model === selectedModel || model.id === selectedModel,
    );
    if (selectedModelStillExists) {
      return;
    }
    const defaultModel =
      generationOptions.models.find((model) => model.isDefault) ?? generationOptions.models[0];
    setSelectedModel(defaultModel?.model ?? "");
  }, [generationOptions.models, generationOptions.modelsLoading, isConfiguratorOpen, selectedModel]);

  const selectedModelOption =
    generationOptions.models.find((model) => model.model === selectedModel) ??
    generationOptions.models.find((model) => model.id === selectedModel) ??
    null;
  const canEnableAutoIngestion =
    !disabled &&
    !isSavingEnablement &&
    !generationOptions.modelsLoading &&
    generationOptions.models.length > 0 &&
    Boolean(selectedModelOption);

  const closeConfigurator = () => {
    setIsConfiguratorOpen(false);
    setSelectedEngine(normalizeEngineType(settings.engine));
    setSelectedModel(settings.model);
  };

  return (
    <section className="project-map-settings" aria-label={t("projectMap.settings.title")}>
      <div>
        <strong>{t("projectMap.settings.title")}</strong>
        <span>{t("projectMap.settings.subtitle")}</span>
      </div>
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            if (enabled) {
              setSelectedEngine(normalizeEngineType(settings.engine));
              setSelectedModel(settings.model);
              setIsConfiguratorOpen(true);
              return;
            }
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                enabled: false,
              },
            }));
          }}
        />
        {t("projectMap.settings.autoIngestion")}
      </label>
      <label>
        {t("projectMap.settings.threshold")}
        <input
          type="number"
          aria-label={t("projectMap.settings.threshold")}
          min={1}
          max={50}
          value={settings.newSessionThreshold}
          disabled={disabled}
          onChange={(event) => {
            const nextThreshold = Math.max(1, Math.min(50, Number(event.currentTarget.value) || 5));
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                newSessionThreshold: nextThreshold,
              },
            }));
          }}
        />
        <span className="project-map-settings-unit" aria-hidden>
          {t("projectMap.settings.thresholdUnit")}
        </span>
      </label>
      <label>
        {t("projectMap.settings.interval")}
        <input
          type="number"
          aria-label={t("projectMap.settings.interval")}
          min={5}
          max={1440}
          value={settings.checkIntervalMinutes}
          disabled={disabled}
          onChange={(event) => {
            const nextInterval = Math.max(5, Math.min(1440, Number(event.currentTarget.value) || 30));
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                checkIntervalMinutes: nextInterval,
              },
            }));
          }}
        />
        <span className="project-map-settings-unit" aria-hidden>
          {t("projectMap.settings.intervalUnit")}
        </span>
      </label>
      <label>
        {t("projectMap.settings.applyMode")}
        <select
          value={settings.applyMode}
          disabled={disabled}
          onChange={(event) => {
            const applyMode =
              event.currentTarget.value === "autoApplyEvidenceBacked"
                ? "autoApplyEvidenceBacked"
                : "createCandidate";
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                applyMode,
              },
            }));
          }}
        >
          <option value="createCandidate">{t("projectMap.settings.createCandidate")}</option>
          <option value="autoApplyEvidenceBacked">{t("projectMap.settings.autoApplyEvidenceBacked")}</option>
        </select>
      </label>
      {isConfiguratorOpen ? (
        <div className="project-map-auto-ingestion-popover" role="presentation">
          <section
            className="project-map-auto-ingestion-dialog"
            role="dialog"
            aria-label={t("projectMap.settings.configureAutoIngestion")}
          >
            <header>
              <h3>{t("projectMap.settings.configureAutoIngestion")}</h3>
              <p>{t("projectMap.settings.configureAutoIngestionSubtitle")}</p>
            </header>
            <div className="project-map-auto-ingestion-fields">
              <div className="project-map-auto-ingestion-field">
                <label htmlFor="project-map-auto-ingestion-engine">
                  {t("projectMap.settings.engine")}
                </label>
                <div className="project-map-auto-ingestion-control">
                  <select
                    id="project-map-auto-ingestion-engine"
                    className="project-map-dialog-control"
                    value={selectedEngine}
                    aria-label={t("projectMap.settings.engine")}
                    onChange={(event) => setSelectedEngine(normalizeEngineType(event.currentTarget.value))}
                  >
                    {generationOptions.engines.map((engine) => (
                      <option key={engine.id} value={engine.id} disabled={!engine.installed}>
                        {engine.label}
                      </option>
                    ))}
                  </select>
                  {generationOptions.enginesLoading ? (
                    <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingEngines")}</span>
                  ) : null}
                  {generationOptions.enginesError ? (
                    <span className="project-map-dialog-warning">{generationOptions.enginesError}</span>
                  ) : null}
                </div>
              </div>
              <div className="project-map-auto-ingestion-field">
                <label htmlFor="project-map-auto-ingestion-model">
                  {t("projectMap.settings.model")}
                </label>
                <div className="project-map-auto-ingestion-control project-map-auto-ingestion-model-control">
                  <div className="project-map-auto-ingestion-model-row">
                    <select
                      id="project-map-auto-ingestion-model"
                      className="project-map-dialog-control"
                      value={selectedModel}
                      aria-label={t("projectMap.settings.model")}
                      onChange={(event) => setSelectedModel(event.currentTarget.value)}
                      disabled={generationOptions.modelsLoading || generationOptions.models.length === 0}
                    >
                      {generationOptions.models.map((model) => (
                        <option key={`${model.id}-${model.model}`} value={model.model}>
                          {model.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="project-map-dialog-refresh"
                      type="button"
                      onClick={() => void generationOptions.refreshModels()}
                      disabled={generationOptions.modelsLoading}
                    >
                      <RefreshCcw aria-hidden />
                      {t("projectMap.confirmation.refreshModels")}
                    </button>
                  </div>
                  {generationOptions.modelsLoading ? (
                    <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingModels")}</span>
                  ) : null}
                  {!generationOptions.modelsLoading && generationOptions.models.length === 0 ? (
                    <span className="project-map-dialog-warning">
                      {generationOptions.modelsError ?? t("projectMap.confirmation.noModels")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <footer>
              <button type="button" onClick={closeConfigurator} disabled={isSavingEnablement}>
                {t("projectMap.settings.cancelEnable")}
              </button>
              <button
                className="project-map-primary-button"
                type="button"
                disabled={!canEnableAutoIngestion}
                onClick={() => {
                  const resolvedModel = selectedModelOption?.model ?? selectedModel.trim();
                  setIsSavingEnablement(true);
                  void onUpdate((current) => ({
                    ...current,
                    autoIngestionSettings: {
                      ...current.autoIngestionSettings,
                      enabled: true,
                      engine: selectedEngine,
                      model: resolvedModel,
                    },
                  }))
                    .then(() => setIsConfiguratorOpen(false))
                    .finally(() => setIsSavingEnablement(false));
                }}
              >
                <Sparkles aria-hidden />
                {isSavingEnablement
                  ? t("projectMap.settings.enablingAutoIngestion")
                  : t("projectMap.settings.confirmEnable")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function DeleteNodeConfirmDialog({
  node,
  onCancel,
  onConfirm,
}: {
  node: ProjectMapNode | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const isOpen = Boolean(node);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <AlertDialogPopup className="project-map-delete-dialog" bottomStickOnMobile={false}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("projectMap.confirmDeleteNodeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("projectMap.confirmDeleteNode", { title: node?.title ?? "" })}
          </AlertDialogDescription>
          <p className="project-map-delete-dialog-warning">
            {t("projectMap.confirmDeleteNodeWarning")}
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter className="project-map-delete-dialog-footer">
          <button className="project-map-delete-dialog-secondary" type="button" onClick={onCancel}>
            {t("projectMap.confirmDeleteNodeCancel")}
          </button>
          <button className="project-map-delete-dialog-danger" type="button" onClick={onConfirm}>
            <Trash2 aria-hidden />
            {t("projectMap.confirmDeleteNodeConfirm")}
          </button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

function GenerationConfirmationDialog({
  activeWorkspace,
  request,
  storageKey,
  onCancel,
  onConfirm,
}: {
  activeWorkspace: WorkspaceInfo | null;
  request: ProjectMapGenerationRequest | null;
  storageKey: string;
  onCancel: () => void;
  onConfirm: (requestOverride?: ProjectMapGenerationRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<EngineType>(() =>
    normalizeEngineType(request?.engine),
  );
  const [selectedModel, setSelectedModel] = useState(request?.model ?? "default");
  const [selectedStorageLocation, setSelectedStorageLocation] =
    useState<ProjectMapStorageLocation>(() => request?.storageLocation ?? "global");
  const generationOptions = useProjectMapGenerationOptions({
    workspace: activeWorkspace,
    selectedEngine,
  });
  const isOrganizerRequest = request?.generationIntent === "organizeUnassigned";

  useEffect(() => {
    if (!request) {
      return;
    }
    setSelectedEngine(normalizeEngineType(request.engine));
    setSelectedModel(request.model);
    setSelectedStorageLocation(request.storageLocation);
    setIsConfirming(false);
  }, [request]);

  useEffect(() => {
    if (!request || generationOptions.modelsLoading) {
      return;
    }
    if (generationOptions.models.length === 0) {
      setSelectedModel("");
      return;
    }
    const selectedModelStillExists = generationOptions.models.some(
      (model) => model.model === selectedModel || model.id === selectedModel,
    );
    if (selectedModelStillExists) {
      return;
    }
    const defaultModel =
      generationOptions.models.find((model) => model.isDefault) ?? generationOptions.models[0];
    setSelectedModel(defaultModel?.model ?? "");
  }, [generationOptions.models, generationOptions.modelsLoading, request, selectedModel]);

  if (!request) {
    return null;
  }

  const selectedModelOption =
    generationOptions.models.find((model) => model.model === selectedModel) ??
    generationOptions.models.find((model) => model.id === selectedModel) ??
    null;
  const resolvedWritePath = request
    ? resolveGenerationWritePath(
        activeWorkspace?.path ?? null,
        storageKey,
        selectedStorageLocation,
        request.writePath,
      )
    : "";
  const canConfirm =
    !isConfirming &&
    !generationOptions.modelsLoading &&
    generationOptions.models.length > 0 &&
    Boolean(selectedModelOption);
  const confirmedRequest: ProjectMapGenerationRequest = {
    ...request,
    engine: selectedEngine,
    model: selectedModelOption?.model ?? selectedModel.trim(),
    storageLocation: selectedStorageLocation,
    writePath: resolvedWritePath,
  };

  return (
    <div className="project-map-dialog-backdrop" role="presentation">
      <section
        className="project-map-dialog project-map-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("projectMap.confirmation.title")}
      >
        <header>
          <h3>
            {t(
              isOrganizerRequest
                ? "projectMap.confirmation.organizerTitle"
                : "projectMap.confirmation.title",
            )}
          </h3>
          <p>
            {t(
              isOrganizerRequest
                ? "projectMap.confirmation.organizerSubtitle"
                : "projectMap.confirmation.subtitle",
            )}
          </p>
        </header>
        <dl className="project-map-definition-grid project-map-confirmation-grid">
          <div className="project-map-confirmation-row">
            <dt>{t("projectMap.confirmation.engine")}</dt>
            <dd>
              <select
                className="project-map-dialog-control"
                value={selectedEngine}
                aria-label={t("projectMap.confirmation.engine")}
                onChange={(event) => setSelectedEngine(normalizeEngineType(event.currentTarget.value))}
              >
                {generationOptions.engines.map((engine) => (
                  <option key={engine.id} value={engine.id} disabled={!engine.installed}>
                    {engine.label}
                  </option>
                ))}
              </select>
              {generationOptions.enginesLoading ? (
                <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingEngines")}</span>
              ) : null}
              {generationOptions.enginesError ? (
                <span className="project-map-dialog-warning">{generationOptions.enginesError}</span>
              ) : null}
            </dd>
          </div>
          <div className="project-map-confirmation-row">
            <dt>{t("projectMap.confirmation.model")}</dt>
            <dd>
              <div className="project-map-confirmation-model-row">
                <select
                  className="project-map-dialog-control"
                  value={selectedModel}
                  aria-label={t("projectMap.confirmation.model")}
                  onChange={(event) => setSelectedModel(event.currentTarget.value)}
                  disabled={generationOptions.modelsLoading || generationOptions.models.length === 0}
                >
                  {generationOptions.models.map((model) => (
                    <option key={`${model.id}-${model.model}`} value={model.model}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                <button
                  className="project-map-dialog-refresh project-map-dialog-refresh-inline"
                  type="button"
                  onClick={() => void generationOptions.refreshModels()}
                  disabled={generationOptions.modelsLoading}
                >
                  <RefreshCcw aria-hidden />
                  <span>{t("projectMap.confirmation.refreshModels")}</span>
                </button>
              </div>
              {generationOptions.modelsLoading ? (
                <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingModels")}</span>
              ) : null}
              {!generationOptions.modelsLoading && generationOptions.models.length === 0 ? (
                <span className="project-map-dialog-warning">
                  {generationOptions.modelsError ?? t("projectMap.confirmation.noModels")}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="project-map-confirmation-row">
            <dt>{t("projectMap.confirmation.scope")}</dt>
            <dd>
              {request.scope.kind === "organizer"
                ? t("projectMap.confirmation.organizerScope", {
                    count: request.scope.unassignedCount,
                  })
                : request.scope.kind}
            </dd>
          </div>
          <div className="project-map-confirmation-row">
            <dt>{t("projectMap.confirmation.storageLocation")}</dt>
            <dd className="project-map-confirmation-radio-group">
              <label>
                <input
                  type="radio"
                  name="projectMapStorageLocation"
                  value="global"
                  checked={selectedStorageLocation === "global"}
                  onChange={() => setSelectedStorageLocation("global")}
                />
                {t("projectMap.confirmation.storageLocationGlobal")}
              </label>
              <label>
                <input
                  type="radio"
                  name="projectMapStorageLocation"
                  value="project"
                  checked={selectedStorageLocation === "project"}
                  onChange={() => setSelectedStorageLocation("project")}
                />
                {t("projectMap.confirmation.storageLocationProject")}
              </label>
            </dd>
          </div>
          <div className="project-map-confirmation-row">
            <dt>{t("projectMap.confirmation.writePath")}</dt>
            <dd>
              <code className="project-map-confirmation-path">{resolvedWritePath}</code>
            </dd>
          </div>
        </dl>
        <section className="project-map-confirmation-sources">
          <h4>{t("projectMap.confirmation.readSources")}</h4>
          <div className="project-map-source-list">
            {request.readSources.slice(0, 8).map((source) => (
              <ProjectMapSourceChip
                key={`${source.type}-${source.label}-${source.path ?? source.hash ?? ""}`}
                source={source}
              />
            ))}
            {request.readSources.length === 0 ? (
              <span className="project-map-dialog-hint">
                {t("projectMap.confirmation.noReadSources")}
              </span>
            ) : null}
          </div>
        </section>
        <footer>
          <button type="button" onClick={onCancel} disabled={isConfirming}>
            {t("projectMap.confirmation.cancel")}
          </button>
          <button
            className="project-map-primary-button"
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              setIsConfirming(true);
              void onConfirm(confirmedRequest).finally(() => setIsConfirming(false));
            }}
          >
            <Sparkles aria-hidden />
            {isConfirming
              ? t(
                  isOrganizerRequest
                    ? "projectMap.confirmation.organizerConfirming"
                    : "projectMap.confirmation.confirming",
                )
              : t(
                  isOrganizerRequest
                    ? "projectMap.confirmation.organizerConfirm"
                    : "projectMap.confirmation.confirm",
                )}
          </button>
        </footer>
      </section>
    </div>
  );
}
