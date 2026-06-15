import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb";
import ListChecks from "lucide-react/dist/esm/icons/list-checks";
import ListFilter from "lucide-react/dist/esm/icons/list-filter";
import Network from "lucide-react/dist/esm/icons/network";
import RadioTower from "lucide-react/dist/esm/icons/radio-tower";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

import { cn } from "../../../lib/utils";
import type { EngineType, ModelOption, WorkspaceInfo } from "../../../types";
import {
  buildProjectMapOrchestrationTaskDraft,
  loadOrchestrationTaskStore,
  saveOrchestrationTaskStore,
  upsertOrchestrationTask,
} from "../../agent-orchestration";
import { loadProjectMapStyles } from "../../../styles/featureStyleLoaders";
import { useProjectMapDataset } from "../hooks/useProjectMapDataset";
import type { ProjectMapDatasetController } from "../hooks/useProjectMapDataset";
import { useProjectMapGraphInteractionHandlers } from "../hooks/useProjectMapGraphInteractionHandlers";
import { useProjectMapIntentCanvasHandlers } from "../hooks/useProjectMapIntentCanvasHandlers";
import {
  PROJECT_MAP_DEFAULT_FOCUS_ZOOM,
  PROJECT_MAP_DEFAULT_OVERVIEW_ZOOM,
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
} from "../utils/interactiveLayout";
import {
  formatProjectMapDateTime,
  getProjectMapGenerationQueue,
  getProjectMapRecentRuns,
} from "../utils/display";
import { buildProjectMapExplainPack } from "../utils/contextBuilder";
import { buildProjectMapImpactAnalysis } from "../utils/impactAnalysis";
import {
  getProjectMapNodeStaleReasons,
  classifyProjectMapRefresh,
} from "../utils/refreshClassifier";
import {
  repairProjectMapGraphIntegrity,
  validateProjectMapGraphIntegrity,
} from "../utils/graphIntegrity";
import {
  explainProjectMapAssociationPath,
  buildProjectMapShortestPath,
  searchProjectMapNodes,
  searchProjectMapGrouped,
} from "../utils/navigation";
import { buildProjectMapActivityProjection } from "../utils/activityProjection";
import { buildProjectMapHighlightProjection } from "../utils/highlightProjection";
import { buildProjectMapAdvisorHints } from "../utils/advisorProjections";
import {
  buildProjectMapRelationIndex,
  filterProjectMapRelations,
  type ProjectMapRelationDirectionFilter,
} from "../utils/relationIndex";
import { getProjectMapUnassignedDiscoveryChildren } from "../services/projectMapNodeOrganizer";
import { type ProjectMapTraceTarget } from "./ProjectMapTraceChips";
import {
  ProjectMapRelationshipSection,
  type ProjectMapRelationshipSummaryState,
} from "./ProjectMapRelationshipSection";
import { ProjectMapGenerationTaskDrawer } from "./ProjectMapTaskDrawer";
import { ProjectMapStorageSwitch } from "./ProjectMapStorageSwitch";
import {
  ProjectMapAdvisorHintsPanel,
  ProjectMapGroupedQueryPanel,
  ProjectMapNavigationHistoryChips,
  ProjectMapRecentActivityPanel,
  type ProjectMapNavigationHistoryItem,
} from "./ProjectMapWorkbenchPanels";
import { ProjectMapGraphCanvas } from "./ProjectMapGraphCanvas";
import {
  DeleteNodeConfirmDialog,
  DetailPanel,
  GenerationConfirmationDialog,
  ProjectMapNavigationPanel,
  ProjectMapRelationLegendPanel,
  ProjectMapSettingsPanel,
} from "./ProjectMapPanelSurfaces";
import {
  buildProjectMapEvidenceFileIndex,
} from "../utils/evidenceFileIndex";
import type { IntentCanvasOpenRequest } from "../../intent-canvas";
import type { IntentCanvasCodeSelectionAnchor } from "../../intent-canvas/types";
import type { ProjectMapHierarchyRelationView } from "./ProjectMapPanelSurfaces";
import type { ProjectMapOrchestrationDraftState } from "./ProjectMapPanelSurfaces";
import {
  MINI_MAP_SIZE,
  PROJECT_MAP_RELATION_FILTER_ALL,
  appendUniqueLocalHistory,
  buildLensIndex,
  buildNeighborSet,
  getDetailPanelFocusOffset,
  getProfileSummary,
  normalizeLocalHistoryLabel,
  readCanvasControlsCollapsedPreference,
  resolveProjectMapOrchestrationWorkspaceId,
  resolveProjectMapPreferredLanguage,
  resolveSelectedGenerationModel,
  writeCanvasControlsCollapsedPreference,
  type GraphNodeDragState,
  type GraphViewSnapshot,
  type GraphViewport,
  type ProjectMapVisibleSectionState,
} from "./projectMapPanelModel";
import type {
  ProjectMapDataset,
  ProjectMapGraphRepairSummary,
  ProjectMapCandidate,
  ProjectMapLayoutPreset,
  ProjectMapNode,
  ProjectMapImpactSourceMetadata,
  ProjectMapQuickFilterId,
  ProjectMapAdvisorHint,
  ProjectMapQueryResult,
} from "../types";

type ProjectMapPanelProps = {
  activeWorkspace?: WorkspaceInfo | null;
  workspaceName?: string | null;
  selectedEngine?: EngineType | null;
  selectedModelId?: string | null;
  models?: ModelOption[];
  dataset?: ProjectMapDataset;
  datasetController?: ProjectMapDatasetController;
  changedFilePaths?: string[];
  changedFileSource?: ProjectMapImpactSourceMetadata;
  sourceFocusNodeId?: string | null;
  activeCodeSelectionAnchor?: IntentCanvasCodeSelectionAnchor | null;
  onOpenEvidenceFile?: (path: string, location?: { line: number; column: number }) => void;
  onOpenOrchestrationTask?: (taskId: string) => void;
  onOpenIntentCanvas?: (request: Omit<IntentCanvasOpenRequest, "requestId">) => void;
  onOpenIntentCanvasFromRelationship?: (request: Omit<IntentCanvasOpenRequest, "requestId">) => void;
};

