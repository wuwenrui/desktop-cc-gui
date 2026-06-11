import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import Network from "lucide-react/dist/esm/icons/network";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

import {
  ProjectMapRelationshipFileWorkspace,
  ProjectMapRelationshipReadWorkspace,
} from "./ProjectMapRelationshipWorkspaces";
import { ProjectMapRelationshipApiWorkspace } from "./ProjectMapRelationshipApiWorkspace";
import { ProjectMapRelationshipGraphWorkspace } from "./ProjectMapRelationshipGraphWorkspace";
import {
  PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT,
  PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH,
} from "./projectMapRelationshipGraphProjection";
import { cn } from "../../../lib/utils";
import type { ProjectMapDatasetController } from "../hooks/useProjectMapDataset";
import { useProjectMapRelationshipApiProjection } from "../hooks/useProjectMapRelationshipApiProjection";
import {
  useProjectMapRelationshipFileProjection,
} from "../hooks/useProjectMapRelationshipFileProjection";
import { useProjectMapRelationshipGraphProjection } from "../hooks/useProjectMapRelationshipGraphProjection";
import {
  normalizeProjectMapRelationshipDashboardData,
  normalizeProjectMapRelationshipError,
  normalizeProjectMapRelationshipReadSummary,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import {
  readProjectMapRelationships,
  scanProjectMapRelationships,
} from "../services/projectMapPersistence";
import {
  queryProjectMapRelationshipEdge,
} from "../../intent-canvas/services/relationshipImportQueries";
import { loadIntentCanvasIndex } from "../../intent-canvas/services/intentCanvasStorage";
import {
  projectRelationshipEdgeToCanvasSemanticGraph,
  projectRelationshipFileRelationsToCanvasSemanticGraph,
} from "../../intent-canvas/services/relationshipProjector";
import type {
  IntentCanvasCodeSelectionAnchor,
  IntentCanvasIndexEntry,
  IntentCanvasOpenRequest,
} from "../../intent-canvas/types";
import type {
  ProjectMapRelationshipScanResponse,
} from "../types";

export type ProjectMapRelationshipSummaryState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; summary: ProjectMapRelationshipScanResponse }
  | { status: "failed"; message: string };

type ProjectMapRelationshipScanState = ProjectMapRelationshipSummaryState;
type ProjectMapRelationshipDashboardViewMode = "graph" | "files" | "read" | "api";
type ProjectMapRelationshipLayoutPreset = "radial" | "tree" | "force";

type ProjectMapRelationshipScanScope = {
  paths?: string[];
  changedFiles?: string[];
};

type ProjectMapRelationshipGraphPanStart = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};


type ProjectMapRelationshipSectionProps = {
  activeWorkspaceId: string | null;
  activeReadLocation: ProjectMapDatasetController["activeReadLocation"];
  expanded: boolean;
  activeCodeSelectionAnchor?: IntentCanvasCodeSelectionAnchor | null;
  onOpenEvidenceFile?: (path: string, location?: { line: number; column: number }) => void;
  onOpenIntentCanvasFromRelationship?: (request: Omit<IntentCanvasOpenRequest, "requestId">) => void;
  reloadRelationshipContext: () => Promise<void>;
  scanRequestId: number;
  onSummaryStateChange: (state: ProjectMapRelationshipSummaryState) => void;
};

const PROJECT_MAP_RELATION_FILTER_ALL = "all";
const PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET = "__new_canvas__";
const PROJECT_MAP_RELATIONSHIP_GRAPH_RAIL_DEFAULT_WIDTH = 280;
const PROJECT_MAP_RELATIONSHIP_GRAPH_INSPECTOR_DEFAULT_WIDTH = 360;
const PROJECT_MAP_RELATIONSHIP_GRAPH_RAIL_MIN_WIDTH = 220;
const PROJECT_MAP_RELATIONSHIP_GRAPH_RAIL_MAX_WIDTH = 900;
const PROJECT_MAP_RELATIONSHIP_GRAPH_INSPECTOR_MIN_WIDTH = 300;
const PROJECT_MAP_RELATIONSHIP_GRAPH_INSPECTOR_MAX_WIDTH = 900;
const PROJECT_MAP_RELATIONSHIP_VIEW_ORDER: ProjectMapRelationshipDashboardViewMode[] = [
  "graph",
  "files",
  "read",
  "api",
];

function clampProjectMapRelationshipPaneWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getProjectMapRelationshipTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isProjectMapRelationshipStaleSummaryOlderThanScan(input: {
  scanSummary: ProjectMapRelationshipScanResponse;
  dashboardData: ProjectMapRelationshipDashboardData;
}): boolean {
  const staleSummary = input.dashboardData.staleSummary;
  if (!staleSummary || staleSummary.isFresh) {
    return false;
  }
  const staleGeneratedAt = getProjectMapRelationshipTimestamp(staleSummary.generatedAt);
  const scanGeneratedAt = getProjectMapRelationshipTimestamp(input.scanSummary.generatedAt);
  if (staleGeneratedAt !== null && scanGeneratedAt !== null) {
    return staleGeneratedAt < scanGeneratedAt;
  }
  return staleSummary.generatedAt !== input.scanSummary.generatedAt;
}

function reconcileProjectMapRelationshipDashboardDataAfterScan(input: {
  scanSummary: ProjectMapRelationshipScanResponse;
  dashboardData: ProjectMapRelationshipDashboardData;
}): ProjectMapRelationshipDashboardData {
  if (!isProjectMapRelationshipStaleSummaryOlderThanScan(input)) {
    return input.dashboardData;
  }
  return {
    ...input.dashboardData,
    staleSummary: null,
  };
}