export function ProjectMapPanel({
  activeWorkspace = null,
  workspaceName,
  selectedEngine = null,
  selectedModelId = null,
  models,
  dataset: controlledDataset,
  datasetController: providedDatasetController,
  changedFilePaths = [],
  changedFileSource,
  sourceFocusNodeId = null,
  activeCodeSelectionAnchor = null,
  onOpenEvidenceFile,
  onOpenOrchestrationTask,
  onOpenIntentCanvas,
}: ProjectMapPanelProps) {
  useEffect(() => {
    void loadProjectMapStyles();
  }, []);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [relationTypeFilter, setRelationTypeFilter] = useState(PROJECT_MAP_RELATION_FILTER_ALL);
  const [relationSourceKindFilter, setRelationSourceKindFilter] = useState(PROJECT_MAP_RELATION_FILTER_ALL);
  const [relationDirectionFilter, setRelationDirectionFilter] =
    useState<ProjectMapRelationDirectionFilter>("all");
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [pathSourceNodeId, setPathSourceNodeId] = useState<string | null>(null);
  const [pathTargetNodeId, setPathTargetNodeId] = useState<string | null>(null);
  const pathEndpointsEditedByUserRef = useRef(false);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [isLensStripCollapsed, setIsLensStripCollapsed] = useState(true);
  const [isProjectMapChromeCollapsed, setIsProjectMapChromeCollapsed] = useState(false);
  const [isNavigationPanelExpanded, setIsNavigationPanelExpanded] = useState(false);
  const [isQueryPanelExpanded, setIsQueryPanelExpanded] = useState(false);
  const [isActivityPanelExpanded, setIsActivityPanelExpanded] = useState(false);
  const [isFileRelationPanelExpanded, setIsFileRelationPanelExpanded] = useState(false);
  const [isRelationPanelExpanded, setIsRelationPanelExpanded] = useState(false);
  const [isAdvisorPanelExpanded, setIsAdvisorPanelExpanded] = useState(false);
  const [isGraphHealthExpanded, setIsGraphHealthExpanded] = useState(false);
  const [isCanvasControlsCollapsed, setIsCanvasControlsCollapsed] = useState(
    readCanvasControlsCollapsedPreference,
  );
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [candidateBatchMessage, setCandidateBatchMessage] = useState<string | null>(null);
  const [orchestrationDraftState, setOrchestrationDraftState] =
    useState<ProjectMapOrchestrationDraftState>({ status: "idle" });
  const [graphRepairSummary, setGraphRepairSummary] =
    useState<ProjectMapGraphRepairSummary | null>(dataset.graphRepair ?? null);
  const [isConfirmingAllCandidates, setIsConfirmingAllCandidates] = useState(false);
  const [selectedGraphNodeIds, setSelectedGraphNodeIds] = useState<Set<string>>(new Set());
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<ProjectMapQuickFilterId>>(new Set());
  const [selectedAdvisorHintId, setSelectedAdvisorHintId] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [navigationHistory, setNavigationHistory] = useState<ProjectMapNavigationHistoryItem[]>([]);
  const [relationshipSummaryState, setRelationshipSummaryState] =
    useState<ProjectMapRelationshipSummaryState>({ status: "idle" });
  const [relationshipScanRequestId, setRelationshipScanRequestId] = useState(0);
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
  const lastSourceFocusNodeIdRef = useRef<string | null>(null);

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
  const selectedNavigationNodeId = selectedNode?.id ?? null;
  const fallbackPathTargetNodeId = useMemo(() => {
    if (!selectedNavigationNodeId) {
      return null;
    }
    if (rootNode?.id && rootNode.id !== selectedNavigationNodeId) {
      return rootNode.id;
    }
    return visibleNodes.find((node) => node.id !== selectedNavigationNodeId)?.id ?? null;
  }, [rootNode?.id, selectedNavigationNodeId, visibleNodes]);
  const selectedExplainPackNodeId = selectedNode?.id ?? null;
  const selectedExplainPack = useMemo(
    () =>
      selectedExplainPackNodeId
        ? buildProjectMapExplainPack({ dataset, nodeId: selectedExplainPackNodeId })
        : null,
    [dataset, selectedExplainPackNodeId],
  );
  const searchResults = useMemo(
    () => searchProjectMapNodes({ dataset, query: searchQuery, limit: 8 }),
    [dataset, searchQuery],
  );
  const activityProjection = useMemo(
    () =>
      buildProjectMapActivityProjection({
        dataset,
        changedFilePaths,
        source: changedFileSource,
      }),
    [changedFilePaths, changedFileSource, dataset],
  );
  const evidenceFileIndex = useMemo(
    () => buildProjectMapEvidenceFileIndex({ dataset }),
    [dataset],
  );
  const groupedQueryResults = useMemo(
    () =>
      searchProjectMapGrouped({
        dataset,
        query: searchQuery,
        activityProjection,
        evidenceFileIndex,
      }),
    [activityProjection, dataset, evidenceFileIndex, searchQuery],
  );
  const advisorHints = useMemo(
    () =>
      buildProjectMapAdvisorHints({
        dataset,
        activityProjection,
        queryResults: groupedQueryResults,
        selectedNodeId: selectedNode?.id ?? null,
        changedFilePaths,
      }),
    [activityProjection, changedFilePaths, dataset, groupedQueryResults, selectedNode?.id],
  );
  const selectedAdvisorHint = useMemo(
    () => advisorHints.find((hint) => hint.id === selectedAdvisorHintId) ?? null,
    [advisorHints, selectedAdvisorHintId],
  );
  const pathNodeOptions = useMemo(
    () => [...projectionNodes].sort((left, right) => left.title.localeCompare(right.title)),
    [projectionNodes],
  );
  const pathResult = useMemo(
    () =>
      buildProjectMapShortestPath({
        dataset,
        sourceNodeId: pathSourceNodeId,
        targetNodeId: pathTargetNodeId,
        emptyMessage: t("projectMap.navigation.path.empty"),
        foundMessage: t("projectMap.navigation.path.found"),
        notFoundMessage: t("projectMap.navigation.path.notFound"),
      }),
    [dataset, pathSourceNodeId, pathTargetNodeId, t],
  );
  const associationExplanation = useMemo(
    () =>
      explainProjectMapAssociationPath({
        sourceNodeId: pathSourceNodeId,
        targetNodeId: pathTargetNodeId,
        pathResult,
      }),
    [pathResult, pathSourceNodeId, pathTargetNodeId],
  );
  const refreshSummary = useMemo(
    () => classifyProjectMapRefresh({ dataset, changedFiles: changedFilePaths }),
    [changedFilePaths, dataset],
  );
  const graphIntegrityIssues = useMemo(
    () => validateProjectMapGraphIntegrity(dataset),
    [dataset],
  );
  const activeGraphRepairSummary = graphRepairSummary ?? dataset.graphRepair ?? null;
  const impactAnalysis = useMemo(
    () => buildProjectMapImpactAnalysis({ dataset, changedFilePaths, source: changedFileSource }),
    [changedFilePaths, changedFileSource, dataset],
  );
  const relationIndex = useMemo(
    () => buildProjectMapRelationIndex(dataset),
    [dataset],
  );
  const relationTypeOptions = useMemo(
    () => relationIndex.typeCounts.map((item) => item.key),
    [relationIndex.typeCounts],
  );
  const relationSourceKindOptions = useMemo(
    () => relationIndex.sourceKindCounts.map((item) => item.key),
    [relationIndex.sourceKindCounts],
  );
  const selectedNodeRelationBucket = selectedNode?.id
    ? relationIndex.byNodeId.get(selectedNode.id) ?? null
    : null;
  const filteredRelations = useMemo(
    () =>
      filterProjectMapRelations({
        relationIndex,
        selectedNodeId: selectedNode?.id ?? null,
        typeFilter: relationTypeFilter,
        sourceKindFilter: relationSourceKindFilter,
        directionFilter: relationDirectionFilter,
      }),
    [
      relationDirectionFilter,
      relationIndex,
      relationSourceKindFilter,
      relationTypeFilter,
      selectedNode?.id,
    ],
  );
  const selectedRelation = selectedRelationId
    ? relationIndex.relations.find((item) => item.relation.id === selectedRelationId) ?? null
    : null;
  const selectedNodeExplainHint = useMemo(
    () =>
      selectedNode
        ? advisorHints.find((hint) => hint.kind === "node-explain") ?? null
        : null,
    [advisorHints, selectedNode],
  );
  const hierarchyRelations = useMemo<ProjectMapHierarchyRelationView[]>(
    () =>
      dataset.nodes.flatMap((child) => {
        if (!child.parentId) {
          return [];
        }
        const parent = nodeIndex.get(child.parentId);
        return parent
          ? [
              {
                id: `hierarchy:${parent.id}:${child.id}`,
                parent,
                child,
              },
            ]
          : [];
      }),
    [dataset.nodes, nodeIndex],
  );
  const filteredHierarchyRelations = useMemo(() => {
    const matchesType =
      relationTypeFilter === PROJECT_MAP_RELATION_FILTER_ALL || relationTypeFilter === "hierarchy";
    const matchesSourceKind =
      relationSourceKindFilter === PROJECT_MAP_RELATION_FILTER_ALL ||
      relationSourceKindFilter === "map-tree";
    if (!matchesType || !matchesSourceKind) {
      return [];
    }
    if (!selectedNode?.id) {
      return hierarchyRelations;
    }
    if (relationDirectionFilter === "all") {
      return hierarchyRelations.filter(
        (relation) => relation.parent.id === selectedNode.id || relation.child.id === selectedNode.id,
      );
    }
    if (relationDirectionFilter === "incoming") {
      return hierarchyRelations.filter((relation) => relation.child.id === selectedNode.id);
    }
    return hierarchyRelations.filter((relation) => relation.parent.id === selectedNode.id);
  }, [
    hierarchyRelations,
    relationDirectionFilter,
    relationSourceKindFilter,
    relationTypeFilter,
    selectedNode?.id,
  ]);
  const relationFilteredNodeIds = useMemo(
    () =>
      new Set(
        filteredRelations.flatMap((item) => [
          item.relation.sourceNodeId,
          item.relation.targetNodeId,
        ]),
      ),
    [filteredRelations],
  );
  const selectedRelationNodeIds = useMemo(
    () =>
      new Set(
        selectedRelation
          ? [selectedRelation.relation.sourceNodeId, selectedRelation.relation.targetNodeId]
          : [],
      ),
    [selectedRelation],
  );
  const hasGraphRepairAttention = graphIntegrityIssues.length > 0;
  const visibleSectionState = useMemo<ProjectMapVisibleSectionState>(
    () => ({
      navigation: isNavigationPanelExpanded,
      query: isQueryPanelExpanded,
      activity: isActivityPanelExpanded,
      evidence: false,
      fileRelations: isFileRelationPanelExpanded,
      relations: isRelationPanelExpanded,
      advisor: isAdvisorPanelExpanded,
      health: isGraphHealthExpanded,
    }),
    [
      isActivityPanelExpanded,
      isAdvisorPanelExpanded,
      isFileRelationPanelExpanded,
      isGraphHealthExpanded,
      isNavigationPanelExpanded,
      isQueryPanelExpanded,
      isRelationPanelExpanded,
    ],
  );
  const isFileRelationsWorkspaceVisible = visibleSectionState.fileRelations;
  const selectedNodeStaleReasons = useMemo(
    () =>
      selectedNode
        ? getProjectMapNodeStaleReasons({
            dataset,
            nodeId: selectedNode.id,
            refreshSummary,
          })
        : [],
    [dataset, refreshSummary, selectedNode],
  );
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
  const relationRenderEdges = useMemo(() => {
    const positionById = new Map(renderGraphLayout.positions.map((position) => [position.id, position]));
    return filteredRelations.flatMap((indexedRelation) => {
      const source = positionById.get(indexedRelation.relation.sourceNodeId);
      const target = positionById.get(indexedRelation.relation.targetNodeId);
      if (!source || !target) {
        return [];
      }
      return [{ indexedRelation, source, target }];
    });
  }, [filteredRelations, renderGraphLayout.positions]);
  const highlightProjection = useMemo(
    () =>
      buildProjectMapHighlightProjection({
        dataset,
        selectedNodeId: selectedNode?.id ?? null,
        selectedRelationId,
        pathResult,
        queryResults: groupedQueryResults,
        activityProjection,
        advisorHints: selectedAdvisorHint ? [selectedAdvisorHint] : [],
        quickFilters: activeQuickFilters,
        baseNodeIds: visibleNodes.map((node) => node.id),
        baseRelationIds: [
          ...renderGraphLayout.edges.map((edge) => edge.id),
          ...relationRenderEdges.map(({ indexedRelation }) => indexedRelation.relation.id),
        ],
      }),
    [
      activeQuickFilters,
      activityProjection,
      dataset,
      groupedQueryResults,
      pathResult,
      relationRenderEdges,
      renderGraphLayout.edges,
      selectedNode?.id,
      selectedAdvisorHint,
      selectedRelationId,
      visibleNodes,
    ],
  );
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
  const groupedQueryResultCount = groupedQueryResults.groups.reduce(
    (total, group) => total + group.results.length,
    0,
  );
  const activityItemCount = activityProjection.items.length;
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

  useEffect(() => {
    if (pathEndpointsEditedByUserRef.current) {
      return;
    }
    if (!selectedNavigationNodeId) {
      return;
    }
    setPathSourceNodeId((current) =>
      current === selectedNavigationNodeId ? current : selectedNavigationNodeId,
    );
    setPathTargetNodeId((current) => {
      if (current && current !== selectedNavigationNodeId && nodeIndex.has(current)) {
        return current;
      }
      return fallbackPathTargetNodeId;
    });
  }, [fallbackPathTargetNodeId, nodeIndex, selectedNavigationNodeId]);

  useEffect(() => {
    if (
      relationTypeFilter !== PROJECT_MAP_RELATION_FILTER_ALL &&
      !relationTypeOptions.includes(relationTypeFilter)
    ) {
      setRelationTypeFilter(PROJECT_MAP_RELATION_FILTER_ALL);
    }
  }, [relationTypeFilter, relationTypeOptions]);

  useEffect(() => {
    if (
      relationSourceKindFilter !== PROJECT_MAP_RELATION_FILTER_ALL &&
      !relationSourceKindOptions.includes(relationSourceKindFilter)
    ) {
      setRelationSourceKindFilter(PROJECT_MAP_RELATION_FILTER_ALL);
    }
  }, [relationSourceKindFilter, relationSourceKindOptions]);

  useEffect(() => {
    if (
      selectedRelationId &&
      !relationIndex.relations.some((item) => item.relation.id === selectedRelationId)
    ) {
      setSelectedRelationId(null);
    }
  }, [relationIndex.relations, selectedRelationId]);

  useEffect(() => {
    setGraphRepairSummary(dataset.graphRepair ?? null);
  }, [dataset.graphRepair]);

  useEffect(() => {
    setPathSourceNodeId((current) =>
      current && nodeIndex.has(current)
        ? current
        : rootNode?.id ?? pathNodeOptions[0]?.id ?? null,
    );
    setPathTargetNodeId((current) =>
      current && nodeIndex.has(current)
        ? current
        : selectedNode?.id ?? pathNodeOptions.find((node) => node.id !== rootNode?.id)?.id ?? null,
    );
  }, [nodeIndex, pathNodeOptions, rootNode?.id, selectedNode?.id]);

  const handlePathSourceNodeChange = useCallback((nodeId: string | null) => {
    pathEndpointsEditedByUserRef.current = true;
    setPathSourceNodeId(nodeId);
  }, []);

  const handlePathTargetNodeChange = useCallback((nodeId: string | null) => {
    pathEndpointsEditedByUserRef.current = true;
    setPathTargetNodeId(nodeId);
  }, []);

  const handleQuickFilterToggle = useCallback((filterId: ProjectMapQuickFilterId) => {
    setActiveQuickFilters((current) => {
      const nextFilters = new Set(current);
      if (nextFilters.has(filterId)) {
        nextFilters.delete(filterId);
      } else {
        nextFilters.add(filterId);
      }
      return nextFilters;
    });
  }, []);

  const rememberQuery = useCallback((query: string) => {
    const normalizedQuery = normalizeLocalHistoryLabel(query);
    if (!normalizedQuery) {
      return;
    }
    setQueryHistory((current) =>
      appendUniqueLocalHistory(current, normalizedQuery, (item) => item),
    );
  }, []);

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const rememberNavigationItem = useCallback((item: ProjectMapNavigationHistoryItem) => {
    setNavigationHistory((current) =>
      appendUniqueLocalHistory(current, item, (historyItem) => historyItem.id),
    );
  }, []);

  const handlePrepareNodeSelection = useCallback((node: ProjectMapNode) => {
    setHoverNodeId(null);
    setSelectedNodeId(node.id);
    setIsDetailCollapsed(false);
  }, []);

  const handleNodeSelect = useCallback((node: ProjectMapNode) => {
    handlePrepareNodeSelection(node);
    setSelectedGraphNodeIds(new Set([node.id]));
  }, [handlePrepareNodeSelection]);

  const rememberCurrentView = useCallback(() => {
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
  }, [focusNodeId, selectedNodeId]);

  const focusNavigationNode = useCallback((nodeId: string | null) => {
    if (!nodeId) {
      return;
    }
    const targetNode = nodeIndex.get(nodeId);
    if (!targetNode) {
      return;
    }
    rememberCurrentView();
    setHoverNodeId(null);
    setSelectedNodeId(targetNode.id);
    rememberNavigationItem({
      id: `node:${targetNode.id}`,
      kind: "node",
      label: targetNode.title,
      nodeId: targetNode.id,
    });
    setFocusNodeId(
      targetNode.parentId && targetNode.parentId !== rootNode?.id
        ? targetNode.parentId
        : null,
    );
    setIsDetailCollapsed(false);
    setSelectedGraphNodeIds(new Set([targetNode.id]));
  }, [nodeIndex, rememberCurrentView, rememberNavigationItem, rootNode?.id]);

  const activateWorkbenchTarget = useCallback((target: {
    nodeIds: string[];
    relationIds: string[];
  }) => {
    const focusableNodeId = target.nodeIds.find((nodeId) => nodeIndex.has(nodeId)) ?? null;
    if (focusableNodeId) {
      focusNavigationNode(focusableNodeId);
      return;
    }
    const selectableRelationId = target.relationIds.find((relationId) =>
      relationIndex.relations.some((item) => item.relation.id === relationId),
    ) ?? null;
    if (selectableRelationId) {
      setSelectedRelationId(selectableRelationId);
      setIsRelationPanelExpanded(true);
    }
  }, [focusNavigationNode, nodeIndex, relationIndex.relations]);

  const handleQueryResultActivate = useCallback((result: ProjectMapQueryResult) => {
    rememberQuery(searchQuery);
    activateWorkbenchTarget(result);
  }, [activateWorkbenchTarget, rememberQuery, searchQuery]);

  const handleAdvisorHintActivate = useCallback((hint: ProjectMapAdvisorHint) => {
    setSelectedAdvisorHintId(hint.id);
    activateWorkbenchTarget(hint);
  }, [activateWorkbenchTarget]);

  const handlePathNavigationRemember = useCallback(() => {
    const sourceNode = pathSourceNodeId ? nodeIndex.get(pathSourceNodeId) ?? null : null;
    const targetNode = pathTargetNodeId ? nodeIndex.get(pathTargetNodeId) ?? null : null;
    if (!sourceNode || !targetNode) {
      return;
    }
    rememberNavigationItem({
      id: `path:${sourceNode.id}:${targetNode.id}`,
      kind: "path",
      label: `${sourceNode.title} → ${targetNode.title}`,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
    });
  }, [nodeIndex, pathSourceNodeId, pathTargetNodeId, rememberNavigationItem]);

  useEffect(() => {
    if (!pathEndpointsEditedByUserRef.current) {
      return;
    }
    handlePathNavigationRemember();
  }, [handlePathNavigationRemember]);

  const handleNavigationHistoryActivate = useCallback((item: ProjectMapNavigationHistoryItem) => {
    if (item.kind === "path") {
      pathEndpointsEditedByUserRef.current = true;
      setPathSourceNodeId(item.sourceNodeId ?? null);
      setPathTargetNodeId(item.targetNodeId ?? null);
      setIsNavigationPanelExpanded(true);
      return;
    }
    focusNavigationNode(item.nodeId ?? null);
  }, [focusNavigationNode]);

  useEffect(() => {
    if (!sourceFocusNodeId || lastSourceFocusNodeIdRef.current === sourceFocusNodeId) {
      return;
    }

    lastSourceFocusNodeIdRef.current = sourceFocusNodeId;
    if (!nodeIndex.has(sourceFocusNodeId)) {
      setFocusNodeId(null);
      setSelectedNodeId(rootNode?.id ?? null);
      setSelectedGraphNodeIds(new Set());
      setSelectedRelationId(null);
      return;
    }

    focusNavigationNode(sourceFocusNodeId);
  }, [focusNavigationNode, nodeIndex, rootNode?.id, sourceFocusNodeId]);

  const handleRelationFocusNode = (nodeId: string) => {
    focusNavigationNode(nodeId);
  };

  const handleRelationSelect = (relationId: string) => {
    setSelectedRelationId(relationId);
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

  const handleRepairGraphIntegrity = async () => {
    let latestSummary: ProjectMapGraphRepairSummary | null = null;
    await datasetController.updateDataset((currentDataset) => {
      const repaired = repairProjectMapGraphIntegrity({ dataset: currentDataset });
      latestSummary = repaired.summary;
      return repaired.dataset;
    });
    setGraphRepairSummary(latestSummary);
  };

  const handleRequestDeleteSelectedNode = () => {
    if (!selectedNode) {
      return;
    }
    setDeleteConfirmNodeId(selectedNode.id);
  };

  const handleCreateOrchestrationTaskDraft = useCallback(() => {
    if (!selectedNode) {
      return;
    }
    const workspaceId = resolveProjectMapOrchestrationWorkspaceId({
      activeWorkspace,
      dataset,
      workspaceName,
    });
    if (!workspaceId) {
      setOrchestrationDraftState({
        status: "failed",
        nodeId: selectedNode.id,
        reason: "missing-workspace",
      });
      return;
    }
    const draft = buildProjectMapOrchestrationTaskDraft({
      workspaceId,
      dataset,
      nodeId: selectedNode.id,
    });
    if (!draft) {
      setOrchestrationDraftState({
        status: "failed",
        nodeId: selectedNode.id,
        reason: "missing-node",
      });
      return;
    }
    saveOrchestrationTaskStore(upsertOrchestrationTask(loadOrchestrationTaskStore(), draft));
    setOrchestrationDraftState({
      status: "created",
      nodeId: selectedNode.id,
      taskId: draft.taskId,
      taskStatus: draft.status,
      evidenceCount: draft.evidenceRefs.length,
      riskCount: draft.riskMarkers.length,
    });
    onOpenOrchestrationTask?.(draft.taskId);
  }, [activeWorkspace, dataset, onOpenOrchestrationTask, selectedNode, workspaceName]);

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

  const {
    handleCanvasPointerDown,
    handleCanvasPointerEnd,
    handleCanvasPointerMove,
    handleCanvasWheel,
    handleMiniMapClick,
    handleNodeClick,
    handleNodeKeyDown,
    handleNodePointerDown,
    handleNodePointerEnd,
    handleNodePointerMove,
    updateZoom,
  } = useProjectMapGraphInteractionHandlers({
    miniMapProjection,
    nodeDragRef,
    panStartRef,
    persistGraphPositions,
    renderGraphLayout,
    selectedGraphNodeIds,
    setDragPreviewPositions,
    setSelectedGraphNodeIds,
    setViewport,
    suppressNextNodeClickRef,
    viewport,
    onPrepareNodeSelection: handlePrepareNodeSelection,
    onSelectSingleNode: handleNodeSelect,
  });

  const handleRelationshipScanClick = useCallback(() => {
    setIsFileRelationPanelExpanded(true);
    setRelationshipScanRequestId((current) => current + 1);
  }, []);

  const {
    handleOpenIntentCanvas,
    handleOpenIntentCanvasForFile,
    handleOpenIntentCanvasFromRelationship,
  } = useProjectMapIntentCanvasHandlers({
    activeCodeSelectionAnchor,
    selectedNode,
    onDetailOpen: () => setIsDetailCollapsed(false),
    onOpenIntentCanvas,
  });

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
                <ProjectMapStorageSwitch
                  activeReadLocation={datasetController.activeReadLocation}
                  onSwitchReadLocation={datasetController.switchReadLocation}
                />
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
                className="project-map-toolbar-action project-map-profile-action"
                type="button"
                onClick={handleRelationshipScanClick}
                disabled={!activeWorkspace?.id || relationshipSummaryState.status === "running"}
                title={
                  activeWorkspace?.id
                    ? t("projectMap.relationship.scanHint")
                    : t("projectMap.relationship.disabledNoWorkspace")
                }
              >
                <RefreshCw aria-hidden />
                {relationshipSummaryState.status === "running"
                  ? t("projectMap.relationship.scanning")
                  : t("projectMap.relationship.scan")}
              </button>
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

      <main
        className={cn(
          "project-map-stage",
          isFileRelationsWorkspaceVisible && "is-file-relations-focused",
        )}
        aria-label={t("projectMap.stageAria")}
      >
        {!isProjectMapChromeCollapsed ? (
          <div className={cn("project-map-lens-shell", isLensStripCollapsed && "is-collapsed")}>
            <div className="project-map-stage-toolbar">
              <div
                className={cn("project-map-breadcrumb", isFileRelationsWorkspaceVisible && "is-file-relations-summary")}
                aria-label={isFileRelationsWorkspaceVisible
                  ? t("projectMap.relationship.dashboardTitle")
                  : t("projectMap.breadcrumb")}
              >
                {isFileRelationsWorkspaceVisible ? (
                  <div className="project-map-relationship-inline-summary" role="status">
                    <Network aria-hidden />
                    <div className="project-map-relationship-inline-copy">
                      <strong>{t("projectMap.relationship.dashboardTitle")}</strong>
                      <span>
                        {relationshipSummaryState.status === "success"
                          ? t("projectMap.relationship.dashboardReady", {
                              runId: relationshipSummaryState.summary.scanRunId,
                            })
                          : relationshipSummaryState.status === "failed"
                            ? t("projectMap.relationship.failed", {
                                message: relationshipSummaryState.message,
                              })
                            : t("projectMap.relationship.dashboardEmpty")}
                      </span>
                    </div>
                    {relationshipSummaryState.status === "success" ? (
                      <div className="project-map-relationship-inline-metrics">
                        <span>
                          <strong>{relationshipSummaryState.summary.fileCount}</strong>
                          {t("projectMap.relationship.metricFiles")}
                        </span>
                        <span>
                          <strong>{relationshipSummaryState.summary.relationCount}</strong>
                          {t("projectMap.relationship.metricRelations")}
                        </span>
                        <span>
                          <strong>{relationshipSummaryState.summary.ignoredCount}</strong>
                          {t("projectMap.relationship.metricIgnored")}
                        </span>
                        <span>
                          <strong>{relationshipSummaryState.summary.repairIssueCount}</strong>
                          {t("projectMap.relationship.metricRepair")}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <span className="project-map-breadcrumb-root">
                      <Network aria-hidden />
                      {t("projectMap.breadcrumbRoot")}
                    </span>
                    {activeLens && focusNodeId ? (
                  <>
                    <span>/</span>
                    <strong>{activeLens.title}</strong>
                  </>
                    ) : null}
                  </>
                )}
              </div>
              <div className="project-map-stage-stats">
                <span>{t("projectMap.totalNodes", { count: dataset.nodes.length })}</span>
                <span>{t("projectMap.lensStats", { detected: detectedLensCount, candidate: candidateLensCount })}</span>
                <span>{t("projectMap.staleNodes", { count: staleCount })}</span>
                <span>{t("projectMap.candidateNodes", { count: candidateCount })}</span>
                {relationshipSummaryState.status === "success" ? (
                  <span>
                    {t("projectMap.relationship.summary", {
                      files: relationshipSummaryState.summary.fileCount,
                      relations: relationshipSummaryState.summary.relationCount,
                      ignored: relationshipSummaryState.summary.ignoredCount,
                    })}
                  </span>
                ) : null}
                {relationshipSummaryState.status === "failed" ? (
                  <span className="project-map-inline-status is-error">
                    {t("projectMap.relationship.failed", {
                      message: relationshipSummaryState.message,
                    })}
                  </span>
                ) : null}
                <button
                  className={cn(
                    "project-map-health-chip",
                    graphIntegrityIssues.length > 0 && "has-issues",
                    isGraphHealthExpanded && "is-active",
                  )}
                  type="button"
                  aria-expanded={isGraphHealthExpanded}
                  onClick={() => {
                    setIsGraphHealthExpanded((current) => !current);
                    setIsDetailCollapsed(false);
                  }}
                >
                  {t("projectMap.repair.title")}
                  <strong>
                    {graphIntegrityIssues.length}/
                    {activeGraphRepairSummary?.actions.length ?? 0}
                  </strong>
                </button>
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
              <section
                className="project-map-investigation-strip"
                role="toolbar"
                aria-label={t("projectMap.viewIa.modesAria")}
              >
                  <button
                    className={cn(
                      "project-map-investigation-mode",
                      (visibleSectionState.navigation || visibleSectionState.query) && "is-active",
                    )}
                    type="button"
                    aria-label={t("projectMap.viewIa.navigationMode")}
                    aria-pressed={visibleSectionState.navigation || visibleSectionState.query}
                    aria-expanded={visibleSectionState.navigation || visibleSectionState.query}
                    onClick={() => {
                      const nextExpanded = !(visibleSectionState.navigation || visibleSectionState.query);
                      rememberQuery(searchQuery);
                      setIsNavigationPanelExpanded(nextExpanded);
                      setIsQueryPanelExpanded(nextExpanded);
                    }}
                  >
                    <ListFilter aria-hidden />
                    <span><strong>{t("projectMap.viewIa.navigationMode")}</strong></span>
                    <b>{searchResults.length + groupedQueryResultCount}</b>
                  </button>
                  <button
                    className={cn("project-map-investigation-mode", visibleSectionState.activity && "is-active")}
                    type="button"
                    aria-label={t("projectMap.viewIa.activityMode")}
                    aria-pressed={visibleSectionState.activity}
                    aria-expanded={visibleSectionState.activity}
                    onClick={() => setIsActivityPanelExpanded((current) => !current)}
                  >
                    <RadioTower aria-hidden />
                    <span><strong>{t("projectMap.viewIa.activityMode")}</strong></span>
                    <b>{activityItemCount}</b>
                  </button>
                  <button
                    className={cn("project-map-investigation-mode", visibleSectionState.fileRelations && "is-active")}
                    type="button"
                    aria-label={t("projectMap.viewIa.fileRelationsMode")}
                    aria-pressed={visibleSectionState.fileRelations}
                    aria-expanded={visibleSectionState.fileRelations}
                    onClick={() => setIsFileRelationPanelExpanded((current) => !current)}
                  >
                    <Network aria-hidden />
                    <span><strong>{t("projectMap.viewIa.fileRelationsMode")}</strong></span>
                    <b>{relationshipSummaryState.status === "success" ? relationshipSummaryState.summary.relationCount : 0}</b>
                  </button>
                  <button
                    className={cn("project-map-investigation-mode", visibleSectionState.relations && "is-active")}
                    type="button"
                    aria-label={t("projectMap.viewIa.relationsMode")}
                    aria-pressed={visibleSectionState.relations}
                    aria-expanded={visibleSectionState.relations}
                    onClick={() => setIsRelationPanelExpanded((current) => !current)}
                  >
                    <Network aria-hidden />
                    <span><strong>{t("projectMap.viewIa.relationsMode")}</strong></span>
                  <b>{filteredRelations.length + filteredHierarchyRelations.length}</b>
                  </button>
                  <button
                    className={cn("project-map-investigation-mode", visibleSectionState.advisor && "is-active")}
                    type="button"
                    aria-label={t("projectMap.viewIa.advisorMode")}
                    aria-pressed={visibleSectionState.advisor}
                    aria-expanded={visibleSectionState.advisor}
                    onClick={() => setIsAdvisorPanelExpanded((current) => !current)}
                  >
                    <Lightbulb aria-hidden />
                    <span><strong>{t("projectMap.viewIa.advisorMode")}</strong></span>
                    <b>{advisorHints.length}</b>
                  </button>
                  <button
                    className={cn(
                      "project-map-investigation-mode",
                      "is-health",
                      visibleSectionState.health && "is-active",
                      hasGraphRepairAttention && "requires-attention",
                    )}
                    type="button"
                    aria-label={t("projectMap.viewIa.healthMode")}
                    aria-pressed={visibleSectionState.health}
                    aria-expanded={visibleSectionState.health}
                    onClick={() => {
                      setIsGraphHealthExpanded((current) => !current);
                      setIsDetailCollapsed(false);
                    }}
                  >
                    <Crosshair aria-hidden />
                    <span><strong>{t("projectMap.viewIa.healthMode")}</strong></span>
                    <b>{graphIntegrityIssues.length}</b>
                  </button>
              </section>
            </div>

            {visibleSectionState.navigation ? (
              <ProjectMapNavigationPanel
                searchQuery={searchQuery}
                expanded={visibleSectionState.navigation}
                pathNodeOptions={pathNodeOptions}
                pathSourceNodeId={pathSourceNodeId}
                pathTargetNodeId={pathTargetNodeId}
                pathResult={pathResult}
                associationExplanation={associationExplanation}
                onSearchQueryChange={handleSearchQueryChange}
                onFocusNode={focusNavigationNode}
                onPathSourceNodeChange={handlePathSourceNodeChange}
                onPathTargetNodeChange={handlePathTargetNodeChange}
              />
            ) : null}

            <ProjectMapNavigationHistoryChips
              items={navigationHistory}
              onActivate={handleNavigationHistoryActivate}
              onClear={() => setNavigationHistory([])}
            />

            {visibleSectionState.query ? (
              <ProjectMapGroupedQueryPanel
                results={groupedQueryResults}
                expanded={visibleSectionState.query}
                queryHistory={queryHistory}
                onActivateResult={handleQueryResultActivate}
                onRestoreQuery={handleSearchQueryChange}
                onClearQueryHistory={() => setQueryHistory([])}
              />
            ) : null}

            {visibleSectionState.activity ? (
              <ProjectMapRecentActivityPanel
                activity={activityProjection}
                expanded={visibleSectionState.activity}
                onActivateTarget={activateWorkbenchTarget}
              />
            ) : null}

            {visibleSectionState.relations ? (
                <section className="project-map-semantic-relations-panel">
                  <header className="project-map-semantic-relations-header">
                    <div>
                      <strong>{t("projectMap.relationship.semanticTitle")}</strong>
                      <p>{t("projectMap.relationship.semanticDescription")}</p>
                    </div>
                    <span>{t("projectMap.relationship.semanticBadge")}</span>
                  </header>
                  <ProjectMapRelationLegendPanel
                    relationIndex={relationIndex}
                    hierarchyRelations={filteredHierarchyRelations}
                    hierarchyRelationTotalCount={filteredHierarchyRelations.length}
                    expanded={visibleSectionState.relations}
                    typeFilter={relationTypeFilter}
                    sourceKindFilter={relationSourceKindFilter}
                    directionFilter={relationDirectionFilter}
                    typeOptions={relationTypeOptions}
                    sourceKindOptions={relationSourceKindOptions}
                    selectedNodeId={selectedNode?.id ?? null}
                    onTypeFilterChange={setRelationTypeFilter}
                    onSourceKindFilterChange={setRelationSourceKindFilter}
                    onDirectionFilterChange={setRelationDirectionFilter}
                    onClearSelectedRelation={() => setSelectedRelationId(null)}
                    onFocusNode={focusNavigationNode}
                  />
                </section>
            ) : null}

            {visibleSectionState.advisor ? (
              <ProjectMapAdvisorHintsPanel
                hints={advisorHints}
                expanded={visibleSectionState.advisor}
                selectedHintId={selectedAdvisorHintId}
                onActivateHint={handleAdvisorHintActivate}
                onClearHint={() => setSelectedAdvisorHintId(null)}
              />
            ) : null}

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

        <ProjectMapRelationshipSection
          activeWorkspaceId={activeWorkspace?.id ?? null}
          activeReadLocation={datasetController.activeReadLocation}
          expanded={isFileRelationsWorkspaceVisible}
          activeCodeSelectionAnchor={activeCodeSelectionAnchor}
          onOpenEvidenceFile={onOpenEvidenceFile}
          onOpenIntentCanvasFromRelationship={handleOpenIntentCanvasFromRelationship}
          reloadRelationshipContext={datasetController.reloadRelationshipContext}
          scanRequestId={relationshipScanRequestId}
          onSummaryStateChange={setRelationshipSummaryState}
        />

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
        ) : isFileRelationsWorkspaceVisible ? null : visibleNodes.length === 0 ? (
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
          <ProjectMapGraphCanvas
            activeQuickFilters={activeQuickFilters}
            backToPreviousLabel={backToPreviousLabel}
            canvasRef={canvasRef}
            focusNodeId={focusNodeId}
            hasBackToParentFallback={hasBackToParentFallback}
            highlightProjection={highlightProjection}
            isCanvasControlsCollapsed={isCanvasControlsCollapsed}
            lensIndex={lensIndex}
            miniMapProjection={miniMapProjection}
            neighborNodeIds={neighborNodeIds}
            nodeIndex={nodeIndex}
            pathResult={pathResult}
            previousViewSnapshot={previousViewSnapshot}
            relationFilteredNodeIds={relationFilteredNodeIds}
            relationRenderEdges={relationRenderEdges}
            renderGraphLayout={renderGraphLayout}
            rootNode={rootNode}
            selectedGraphNodeIds={selectedGraphNodeIds}
            selectedNode={selectedNode}
            selectedRelationId={selectedRelationId}
            selectedRelationNodeIds={selectedRelationNodeIds}
            viewport={viewport}
            layoutPreset={dataset.viewState?.layoutPreset ?? "radial"}
            onAutoLayout={handleAutoLayout}
            onBackToPreviousView={handleBackToPreviousView}
            onCanvasControlsToggle={handleCanvasControlsToggle}
            onCanvasPointerDown={handleCanvasPointerDown}
            onCanvasPointerEnd={handleCanvasPointerEnd}
            onCanvasPointerMove={handleCanvasPointerMove}
            onCanvasWheel={handleCanvasWheel}
            onLayoutPresetChange={handleLayoutPresetChange}
            onMiniMapClick={handleMiniMapClick}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleDrillIn}
            onNodeDrillClick={handleNodeDrillClick}
            onNodeDrillUpClick={handleNodeDrillUpClick}
            onNodeKeyDown={handleNodeKeyDown}
            onNodeMouseEnter={setHoverNodeId}
            onNodeMouseLeave={() => setHoverNodeId(null)}
            onNodePointerDown={handleNodePointerDown}
            onNodePointerEnd={handleNodePointerEnd}
            onNodePointerMove={handleNodePointerMove}
            onQuickFilterToggle={handleQuickFilterToggle}
            onResetLayout={handleResetLayout}
            onResetView={fitGraphToViewport}
            onZoomChange={updateZoom}
          >

            <DetailPanel
              node={selectedNode}
              dataset={dataset}
              pendingCandidate={
                selectedNode ? pendingCandidateByNodeId.get(selectedNode.id) ?? null : null
              }
              lens={selectedNode ? lensIndex.get(selectedNode.lensId) ?? null : null}
              explainPack={selectedExplainPack}
              relationBucket={selectedNodeRelationBucket}
              activityProjection={activityProjection}
              nodeExplainHint={selectedNodeExplainHint}
              selectedRelationId={selectedRelationId}
              impactAnalysis={impactAnalysis}
              refreshSummary={refreshSummary}
              nodeStaleReasons={selectedNodeStaleReasons}
              graphIntegrityIssues={graphIntegrityIssues}
              graphRepairSummary={activeGraphRepairSummary}
              isGraphHealthExpanded={isGraphHealthExpanded}
              orchestrationDraftState={orchestrationDraftState}
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
              onCreateOrchestrationTask={handleCreateOrchestrationTaskDraft}
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
              onFocusRelationNode={handleRelationFocusNode}
              onSelectRelation={handleRelationSelect}
              onGraphHealthExpandedChange={setIsGraphHealthExpanded}
              onRepairGraph={handleRepairGraphIntegrity}
              onOpenIntentCanvasArchitect={
                onOpenIntentCanvas ? () => handleOpenIntentCanvas("architect") : undefined
              }
              onOpenIntentCanvasSpotlight={
                onOpenIntentCanvas ? () => handleOpenIntentCanvas("spotlight") : undefined
              }
              onOpenIntentCanvasForFile={onOpenIntentCanvas ? handleOpenIntentCanvasForFile : undefined}
            />
          </ProjectMapGraphCanvas>
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