export function ProjectMapRelationshipSection({
  activeWorkspaceId,
  activeReadLocation,
  expanded,
  activeCodeSelectionAnchor = null,
  onOpenEvidenceFile,
  onOpenIntentCanvasFromRelationship,
  reloadRelationshipContext,
  scanRequestId,
  onSummaryStateChange,
}: ProjectMapRelationshipSectionProps) {
  const { t } = useTranslation();
  const [relationshipScanState, setRelationshipScanState] =
    useState<ProjectMapRelationshipScanState>({ status: "idle" });
  const [relationshipDashboardData, setRelationshipDashboardData] =
    useState<ProjectMapRelationshipDashboardData | null>(null);
  const [relationshipDashboardQuery, setRelationshipDashboardQuery] = useState("");
  const [relationshipDashboardTypeFilter, setRelationshipDashboardTypeFilter] =
    useState<string>(PROJECT_MAP_RELATION_FILTER_ALL);
  const [relationshipDashboardRoleFilter, setRelationshipDashboardRoleFilter] =
    useState<string>(PROJECT_MAP_RELATION_FILTER_ALL);
  const [showRelationshipNoiseFiles, setShowRelationshipNoiseFiles] = useState(false);
  const [isRelationshipDashboardChromeCollapsed, setIsRelationshipDashboardChromeCollapsed] = useState(true);
  const [relationshipDashboardViewMode, setRelationshipDashboardViewMode] =
    useState<ProjectMapRelationshipDashboardViewMode>("graph");
  const [relationshipDashboardLayoutPreset, setRelationshipDashboardLayoutPreset] =
    useState<ProjectMapRelationshipLayoutPreset>("tree");
  const [relationshipGraphExpandedSide, setRelationshipGraphExpandedSide] =
    useState<"incoming" | "outgoing" | null>(null);
  const [isRelationshipGraphRailCollapsed, setIsRelationshipGraphRailCollapsed] = useState(false);
  const [isRelationshipGraphInspectorCollapsed, setIsRelationshipGraphInspectorCollapsed] = useState(false);
  const [relationshipGraphRailWidth, setRelationshipGraphRailWidth] = useState(PROJECT_MAP_RELATIONSHIP_GRAPH_RAIL_DEFAULT_WIDTH);
  const [relationshipGraphInspectorWidth, setRelationshipGraphInspectorWidth] =
    useState(PROJECT_MAP_RELATIONSHIP_GRAPH_INSPECTOR_DEFAULT_WIDTH);
  const [relationshipGraphPan, setRelationshipGraphPan] = useState({ x: 0, y: 0 });
  const [relationshipGraphScale, setRelationshipGraphScale] = useState(1);
  const [relationshipGraphZoom, setRelationshipGraphZoom] = useState(1);
  const [relationshipFilesZoom, setRelationshipFilesZoom] = useState(1);
  const [isRelationshipGraphPanning, setIsRelationshipGraphPanning] = useState(false);
  const [selectedRelationshipFileId, setSelectedRelationshipFileId] = useState<string | null>(null);
  const [inspectedRelationshipFileId, setInspectedRelationshipFileId] = useState<string | null>(null);
  const [selectedRelationshipRelationId, setSelectedRelationshipRelationId] = useState<string | null>(null);
  const [isRelationshipCanvasImporting, setIsRelationshipCanvasImporting] = useState(false);
  const [relationshipCanvasImportError, setRelationshipCanvasImportError] = useState<string | null>(null);
  const [relationshipCanvasImportTarget, setRelationshipCanvasImportTarget] =
    useState<string>(PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET);
  const [relationshipCanvasTargetEntries, setRelationshipCanvasTargetEntries] =
    useState<IntentCanvasIndexEntry[]>([]);
  const [relationshipCanvasTargetLoadError, setRelationshipCanvasTargetLoadError] = useState<string | null>(null);
  const [expandedRelationshipTopRoleGroups, setExpandedRelationshipTopRoleGroups] = useState<Set<string>>(() => new Set());
  const [collapsedRelationshipTopRoleGroups, setCollapsedRelationshipTopRoleGroups] = useState<Set<string>>(() => new Set());
  const [expandedRelationshipTopModuleGroups, setExpandedRelationshipTopModuleGroups] = useState<Set<string>>(() => new Set());
  const [collapsedRelationshipTopModuleGroups, setCollapsedRelationshipTopModuleGroups] = useState<Set<string>>(() => new Set());
  const [expandedRelationshipTopFileGroups, setExpandedRelationshipTopFileGroups] = useState<Set<string>>(() => new Set());
  const [expandedRelationshipFileGroups, setExpandedRelationshipFileGroups] = useState<Set<string>>(() => new Set());
  const [selectedApiGroupId, setSelectedApiGroupId] = useState<string | null>(null);
  const [selectedApiEndpointId, setSelectedApiEndpointId] = useState<string | null>(null);
  const [apiProtocolFilter, setApiProtocolFilter] = useState("all");
  const [apiLanguageFilter, setApiLanguageFilter] = useState("all");
  const [apiFrameworkFilter, setApiFrameworkFilter] = useState("all");
  const [apiModuleFilter, setApiModuleFilter] = useState("all");
  const [apiControllerFilter, setApiControllerFilter] = useState("all");
  const [apiConfidenceFilter, setApiConfidenceFilter] = useState("all");
  const [expandedApiModuleGroupIds, setExpandedApiModuleGroupIds] = useState<Set<string>>(() => new Set());
  const relationshipGraphDashboardRef = useRef<HTMLDivElement | null>(null);
  const relationshipGraphCanvasRef = useRef<HTMLDivElement | null>(null);
  const relationshipGraphPanRef = useRef<ProjectMapRelationshipGraphPanStart | null>(null);
  const relationshipGraphPaneResizeCleanupRef = useRef<(() => void) | null>(null);
  const lastHandledScanRequestIdRef = useRef(scanRequestId);
  const relationshipCanvasTargetRequestIdRef = useRef(0);

  useEffect(() => {
    onSummaryStateChange(relationshipScanState);
  }, [onSummaryStateChange, relationshipScanState]);

  useEffect(() => {
    return () => {
      relationshipGraphPaneResizeCleanupRef.current?.();
      relationshipGraphPaneResizeCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    setRelationshipGraphExpandedSide(null);
    setRelationshipGraphPan({ x: 0, y: 0 });
  }, [selectedRelationshipFileId]);

  useEffect(() => {
    setRelationshipGraphPan({ x: 0, y: 0 });
  }, [relationshipDashboardTypeFilter]);

  const refreshRelationshipCanvasTargets = useCallback(async () => {
    const requestId = relationshipCanvasTargetRequestIdRef.current + 1;
    relationshipCanvasTargetRequestIdRef.current = requestId;
    if (!activeWorkspaceId || !onOpenIntentCanvasFromRelationship) {
      setRelationshipCanvasTargetEntries([]);
      setRelationshipCanvasTargetLoadError(null);
      setRelationshipCanvasImportTarget(PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET);
      return;
    }
    try {
      const result = await loadIntentCanvasIndex(activeWorkspaceId);
      if (relationshipCanvasTargetRequestIdRef.current !== requestId) {
        return;
      }
      setRelationshipCanvasTargetEntries(result.value);
      setRelationshipCanvasTargetLoadError(null);
    } catch (error) {
      if (relationshipCanvasTargetRequestIdRef.current !== requestId) {
        return;
      }
      setRelationshipCanvasTargetEntries([]);
      setRelationshipCanvasTargetLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [activeWorkspaceId, onOpenIntentCanvasFromRelationship]);

  useEffect(() => {
    void refreshRelationshipCanvasTargets();
  }, [expanded, refreshRelationshipCanvasTargets]);

  useEffect(() => {
    if (
      relationshipCanvasImportTarget !== PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET &&
      !relationshipCanvasTargetEntries.some((entry) => entry.id === relationshipCanvasImportTarget)
    ) {
      setRelationshipCanvasImportTarget(PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET);
    }
  }, [relationshipCanvasImportTarget, relationshipCanvasTargetEntries]);

  useEffect(() => {
    if (relationshipDashboardViewMode !== "graph") {
      return;
    }
    const canvasElement = relationshipGraphCanvasRef.current;
    if (!canvasElement) {
      return;
    }
    const updateGraphScale = () => {
      const rect = canvasElement.getBoundingClientRect();
      const nextScale = Math.min(
        1,
        Math.max(
          0.54,
          Math.min(
            (rect.width - 28) / PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH,
            (rect.height - 28) / PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT,
          ),
        ),
      );
      setRelationshipGraphScale(Number(nextScale.toFixed(3)));
    };

    updateGraphScale();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateGraphScale);
      return () => window.removeEventListener("resize", updateGraphScale);
    }

    const resizeObserver = new ResizeObserver(updateGraphScale);
    resizeObserver.observe(canvasElement);
    return () => resizeObserver.disconnect();
  }, [
    isRelationshipGraphInspectorCollapsed,
    isRelationshipGraphRailCollapsed,
    relationshipDashboardViewMode,
  ]);

  const runRelationshipScan = useCallback((scope?: ProjectMapRelationshipScanScope) => {
    const workspaceId = activeWorkspaceId;
    if (!workspaceId || relationshipScanState.status === "running") {
      return;
    }
    const scopedChangedFiles = scope?.changedFiles ?? [];
    const scopedPaths = scope?.paths?.filter((path) => path.trim().length > 0);
    const shouldStayInApiView = relationshipDashboardViewMode === "api";

    setRelationshipScanState({ status: "running" });
    void scanProjectMapRelationships({
      workspaceId,
      options: {
        maxFiles: 10_000,
        includeIgnoredHints: true,
        paths: scopedPaths?.length ? scopedPaths : undefined,
        changedFiles: scopedChangedFiles.length ? scopedChangedFiles : undefined,
      },
      storageLocation: activeReadLocation,
      })
      .then(async (summary) => {
        setRelationshipScanState({ status: "success", summary });
        try {
          const response = await readProjectMapRelationships({
            workspaceId,
            storageLocation: activeReadLocation,
          });
          const dashboardData = normalizeProjectMapRelationshipDashboardData(response);
          setRelationshipDashboardData(reconcileProjectMapRelationshipDashboardDataAfterScan({
            scanSummary: summary,
            dashboardData,
          }));
          setSelectedRelationshipFileId(null);
          setInspectedRelationshipFileId(null);
          setSelectedRelationshipRelationId(null);
          setSelectedApiGroupId(null);
          setSelectedApiEndpointId(null);
          setRelationshipDashboardViewMode(shouldStayInApiView ? "api" : "graph");
          await reloadRelationshipContext();
        } catch {
          setRelationshipDashboardData(null);
        }
      })
      .catch((error) => {
        setRelationshipScanState({
          status: "failed",
          message: normalizeProjectMapRelationshipError(error),
        });
      });
  }, [
    activeWorkspaceId,
    activeReadLocation,
    reloadRelationshipContext,
    relationshipDashboardViewMode,
    relationshipScanState.status,
  ]);

  useEffect(() => {
    if (scanRequestId <= lastHandledScanRequestIdRef.current) {
      return;
    }
    lastHandledScanRequestIdRef.current = scanRequestId;
    runRelationshipScan();
  }, [runRelationshipScan, scanRequestId]);

  const handleRelationshipScanClick = useCallback(() => {
    runRelationshipScan();
  }, [runRelationshipScan]);

  const handleRelationshipStaleRefreshClick = useCallback(() => {
    const refreshSuggestion = relationshipDashboardData?.staleSummary?.refreshSuggestion;
    const scopedFiles = refreshSuggestion?.changedFiles ?? [];
    const shouldUsePartialScope = refreshSuggestion?.mode === "partial";
    runRelationshipScan({
      paths: shouldUsePartialScope ? scopedFiles : undefined,
      changedFiles: shouldUsePartialScope && scopedFiles.length ? scopedFiles : undefined,
    });
  }, [relationshipDashboardData?.staleSummary?.refreshSuggestion, runRelationshipScan]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setRelationshipScanState({ status: "idle" });
      setRelationshipDashboardData(null);
      setSelectedRelationshipFileId(null);
      setInspectedRelationshipFileId(null);
      setSelectedRelationshipRelationId(null);
      setSelectedApiGroupId(null);
      setSelectedApiEndpointId(null);
      return;
    }

    let cancelled = false;
    void readProjectMapRelationships({
      workspaceId: activeWorkspaceId,
      storageLocation: activeReadLocation,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const summary = normalizeProjectMapRelationshipReadSummary(response);
        const dashboardData = normalizeProjectMapRelationshipDashboardData(response);
        setRelationshipDashboardData(summary ? dashboardData : null);
        if (summary) {
          setRelationshipDashboardViewMode("graph");
        }
        void reloadRelationshipContext();
        setRelationshipScanState((current) => {
          if (current.status === "running") {
            return current;
          }
          if (!summary) {
            return { status: "idle" };
          }
          if (current.status === "success" && current.summary.scanRunId === summary.scanRunId) {
            return current;
          }
          return { status: "success", summary };
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message = normalizeProjectMapRelationshipError(error);
        setRelationshipDashboardData(null);
        setRelationshipScanState((current) =>
          current.status === "running" ? current : { status: "failed", message },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, activeReadLocation, reloadRelationshipContext]);

  const {
    inspectedRelationshipFile,
    relationshipDashboardDirectionCountByFile,
    relationshipDashboardExplorerRenderedFileCount,
    relationshipDashboardFileIndex,
    relationshipDashboardFileTreeGroups,
    relationshipDashboardFilteredFiles,
    relationshipDashboardModuleByFileId,
    relationshipDashboardRelationCountByFile,
    relationshipDashboardRoleOptions,
    relationshipDashboardTopFileGroups,
    relationshipDashboardTypeOptions,
    relationshipDashboardVisibleFileTotal,
    selectedRelationshipFile,
  } = useProjectMapRelationshipFileProjection({
    expandedRelationshipFileGroups,
    inspectedRelationshipFileId,
    relationshipDashboardData,
    relationshipDashboardQuery,
    relationshipDashboardRoleFilter,
    selectedRelationshipFileId,
    showRelationshipNoiseFiles,
  });

  useEffect(() => {
    const nextSelectedRelationshipFileId = selectedRelationshipFile?.id ?? null;
    if (nextSelectedRelationshipFileId === selectedRelationshipFileId) {
      return;
    }
    setSelectedRelationshipFileId(nextSelectedRelationshipFileId);
    setSelectedRelationshipRelationId(null);
  }, [
    selectedRelationshipFile?.id,
    selectedRelationshipFileId,
  ]);

  const toggleRelationshipTopRoleGroup = useCallback((groupId: string, isExpanded: boolean) => {
    setExpandedRelationshipTopRoleGroups((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
    setCollapsedRelationshipTopRoleGroups((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.add(groupId);
      } else {
        next.delete(groupId);
      }
      return next;
    });
  }, []);

  const toggleRelationshipTopModuleGroup = useCallback((groupId: string, isExpanded: boolean) => {
    setExpandedRelationshipTopModuleGroups((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
    setCollapsedRelationshipTopModuleGroups((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.add(groupId);
      } else {
        next.delete(groupId);
      }
      return next;
    });
  }, []);

  const toggleRelationshipTopFileGroup = useCallback((groupId: string) => {
    setExpandedRelationshipTopFileGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const toggleRelationshipFileTreeGroup = useCallback((groupId: string) => {
    setExpandedRelationshipFileGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const {
    inspectedRelationshipRelations,
    relationshipDashboardGraph,
    selectedRelationshipRelation,
    selectedRelationshipRelationGroups,
  } = useProjectMapRelationshipGraphProjection({
    inspectedRelationshipFile,
    relationshipDashboardData,
    relationshipDashboardDirectionCountByFile,
    relationshipDashboardFilteredFiles,
    relationshipDashboardFileIndex,
    relationshipDashboardLayoutPreset,
    relationshipDashboardRelationCountByFile,
    relationshipDashboardTypeFilter,
    relationshipGraphExpandedSide,
    selectedRelationshipFile,
    selectedRelationshipRelationId,
    t,
  });

  const handleRelationshipGraphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, input, select, textarea, .project-map-relationship-graph-node, .project-map-relationship-graph-edge, .project-map-relationship-graph-canvas-header, .project-map-relationship-graph-minimap",
      )
    ) {
      return;
    }
    relationshipGraphPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: relationshipGraphPan.x,
      originY: relationshipGraphPan.y,
    };
    setIsRelationshipGraphPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleRelationshipGraphPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panStart = relationshipGraphPanRef.current;
    if (!panStart || panStart.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    setRelationshipGraphPan({
      x: panStart.originX + event.clientX - panStart.startX,
      y: panStart.originY + event.clientY - panStart.startY,
    });
  };

  const handleRelationshipGraphPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (relationshipGraphPanRef.current?.pointerId !== event.pointerId) {
      return;
    }
    relationshipGraphPanRef.current = null;
    setIsRelationshipGraphPanning(false);
  };

  const beginRelationshipGraphPaneResize = useCallback((
    pane: "rail" | "inspector",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!relationshipGraphDashboardRef.current) {
      return;
    }
    relationshipGraphPaneResizeCleanupRef.current?.();
    relationshipGraphPaneResizeCleanupRef.current = null;
    const startX = event.clientX;
    const startRailWidth = relationshipGraphRailWidth;
    const startInspectorWidth = relationshipGraphInspectorWidth;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      if (pane === "rail") {
        setRelationshipGraphRailWidth(clampProjectMapRelationshipPaneWidth(
          startRailWidth + delta,
          PROJECT_MAP_RELATIONSHIP_GRAPH_RAIL_MIN_WIDTH,
          PROJECT_MAP_RELATIONSHIP_GRAPH_RAIL_MAX_WIDTH,
        ));
        return;
      }
      setRelationshipGraphInspectorWidth(clampProjectMapRelationshipPaneWidth(
        startInspectorWidth - delta,
        PROJECT_MAP_RELATIONSHIP_GRAPH_INSPECTOR_MIN_WIDTH,
        PROJECT_MAP_RELATIONSHIP_GRAPH_INSPECTOR_MAX_WIDTH,
      ));
    };
    const cleanupResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      relationshipGraphPaneResizeCleanupRef.current = null;
    };
    const handlePointerUp = () => {
      cleanupResize();
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    relationshipGraphPaneResizeCleanupRef.current = cleanupResize;
  }, [relationshipGraphInspectorWidth, relationshipGraphRailWidth]);

  const normalizeRelationshipCanvasImportError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      return error.message || t("projectMap.relationship.importFailureUnknown");
    }
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
    return t("projectMap.relationship.importFailureUnknown");
  }, [t]);

  const resolveRelationshipCanvasRequestTarget = useCallback((targetValue: string): Pick<
    IntentCanvasOpenRequest,
    "target" | "canvasId"
  > => {
    if (targetValue === PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET) {
      return { target: "new", canvasId: null };
    }
    return { target: "append", canvasId: targetValue };
  }, []);

  const handleImportRelationshipNeighborhoodToCanvas = useCallback(async (targetValue: string) => {
    if (!inspectedRelationshipFile) {
      setRelationshipCanvasImportError(t("projectMap.relationship.importNoFile"));
      return;
    }
    if (!activeWorkspaceId) {
      setRelationshipCanvasImportError(t("projectMap.relationship.importNoWorkspace"));
      return;
    }
    if (!onOpenIntentCanvasFromRelationship) {
      setRelationshipCanvasImportError(t("projectMap.relationship.importNotReady"));
      return;
    }
    if (!inspectedRelationshipRelations.length) {
      setRelationshipCanvasImportError(t("projectMap.relationship.importNoRelations"));
      return;
    }
    setIsRelationshipCanvasImporting(true);
    setRelationshipCanvasImportError(null);
    try {
      const graph = projectRelationshipFileRelationsToCanvasSemanticGraph({
        workspaceId: activeWorkspaceId,
        centerFile: inspectedRelationshipFile,
        relations: inspectedRelationshipRelations,
        filesById: relationshipDashboardFileIndex,
        scan: relationshipScanState.status === "success"
          ? {
              scanRunId: relationshipScanState.summary.scanRunId,
              generatedAt: relationshipScanState.summary.generatedAt,
            }
          : undefined,
        maxNodes: 40,
        maxEdges: 80,
      });
      onOpenIntentCanvasFromRelationship({
        mode: "architect",
        ...resolveRelationshipCanvasRequestTarget(targetValue),
        title: t("projectMap.relationship.importNodeTitle", {
          file: inspectedRelationshipFile.basename,
        }),
        summary: t("projectMap.relationship.importNodeSummary", {
          path: inspectedRelationshipFile.path,
          file: inspectedRelationshipFile.basename,
          count: inspectedRelationshipRelations.length,
        }),
        source: {
          filePath: inspectedRelationshipFile.path,
          nodeTitle: inspectedRelationshipFile.basename,
          nodeKind: inspectedRelationshipFile.role ?? inspectedRelationshipFile.language,
          summary: inspectedRelationshipFile.path,
        },
        seedSemanticGraphs: [graph],
      });
    } catch (error) {
      setRelationshipCanvasImportError(normalizeRelationshipCanvasImportError(error));
    } finally {
      setIsRelationshipCanvasImporting(false);
    }
  }, [
    activeWorkspaceId,
    inspectedRelationshipFile,
    inspectedRelationshipRelations,
    onOpenIntentCanvasFromRelationship,
    normalizeRelationshipCanvasImportError,
    relationshipDashboardFileIndex,
    relationshipScanState,
    resolveRelationshipCanvasRequestTarget,
    t,
  ]);

  const handleImportRelationshipEdgeToCanvas = useCallback(async (targetValue: string) => {
    if (!selectedRelationshipRelation) {
      setRelationshipCanvasImportError(t("projectMap.relationship.importNoEdge"));
      return;
    }
    if (!activeWorkspaceId) {
      setRelationshipCanvasImportError(t("projectMap.relationship.importNoWorkspace"));
      return;
    }
    if (!onOpenIntentCanvasFromRelationship) {
      setRelationshipCanvasImportError(t("projectMap.relationship.importNotReady"));
      return;
    }
    setIsRelationshipCanvasImporting(true);
    setRelationshipCanvasImportError(null);
    try {
      const edgeContext = await queryProjectMapRelationshipEdge({
        workspaceId: activeWorkspaceId,
        edgeId: selectedRelationshipRelation.id,
        storageLocation: activeReadLocation,
      });
      if (!edgeContext) {
        throw new Error(t("projectMap.relationship.importEdgeUnavailable"));
      }
      const graph = projectRelationshipEdgeToCanvasSemanticGraph({
        workspaceId: activeWorkspaceId,
        edgeContext,
      });
      onOpenIntentCanvasFromRelationship({
        mode: "architect",
        ...resolveRelationshipCanvasRequestTarget(targetValue),
        title: t("projectMap.relationship.importEdgeTitle", {
          source: (edgeContext.sourceNode?.basename || edgeContext.relation.sourceFileId),
          target: (edgeContext.targetNode?.basename || edgeContext.relation.targetFileId),
        }),
        summary: t("projectMap.relationship.importEdgeSummary", {
          source: (edgeContext.sourceNode?.path || edgeContext.relation.sourceFileId),
          target: (edgeContext.targetNode?.path || edgeContext.relation.targetFileId),
          type: selectedRelationshipRelation.type,
        }),
        source: {
          filePath: edgeContext.sourceNode?.path || edgeContext.relation.sourceFileId,
          nodeTitle: `${edgeContext.sourceNode?.basename || edgeContext.relation.sourceFileId} -> ${edgeContext.targetNode?.basename || edgeContext.relation.targetFileId}`,
          nodeKind: edgeContext.relation.type,
          summary: t("projectMap.relationship.importEdgeSummary", {
            source: edgeContext.sourceNode?.path || edgeContext.relation.sourceFileId,
            target: edgeContext.targetNode?.path || edgeContext.relation.targetFileId,
            type: selectedRelationshipRelation.type,
          }),
        },
        seedSemanticGraphs: [graph],
      });
    } catch (error) {
      setRelationshipCanvasImportError(normalizeRelationshipCanvasImportError(error));
    } finally {
      setIsRelationshipCanvasImporting(false);
    }
  }, [
    activeReadLocation,
    activeWorkspaceId,
    onOpenIntentCanvasFromRelationship,
    normalizeRelationshipCanvasImportError,
    resolveRelationshipCanvasRequestTarget,
    selectedRelationshipRelation,
    t,
  ]);

  useEffect(() => {
    setRelationshipCanvasImportError(null);
  }, [inspectedRelationshipFile?.id, selectedRelationshipRelationId]);

  const {
    apiContractScanExists,
    apiControllerGroupsByModuleId,
    apiEndpointCount,
    apiEndpointSections,
    apiFilterOptions,
    apiGraphMode,
    apiGroups,
    apiModuleGroups,
    apiSearchQuery,
    selectedApiCallChains,
    selectedApiEndpoint,
    selectedApiGroup,
    selectedApiGroupEndpoints,
    selectedApiModuleGroup,
  } = useProjectMapRelationshipApiProjection({
    apiConfidenceFilter,
    apiControllerFilter,
    apiFrameworkFilter,
    apiLanguageFilter,
    apiModuleFilter,
    apiProtocolFilter,
    relationshipDashboardData,
    relationshipDashboardQuery,
    relationshipDashboardViewMode,
    selectedApiEndpointId,
    selectedApiGroupId,
    setExpandedApiModuleGroupIds,
  });

  const supportsRelationshipDashboardZoom =
    relationshipDashboardViewMode === "graph" || relationshipDashboardViewMode === "files" || relationshipDashboardViewMode === "api";

  const handleRelationshipDashboardZoomOut = useCallback(() => {
    if (relationshipDashboardViewMode === "files") {
      setRelationshipFilesZoom((current) => Number(Math.max(0.7, current - 0.1).toFixed(2)));
      return;
    }
    setRelationshipGraphZoom((current) => Number(Math.max(0.7, current - 0.1).toFixed(2)));
  }, [relationshipDashboardViewMode]);

  const handleRelationshipDashboardZoomIn = useCallback(() => {
    if (relationshipDashboardViewMode === "files") {
      setRelationshipFilesZoom((current) => Number(Math.min(1.8, current + 0.1).toFixed(2)));
      return;
    }
    setRelationshipGraphZoom((current) => Number(Math.min(1.8, current + 0.1).toFixed(2)));
  }, [relationshipDashboardViewMode]);

  const handleRelationshipDashboardViewReset = useCallback(() => {
    if (relationshipDashboardViewMode === "files") {
      setRelationshipFilesZoom(1);
      return;
    }
    setRelationshipGraphPan({ x: 0, y: 0 });
    setRelationshipGraphZoom(1);
  }, [relationshipDashboardViewMode]);

  const openProjectMapRelationshipPath = useCallback((path: string | null | undefined, line?: number | null) => {
    const normalizedPath = path?.trim();
    if (!normalizedPath || !onOpenEvidenceFile) {
      return;
    }
    onOpenEvidenceFile(
      normalizedPath,
      line ? { line, column: 1 } : undefined,
    );
  }, [onOpenEvidenceFile]);

  const openProjectMapRelationshipFileWithEvidence = useCallback((input: {
    filePath: string | null | undefined;
    preferredLine?: number | null;
    evidencePath?: string | null;
    evidenceLine?: number | null;
  }) => {
    const filePath = input.filePath?.trim();
    if (!filePath) {
      return;
    }
    const evidencePath = input.evidencePath?.trim();
    const evidenceMatchesFile =
      Boolean(evidencePath)
      && (
        evidencePath === filePath
        || evidencePath?.endsWith(`/${filePath}`)
        || filePath.endsWith(`/${evidencePath}`)
      );
    openProjectMapRelationshipPath(
      filePath,
      input.preferredLine ?? (evidenceMatchesFile ? input.evidenceLine : null),
    );
  }, [openProjectMapRelationshipPath]);

  const focusProjectMapRelationshipRelation = useCallback((direction: "incoming" | "outgoing" | "total") => {
    if (!inspectedRelationshipFile) {
      return;
    }
    const selectedFileId = inspectedRelationshipFile.id;
    const relation =
      direction === "incoming"
        ? inspectedRelationshipRelations.find((item) => item.targetFileId === selectedFileId)
        : direction === "outgoing"
          ? inspectedRelationshipRelations.find((item) => item.sourceFileId === selectedFileId)
          : inspectedRelationshipRelations[0];
    if (relation) {
      setSelectedRelationshipRelationId(relation.id);
    }
  }, [inspectedRelationshipFile, inspectedRelationshipRelations]);

  if (!expanded) {
    return null;
  }

  return (
                <section className="project-map-relationship-scan-panel">
                  <header>
                    <Network aria-hidden />
                    <div className="project-map-relationship-scan-title">
                      <h4>{t("projectMap.relationship.dashboardTitle")}</h4>
                      <p>
                        {relationshipScanState.status === "success"
                          ? t("projectMap.relationship.dashboardReady", {
                              runId: relationshipScanState.summary.scanRunId,
                            })
                          : t("projectMap.relationship.dashboardEmpty")}
                      </p>
                      {relationshipScanState.status === "success" ? (
                        <div className="project-map-relationship-scan-metrics">
                          <span>
                            <strong>{relationshipScanState.summary.fileCount}</strong>
                            {t("projectMap.relationship.metricFiles")}
                          </span>
                          <span>
                            <strong>{relationshipScanState.summary.relationCount}</strong>
                            {t("projectMap.relationship.metricRelations")}
                          </span>
                          <span>
                            <strong>{relationshipScanState.summary.ignoredCount}</strong>
                            {t("projectMap.relationship.metricIgnored")}
                          </span>
                          <span>
                            <strong>{relationshipScanState.summary.repairIssueCount}</strong>
                            {t("projectMap.relationship.metricRepair")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="project-map-toolbar-action"
                      onClick={handleRelationshipScanClick}
                      disabled={!activeWorkspaceId || relationshipScanState.status === "running"}
                    >
                      <RefreshCw aria-hidden />
                      {relationshipScanState.status === "running"
                        ? t("projectMap.relationship.scanning")
                        : t("projectMap.relationship.scan")}
                    </button>
                  </header>
                  {relationshipScanState.status === "running" ? (
                    <div
                      className="project-map-relationship-scan-loading"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="project-map-relationship-scan-loading-card">
                        <strong>{t("projectMap.relationship.scanLoadingTitle")}</strong>
                        <div className="project-map-relationship-scan-progress" aria-hidden>
                          <span />
                        </div>
                        <p>{t("projectMap.relationship.scanLoadingBody")}</p>
                      </div>
                    </div>
                  ) : null}
                  {relationshipDashboardData ? (
                    <div className="project-map-relationship-dashboard">
                      <div className="project-map-relationship-dashboard-topbar">
                        <div className="project-map-relationship-view-switch">
                          {PROJECT_MAP_RELATIONSHIP_VIEW_ORDER.map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={cn(
                                `is-${mode}`,
                                relationshipDashboardViewMode === mode && "is-active",
                              )}
                              onClick={() => setRelationshipDashboardViewMode(mode)}
                            >
                              {t(`projectMap.relationship.view.${mode}`)}
                            </button>
                          ))}
                        </div>
                        <div className="project-map-relationship-dashboard-topbar-actions">
                          {supportsRelationshipDashboardZoom ? (
                            <div className="project-map-relationship-graph-layout-controls">
                              <button
                                type="button"
                                className="is-zoom-out"
                                onClick={handleRelationshipDashboardZoomOut}
                              >
                                {t("projectMap.relationship.graphZoomOut")}
                              </button>
                              <button
                                type="button"
                                className="is-zoom-in"
                                onClick={handleRelationshipDashboardZoomIn}
                              >
                                {t("projectMap.relationship.graphZoomIn")}
                              </button>
                              {relationshipDashboardViewMode === "graph" ? (
                                <>
                                  <button
                                    type="button"
                                    className={cn(
                                      "is-files",
                                      !isRelationshipGraphRailCollapsed && "is-active",
                                    )}
                                    onClick={() => setIsRelationshipGraphRailCollapsed((current) => !current)}
                                  >
                                    {isRelationshipGraphRailCollapsed
                                      ? t("projectMap.relationship.graphShowFiles")
                                      : t("projectMap.relationship.graphHideFiles")}
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(
                                      "is-inspector",
                                      !isRelationshipGraphInspectorCollapsed && "is-active",
                                    )}
                                    onClick={() => setIsRelationshipGraphInspectorCollapsed((current) => !current)}
                                  >
                                    {isRelationshipGraphInspectorCollapsed
                                      ? t("projectMap.relationship.graphShowInspector")
                                      : t("projectMap.relationship.graphHideInspector")}
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="is-reset"
                                onClick={handleRelationshipDashboardViewReset}
                              >
                                {t("projectMap.relationship.graphResetView")}
                              </button>
                              <label className="project-map-relationship-layout-preset">
                                <span>{t("projectMap.layoutPreset")}</span>
                                <select
                                  value={relationshipDashboardLayoutPreset}
                                  aria-label={t("projectMap.layoutPreset")}
                                  onChange={(event) => (
                                    setRelationshipDashboardLayoutPreset(
                                      event.currentTarget.value as ProjectMapRelationshipLayoutPreset,
                                    )
                                  )}
                                >
                                  <option value="radial">{t("projectMap.layoutPresetRadial")}</option>
                                  <option value="tree">{t("projectMap.layoutPresetTree")}</option>
                                  <option value="force">{t("projectMap.layoutPresetForce")}</option>
                                </select>
                              </label>
                            </div>
                          ) : null}
                          <div className={cn(
                            "project-map-relationship-dashboard-chrome-header",
                            isRelationshipDashboardChromeCollapsed && "is-collapsed",
                          )}>
                            <button
                              type="button"
                              className="project-map-relationship-dashboard-chrome-toggle"
                              onClick={() => setIsRelationshipDashboardChromeCollapsed((current) => !current)}
                            >
                              {isRelationshipDashboardChromeCollapsed
                                ? t("projectMap.relationship.chromeShow")
                                : t("projectMap.relationship.chromeHide")}
                            </button>
                            {isRelationshipDashboardChromeCollapsed ? (
                              <span>
                                {t("projectMap.relationship.chromeSummary", {
                                  files: relationshipDashboardData.files.length,
                                  relations: relationshipDashboardData.relations.length,
                                  freshness:
                                    relationshipDashboardData.staleSummary && !relationshipDashboardData.staleSummary.isFresh
                                      ? t("projectMap.relationship.chromeStale")
                                      : t("projectMap.relationship.chromeFresh"),
                                })}
                              </span>
                            ) : null}
                            {isRelationshipDashboardChromeCollapsed
                              && relationshipDashboardData.staleSummary
                              && !relationshipDashboardData.staleSummary.isFresh ? (
                              <button
                                type="button"
                                className="project-map-relationship-dashboard-chrome-refresh"
                                onClick={handleRelationshipStaleRefreshClick}
                                disabled={!activeWorkspaceId || relationshipScanState.status === "running"}
                              >
                                <RefreshCw aria-hidden />
                                {t("projectMap.relationship.staleRefresh", {
                                  mode: relationshipDashboardData.staleSummary.refreshSuggestion?.mode ?? "full",
                                })}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "project-map-relationship-dashboard-chrome",
                        isRelationshipDashboardChromeCollapsed && "is-collapsed",
                      )}>
                        {!isRelationshipDashboardChromeCollapsed ? (
                          <>
                            {relationshipDashboardData.staleSummary && !relationshipDashboardData.staleSummary.isFresh ? (
                              <div className="project-map-relationship-stale-banner">
                                <div>
                                  <strong>{t("projectMap.relationship.staleTitle")}</strong>
                                  <span>
                                    {relationshipDashboardData.staleSummary.reasons[0]?.message
                                      ?? t("projectMap.relationship.staleFallback")}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="project-map-toolbar-action"
                                  onClick={handleRelationshipStaleRefreshClick}
                                  disabled={!activeWorkspaceId || relationshipScanState.status === "running"}
                                >
                                  <RefreshCw aria-hidden />
                                  {t("projectMap.relationship.staleRefresh", {
                                    mode: relationshipDashboardData.staleSummary.refreshSuggestion?.mode ?? "full",
                                  })}
                                </button>
                              </div>
                            ) : null}
                            <div className="project-map-relationship-dashboard-rule">
                              <strong>{t("projectMap.relationship.snapshotLabel")}</strong>
                              <span>{t("projectMap.relationship.snapshotRule")}</span>
                            </div>
                            <div className="project-map-relationship-dashboard-controls">
                              <label>
                                <span>
                                  {relationshipDashboardViewMode === "api"
                                    ? t("projectMap.relationship.apiSearchLabel")
                                    : t("projectMap.relationship.searchLabel")}
                                </span>
                                <input
                                  value={relationshipDashboardQuery}
                                  onChange={(event) => setRelationshipDashboardQuery(event.target.value)}
                                  placeholder={relationshipDashboardViewMode === "api"
                                    ? t("projectMap.relationship.apiSearchPlaceholder")
                                    : t("projectMap.relationship.searchPlaceholder")}
                                />
                              </label>
                              {relationshipDashboardViewMode !== "api" ? (
                                <>
                                  <label>
                                    <span>{t("projectMap.relationship.typeFilterLabel")}</span>
                                    <select
                                      value={relationshipDashboardTypeFilter}
                                      onChange={(event) => setRelationshipDashboardTypeFilter(event.target.value)}
                                    >
                                      <option value={PROJECT_MAP_RELATION_FILTER_ALL}>
                                        {t("projectMap.relationship.allTypes")}
                                      </option>
                                      {relationshipDashboardTypeOptions.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    <span>{t("projectMap.relationship.roleFilterLabel")}</span>
                                    <select
                                      value={relationshipDashboardRoleFilter}
                                      onChange={(event) => setRelationshipDashboardRoleFilter(event.target.value)}
                                    >
                                      <option value={PROJECT_MAP_RELATION_FILTER_ALL}>
                                        {t("projectMap.relationship.allRoles")}
                                      </option>
                                      {relationshipDashboardRoleOptions.map((role) => (
                                        <option key={role} value={role}>{role}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    className={cn(
                                      "project-map-relationship-noise-toggle",
                                      showRelationshipNoiseFiles && "is-active",
                                    )}
                                    onClick={() => {
                                      setRelationshipDashboardRoleFilter(PROJECT_MAP_RELATION_FILTER_ALL);
                                      setShowRelationshipNoiseFiles((current) => !current);
                                    }}
                                  >
                                    {showRelationshipNoiseFiles
                                      ? t("projectMap.relationship.hideNoise")
                                      : t("projectMap.relationship.showNoise")}
                                  </button>
                                </>
                              ) : null}
                            </div>
                            {relationshipDashboardViewMode !== "api" ? (
                              <div className="project-map-relationship-role-strip">
                                <button
                                  type="button"
                                  className={cn(
                                    relationshipDashboardRoleFilter === PROJECT_MAP_RELATION_FILTER_ALL && "is-active",
                                  )}
                                  onClick={() => setRelationshipDashboardRoleFilter(PROJECT_MAP_RELATION_FILTER_ALL)}
                                >
                                  {t("projectMap.relationship.allRoles")}
                                </button>
                                {relationshipDashboardRoleOptions.slice(0, 10).map((role) => (
                                  <button
                                    key={role}
                                    type="button"
                                    className={cn(
                                      relationshipDashboardRoleFilter === role && "is-active",
                                    )}
                                    onClick={() => setRelationshipDashboardRoleFilter(role)}
                                  >
                                    {role}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      {relationshipDashboardViewMode === "graph" ? (
                        <ProjectMapRelationshipGraphWorkspace
                          activeCodeSelectionAnchor={activeCodeSelectionAnchor}
                          beginRelationshipGraphPaneResize={beginRelationshipGraphPaneResize}
                          collapsedRelationshipTopModuleGroups={collapsedRelationshipTopModuleGroups}
                          collapsedRelationshipTopRoleGroups={collapsedRelationshipTopRoleGroups}
                          expandedRelationshipTopFileGroups={expandedRelationshipTopFileGroups}
                          expandedRelationshipTopModuleGroups={expandedRelationshipTopModuleGroups}
                          expandedRelationshipTopRoleGroups={expandedRelationshipTopRoleGroups}
                          focusProjectMapRelationshipRelation={focusProjectMapRelationshipRelation}
                          handleImportRelationshipEdgeToCanvas={handleImportRelationshipEdgeToCanvas}
                          handleImportRelationshipNeighborhoodToCanvas={handleImportRelationshipNeighborhoodToCanvas}
                          handleRelationshipGraphPointerDown={handleRelationshipGraphPointerDown}
                          handleRelationshipGraphPointerEnd={handleRelationshipGraphPointerEnd}
                          handleRelationshipGraphPointerMove={handleRelationshipGraphPointerMove}
                          inspectedRelationshipFile={inspectedRelationshipFile}
                          inspectedRelationshipRelations={inspectedRelationshipRelations}
                          isRelationshipCanvasImporting={isRelationshipCanvasImporting}
                          isRelationshipGraphInspectorCollapsed={isRelationshipGraphInspectorCollapsed}
                          isRelationshipGraphPanning={isRelationshipGraphPanning}
                          isRelationshipGraphRailCollapsed={isRelationshipGraphRailCollapsed}
                          onOpenEvidenceFile={onOpenEvidenceFile}
                          onOpenIntentCanvasFromRelationship={onOpenIntentCanvasFromRelationship}
                          openProjectMapRelationshipFileWithEvidence={openProjectMapRelationshipFileWithEvidence}
                          openProjectMapRelationshipPath={openProjectMapRelationshipPath}
                          relationshipCanvasImportError={relationshipCanvasImportError}
                          relationshipCanvasImportTarget={relationshipCanvasImportTarget}
                          relationshipCanvasTargetEntries={relationshipCanvasTargetEntries}
                          relationshipCanvasTargetLoadError={relationshipCanvasTargetLoadError}
                          relationshipDashboardData={relationshipDashboardData}
                          relationshipDashboardDirectionCountByFile={relationshipDashboardDirectionCountByFile}
                          relationshipDashboardFileIndex={relationshipDashboardFileIndex}
                          relationshipDashboardFilteredFiles={relationshipDashboardFilteredFiles}
                          relationshipDashboardGraph={relationshipDashboardGraph}
                          relationshipDashboardRelationCountByFile={relationshipDashboardRelationCountByFile}
                          relationshipDashboardTopFileGroups={relationshipDashboardTopFileGroups}
                          relationshipDashboardTypeFilter={relationshipDashboardTypeFilter}
                          relationshipDashboardVisibleFileTotal={relationshipDashboardVisibleFileTotal}
                          relationshipGraphCanvasRef={relationshipGraphCanvasRef}
                          relationshipGraphDashboardRef={relationshipGraphDashboardRef}
                          relationshipGraphInspectorWidth={relationshipGraphInspectorWidth}
                          relationshipGraphPan={relationshipGraphPan}
                          relationshipGraphRailWidth={relationshipGraphRailWidth}
                          relationshipGraphScale={relationshipGraphScale}
                          relationshipGraphZoom={relationshipGraphZoom}
                          selectedRelationshipFile={selectedRelationshipFile}
                          selectedRelationshipRelation={selectedRelationshipRelation}
                          selectedRelationshipRelationGroups={selectedRelationshipRelationGroups}
                          setInspectedRelationshipFileId={setInspectedRelationshipFileId}
                          setRelationshipCanvasImportTarget={setRelationshipCanvasImportTarget}
                          setRelationshipDashboardTypeFilter={setRelationshipDashboardTypeFilter}
                          setRelationshipGraphExpandedSide={setRelationshipGraphExpandedSide}
                          setSelectedRelationshipFileId={setSelectedRelationshipFileId}
                          setSelectedRelationshipRelationId={setSelectedRelationshipRelationId}
                          setShowRelationshipNoiseFiles={setShowRelationshipNoiseFiles}
                          toggleRelationshipTopFileGroup={toggleRelationshipTopFileGroup}
                          toggleRelationshipTopModuleGroup={toggleRelationshipTopModuleGroup}
                          toggleRelationshipTopRoleGroup={toggleRelationshipTopRoleGroup}
                        />
                      ) : null}
                      {relationshipDashboardViewMode === "api" ? (
                        <ProjectMapRelationshipApiWorkspace
                          activeWorkspaceId={activeWorkspaceId}
                          apiConfidenceFilter={apiConfidenceFilter}
                          apiContractScanExists={apiContractScanExists}
                          apiControllerFilter={apiControllerFilter}
                          apiControllerGroupsByModuleId={apiControllerGroupsByModuleId}
                          apiEndpointCount={apiEndpointCount}
                          apiEndpointSections={apiEndpointSections}
                          apiFilterOptions={apiFilterOptions}
                          apiFrameworkFilter={apiFrameworkFilter}
                          apiGraphMode={apiGraphMode}
                          apiGroups={apiGroups}
                          apiLanguageFilter={apiLanguageFilter}
                          apiModuleFilter={apiModuleFilter}
                          apiModuleGroups={apiModuleGroups}
                          apiProtocolFilter={apiProtocolFilter}
                          apiSearchQuery={apiSearchQuery}
                          expandedApiModuleGroupIds={expandedApiModuleGroupIds}
                          handleRelationshipScanClick={handleRelationshipScanClick}
                          openProjectMapRelationshipPath={openProjectMapRelationshipPath}
                          relationshipDashboardData={relationshipDashboardData}
                          relationshipDashboardLayoutPreset={relationshipDashboardLayoutPreset}
                          relationshipGraphZoom={relationshipGraphZoom}
                          relationshipScanState={relationshipScanState}
                          selectedApiCallChains={selectedApiCallChains}
                          selectedApiEndpoint={selectedApiEndpoint}
                          selectedApiGroup={selectedApiGroup}
                          selectedApiGroupEndpoints={selectedApiGroupEndpoints}
                          selectedApiModuleGroup={selectedApiModuleGroup}
                          setApiConfidenceFilter={setApiConfidenceFilter}
                          setApiControllerFilter={setApiControllerFilter}
                          setApiFrameworkFilter={setApiFrameworkFilter}
                          setApiLanguageFilter={setApiLanguageFilter}
                          setApiModuleFilter={setApiModuleFilter}
                          setApiProtocolFilter={setApiProtocolFilter}
                          setExpandedApiModuleGroupIds={setExpandedApiModuleGroupIds}
                          setSelectedApiEndpointId={setSelectedApiEndpointId}
                          setSelectedApiGroupId={setSelectedApiGroupId}
                        />
                      ) : null}
                      {relationshipDashboardViewMode === "files" ? (
                        <ProjectMapRelationshipFileWorkspace
                          expandedRelationshipFileGroups={expandedRelationshipFileGroups}
                          relationshipDashboardDirectionCountByFile={relationshipDashboardDirectionCountByFile}
                          relationshipDashboardExplorerRenderedFileCount={relationshipDashboardExplorerRenderedFileCount}
                          relationshipDashboardFileTreeGroups={relationshipDashboardFileTreeGroups}
                          relationshipDashboardFilteredFiles={relationshipDashboardFilteredFiles}
                          relationshipDashboardLayoutPreset={relationshipDashboardLayoutPreset}
                          relationshipDashboardScannedFileCount={relationshipDashboardData.files.length}
                          relationshipDashboardVisibleFileTotal={relationshipDashboardVisibleFileTotal}
                          relationshipFilesZoom={relationshipFilesZoom}
                          selectedRelationshipFile={selectedRelationshipFile}
                          setInspectedRelationshipFileId={setInspectedRelationshipFileId}
                          setRelationshipDashboardViewMode={setRelationshipDashboardViewMode}
                          setSelectedRelationshipFileId={setSelectedRelationshipFileId}
                          setSelectedRelationshipRelationId={setSelectedRelationshipRelationId}
                          toggleRelationshipFileTreeGroup={toggleRelationshipFileTreeGroup}
                        />
                      ) : null}
                      {relationshipDashboardViewMode === "read" ? (
                        <ProjectMapRelationshipReadWorkspace
                          activeWorkspaceId={activeWorkspaceId}
                          inspectedRelationshipFile={inspectedRelationshipFile}
                          openProjectMapRelationshipPath={openProjectMapRelationshipPath}
                          relationshipDashboardData={relationshipDashboardData}
                          relationshipDashboardFileIndex={relationshipDashboardFileIndex}
                          relationshipDashboardModuleByFileId={relationshipDashboardModuleByFileId}
                          selectedRelationshipRelation={selectedRelationshipRelation}
                          selectedRelationshipRelationGroups={selectedRelationshipRelationGroups}
                          setRelationshipDashboardViewMode={setRelationshipDashboardViewMode}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {relationshipScanState.status === "failed" ? (
                    <p className="project-map-relationship-scan-error">
                      {t("projectMap.relationship.failed", {
                        message: relationshipScanState.message,
                      })}
                    </p>
                  ) : null}
                </section>

  );
}
