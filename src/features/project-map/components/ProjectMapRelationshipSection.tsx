import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Network from "lucide-react/dist/esm/icons/network";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

import {
  ProjectMapRelationshipApiWorkspace,
  ProjectMapRelationshipFileWorkspace,
  ProjectMapRelationshipReadWorkspace,
} from "./ProjectMapRelationshipWorkspaces";
import {
  projectMapApiEndpointMatchesQuery,
  projectMapApiGroupMatchesQuery,
  type ProjectMapApiEndpointSection,
  type ProjectMapApiGroupWithCount,
} from "./projectMapRelationshipApiModel";
import {
  PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT,
  PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH,
  buildProjectMapRelationshipGraphProjection,
} from "./projectMapRelationshipGraphProjection";
import { cn } from "../../../lib/utils";
import type { ProjectMapDatasetController } from "../hooks/useProjectMapDataset";
import {
  getProjectMapRelationshipCallCandidate,
  getProjectMapRelationshipConfidenceRank,
  getProjectMapRelationshipRoleColor,
  getProjectMapRelationshipRoleRank,
  getProjectMapRelationshipTypeRank,
  isProjectMapRelationshipNoiseFile,
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
  ProjectMapApiEndpoint,
  ProjectMapFileRelation,
  ProjectMapRelationshipScanResponse,
  ProjectMapRelationshipSymbol,
  ProjectMapScannedFile,
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

type ProjectMapRelationshipFileTreeGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
};

type ProjectMapRelationshipTopFileModuleGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
};

type ProjectMapRelationshipTopFileRoleGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
  moduleGroups: ProjectMapRelationshipTopFileModuleGroup[];
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
const PROJECT_MAP_RELATIONSHIP_TOP_FILE_LIMIT = 120;
const PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT = 6;
const PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT = 80;
const PROJECT_MAP_RELATIONSHIP_EDGE_LIMIT = 80;
const PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET = "__new_canvas__";
const PROJECT_MAP_RELATIONSHIP_VIEW_ORDER: ProjectMapRelationshipDashboardViewMode[] = [
  "graph",
  "files",
  "read",
  "api",
];

function formatActiveCodeSelectionLineLabel(anchor: IntentCanvasCodeSelectionAnchor): string {
  return anchor.startLine === anchor.endLine
    ? `L${anchor.startLine}`
    : `L${anchor.startLine}-L${anchor.endLine}`;
}

function getActiveCodeSelectionFileName(anchor: IntentCanvasCodeSelectionAnchor): string {
  return anchor.filePath.split(/[\\/]/).filter(Boolean).pop() ?? anchor.filePath;
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

function getProjectMapRelationshipCallTargetSymbolName(relation: ProjectMapFileRelation): string | null {
  const callCandidate = getProjectMapRelationshipCallCandidate(relation);
  if (!callCandidate) {
    return null;
  }
  const withoutArguments = callCandidate.replace(/\(.*$/, "");
  const identifiers = withoutArguments.match(/[A-Za-z_$][\w$]*/g);
  return identifiers?.at(-1) ?? null;
}

function resolveProjectMapRelationshipTargetSymbolLine(input: {
  relation: ProjectMapFileRelation;
  symbols: ProjectMapRelationshipSymbol[];
}): number | null {
  const targetSymbolName = getProjectMapRelationshipCallTargetSymbolName(input.relation);
  if (!targetSymbolName) {
    return null;
  }
  const exactSymbol = input.symbols.find((symbol) => (
    symbol.fileId === input.relation.targetFileId &&
    symbol.name === targetSymbolName
  ));
  if (exactSymbol) {
    return exactSymbol.line;
  }
  const normalizedTargetSymbolName = targetSymbolName.toLowerCase();
  return input.symbols.find((symbol) => (
    symbol.fileId === input.relation.targetFileId &&
    symbol.name.toLowerCase() === normalizedTargetSymbolName
  ))?.line ?? null;
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
  const relationshipGraphCanvasRef = useRef<HTMLDivElement | null>(null);
  const relationshipGraphPanRef = useRef<ProjectMapRelationshipGraphPanStart | null>(null);
  const lastHandledScanRequestIdRef = useRef(scanRequestId);
  const relationshipCanvasTargetRequestIdRef = useRef(0);

  useEffect(() => {
    onSummaryStateChange(relationshipScanState);
  }, [onSummaryStateChange, relationshipScanState]);

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

  const relationshipDashboardFileIndex = useMemo(() => {
    const index = new Map<string, ProjectMapScannedFile>();
    relationshipDashboardData?.files.forEach((file) => {
      index.set(file.id, file);
    });
    return index;
  }, [relationshipDashboardData]);

  const relationshipDashboardModuleByFileId = useMemo(() => {
    const index = new Map<string, string>();
    relationshipDashboardData?.modules.forEach((module) => {
      module.fileIds.forEach((fileId) => {
        index.set(fileId, module.label);
      });
    });
    return index;
  }, [relationshipDashboardData]);

  const relationshipDashboardTypeOptions = useMemo(() => {
    const types = new Set<string>();
    relationshipDashboardData?.relations.forEach((relation) => {
      types.add(relation.type);
    });
    return Array.from(types).sort((left, right) => (
      getProjectMapRelationshipTypeRank(left) - getProjectMapRelationshipTypeRank(right)
      || left.localeCompare(right)
    ));
  }, [relationshipDashboardData]);

  const relationshipDashboardRelationCountByFile = useMemo(() => {
    const counts = new Map<string, number>();
    relationshipDashboardData?.relations.forEach((relation) => {
      counts.set(relation.sourceFileId, (counts.get(relation.sourceFileId) ?? 0) + 1);
      counts.set(relation.targetFileId, (counts.get(relation.targetFileId) ?? 0) + 1);
    });
    return counts;
  }, [relationshipDashboardData]);

  const relationshipDashboardDirectionCountByFile = useMemo(() => {
    const counts = new Map<string, { incoming: number; outgoing: number }>();
    relationshipDashboardData?.relations.forEach((relation) => {
      const sourceCount = counts.get(relation.sourceFileId) ?? { incoming: 0, outgoing: 0 };
      sourceCount.outgoing += 1;
      counts.set(relation.sourceFileId, sourceCount);
      const targetCount = counts.get(relation.targetFileId) ?? { incoming: 0, outgoing: 0 };
      targetCount.incoming += 1;
      counts.set(relation.targetFileId, targetCount);
    });
    return counts;
  }, [relationshipDashboardData]);

  const relationshipDashboardRoleOptions = useMemo(() => {
    if (!relationshipDashboardData) {
      return [];
    }
    const roles = new Set<string>();
    relationshipDashboardData.files.forEach((file) => {
      if (showRelationshipNoiseFiles || !isProjectMapRelationshipNoiseFile(file)) {
        roles.add(file.role);
      }
    });
    return Array.from(roles).sort((left, right) => (
      getProjectMapRelationshipRoleRank(left) - getProjectMapRelationshipRoleRank(right)
      || left.localeCompare(right)
    ));
  }, [relationshipDashboardData, showRelationshipNoiseFiles]);

  const relationshipDashboardMatchingFiles = useMemo(() => {
    if (!relationshipDashboardData) {
      return [];
    }
    const query = relationshipDashboardQuery.trim().toLowerCase();
    const filtered = relationshipDashboardData.files
      .filter((file) => showRelationshipNoiseFiles || !isProjectMapRelationshipNoiseFile(file))
      .filter((file) => (
        relationshipDashboardRoleFilter === PROJECT_MAP_RELATION_FILTER_ALL
        || file.role === relationshipDashboardRoleFilter
      ))
      .filter((file) => {
        if (!query) {
          return true;
        }
          const moduleLabel = relationshipDashboardModuleByFileId.get(file.id) ?? "";
          return [
            file.path,
            file.basename,
            file.language,
            file.layer,
            file.role,
            moduleLabel,
          ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftRank = getProjectMapRelationshipRoleRank(left.role);
        const rightRank = getProjectMapRelationshipRoleRank(right.role);
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        const leftCount = relationshipDashboardRelationCountByFile.get(left.id) ?? 0;
        const rightCount = relationshipDashboardRelationCountByFile.get(right.id) ?? 0;
        if (leftCount !== rightCount) {
          return rightCount - leftCount;
        }
        return left.path.localeCompare(right.path);
      });
    return filtered;
  }, [
    relationshipDashboardData,
    relationshipDashboardModuleByFileId,
    relationshipDashboardQuery,
    relationshipDashboardRelationCountByFile,
    relationshipDashboardRoleFilter,
    showRelationshipNoiseFiles,
  ]);

  const relationshipDashboardFilteredFiles = useMemo(() => (
    relationshipDashboardMatchingFiles.slice(0, PROJECT_MAP_RELATIONSHIP_TOP_FILE_LIMIT)
  ), [relationshipDashboardMatchingFiles]);

  const relationshipDashboardTopFileGroups = useMemo<ProjectMapRelationshipTopFileRoleGroup[]>(() => {
    const roleGroups = new Map<string, ProjectMapRelationshipTopFileRoleGroup>();
    relationshipDashboardFilteredFiles.forEach((file) => {
      const relationCount = relationshipDashboardRelationCountByFile.get(file.id) ?? 0;
      const roleId = file.role || "unknown";
      const roleGroup = roleGroups.get(roleId) ?? {
        id: roleId,
        label: roleId,
        files: [],
        relationCount: 0,
        moduleGroups: [],
      };
      roleGroup.files.push(file);
      roleGroup.relationCount += relationCount;

      const moduleLabel =
        relationshipDashboardModuleByFileId.get(file.id)
        ?? file.path.split("/").find((part) => part.length > 0)
        ?? file.layer
        ?? "root";
      const moduleId = `${roleId}:${moduleLabel}`;
      let moduleGroup = roleGroup.moduleGroups.find((group) => group.id === moduleId);
      if (!moduleGroup) {
        moduleGroup = {
          id: moduleId,
          label: moduleLabel,
          files: [],
          relationCount: 0,
        };
        roleGroup.moduleGroups.push(moduleGroup);
      }
      moduleGroup.files.push(file);
      moduleGroup.relationCount += relationCount;
      roleGroups.set(roleId, roleGroup);
    });

    return Array.from(roleGroups.values())
      .map((group) => ({
        ...group,
        moduleGroups: group.moduleGroups.sort((left, right) => (
          right.relationCount - left.relationCount
          || right.files.length - left.files.length
          || left.label.localeCompare(right.label)
        )),
      }))
      .sort((left, right) => (
        getProjectMapRelationshipRoleRank(left.id) - getProjectMapRelationshipRoleRank(right.id)
        || right.relationCount - left.relationCount
        || left.label.localeCompare(right.label)
      ));
  }, [
    relationshipDashboardFilteredFiles,
    relationshipDashboardModuleByFileId,
    relationshipDashboardRelationCountByFile,
  ]);

  const relationshipDashboardVisibleFileTotal = relationshipDashboardMatchingFiles.length;

  const selectedRelationshipFile = useMemo(() => {
    if (!relationshipDashboardData?.files.length) {
      return null;
    }
    if (selectedRelationshipFileId) {
      const selectedFile = relationshipDashboardFileIndex.get(selectedRelationshipFileId);
      const selectedFileStillVisible = relationshipDashboardMatchingFiles.some((file) => (
        file.id === selectedRelationshipFileId
      ));
      if (selectedFile && selectedFileStillVisible) {
        return selectedFile;
      }
    }
    return relationshipDashboardFilteredFiles[0] ?? relationshipDashboardMatchingFiles[0] ?? null;
  }, [
    relationshipDashboardData,
    relationshipDashboardFileIndex,
    relationshipDashboardFilteredFiles,
    relationshipDashboardMatchingFiles,
    selectedRelationshipFileId,
  ]);

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

  const inspectedRelationshipFile = useMemo(() => {
    if (!relationshipDashboardData?.files.length) {
      return null;
    }
    if (inspectedRelationshipFileId) {
      const inspectedFile = relationshipDashboardFileIndex.get(inspectedRelationshipFileId);
      if (inspectedFile) {
        return inspectedFile;
      }
    }
    return selectedRelationshipFile;
  }, [
    inspectedRelationshipFileId,
    relationshipDashboardData,
    relationshipDashboardFileIndex,
    selectedRelationshipFile,
  ]);

  const relationshipDashboardFileTreeGroups = useMemo<ProjectMapRelationshipFileTreeGroup[]>(() => {
    const groups = new Map<string, ProjectMapScannedFile[]>();
    relationshipDashboardMatchingFiles.forEach((file) => {
      const moduleLabel = relationshipDashboardModuleByFileId.get(file.id);
      const pathParts = file.path.split("/").filter((part) => part.length > 0);
      const firstPathSegment = pathParts[0] ?? file.layer ?? file.role ?? "root";
      const groupLabel = moduleLabel ?? firstPathSegment;
      const files = groups.get(groupLabel) ?? [];
      files.push(file);
      groups.set(groupLabel, files);
    });
    return Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, files]) => ({
        id: label,
        label,
        files,
        relationCount: files.reduce((total, file) => (
          total + (relationshipDashboardRelationCountByFile.get(file.id) ?? 0)
        ), 0),
      }));
  }, [
    relationshipDashboardMatchingFiles,
    relationshipDashboardModuleByFileId,
    relationshipDashboardRelationCountByFile,
  ]);

  const relationshipDashboardExplorerRenderedFileCount = useMemo(() => (
    relationshipDashboardFileTreeGroups.reduce((total, group) => (
      total + (
        expandedRelationshipFileGroups.has(group.id)
          ? group.files.length
          : Math.min(group.files.length, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT)
      )
    ), 0)
  ), [expandedRelationshipFileGroups, relationshipDashboardFileTreeGroups]);

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

  const resolveRelationshipRelationsForFile = useCallback((file: ProjectMapScannedFile | null) => {
    if (!relationshipDashboardData || !file) {
      return [];
    }
    const selectedFileId = file.id;
    return relationshipDashboardData.relations
      .filter((relation) => {
        const isSelectedEdge =
          relation.sourceFileId === selectedFileId
          || relation.targetFileId === selectedFileId;
        const typeMatches =
          relationshipDashboardTypeFilter === PROJECT_MAP_RELATION_FILTER_ALL
          || relation.type === relationshipDashboardTypeFilter;
        return isSelectedEdge && typeMatches;
      })
      .sort((left, right) => {
        const leftFlowRank =
          left.type === "calls" ? 0 : left.sourceFileId === selectedFileId ? 1 : 2;
        const rightFlowRank =
          right.type === "calls" ? 0 : right.sourceFileId === selectedFileId ? 1 : 2;
        return (
          leftFlowRank - rightFlowRank
          || getProjectMapRelationshipTypeRank(left.type) - getProjectMapRelationshipTypeRank(right.type)
          || getProjectMapRelationshipConfidenceRank(left.confidence) - getProjectMapRelationshipConfidenceRank(right.confidence)
          || left.id.localeCompare(right.id)
        );
      })
      .slice(0, PROJECT_MAP_RELATIONSHIP_EDGE_LIMIT);
  }, [relationshipDashboardData, relationshipDashboardTypeFilter]);

  const selectedRelationshipRelations = useMemo(
    () => resolveRelationshipRelationsForFile(selectedRelationshipFile),
    [resolveRelationshipRelationsForFile, selectedRelationshipFile],
  );

  const inspectedRelationshipRelations = useMemo(
    () => resolveRelationshipRelationsForFile(inspectedRelationshipFile),
    [inspectedRelationshipFile, resolveRelationshipRelationsForFile],
  );

  const selectedRelationshipRelationGroups = useMemo(() => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    const groups = [
      {
        id: "calls",
        title: t("projectMap.relationship.chainGroupCalls"),
        relations: [] as ProjectMapFileRelation[],
      },
      {
        id: "outgoing",
        title: t("projectMap.relationship.chainGroupOutgoing"),
        relations: [] as ProjectMapFileRelation[],
      },
      {
        id: "incoming",
        title: t("projectMap.relationship.chainGroupIncoming"),
        relations: [] as ProjectMapFileRelation[],
      },
      {
        id: "other",
        title: t("projectMap.relationship.chainGroupOther"),
        relations: [] as ProjectMapFileRelation[],
      },
    ];
    inspectedRelationshipRelations.forEach((relation) => {
      if (relation.type === "calls") {
        groups[0].relations.push(relation);
        return;
      }
      if (relation.sourceFileId === inspectedRelationshipFile.id) {
        groups[1].relations.push(relation);
        return;
      }
      if (relation.targetFileId === inspectedRelationshipFile.id) {
        groups[2].relations.push(relation);
        return;
      }
      groups[3].relations.push(relation);
    });
    return groups.filter((group) => group.relations.length > 0);
  }, [inspectedRelationshipFile, inspectedRelationshipRelations, t]);

  const relationshipDashboardGraph = useMemo(() => {
    if (!relationshipDashboardData || !selectedRelationshipFile) {
      return null;
    }
    return buildProjectMapRelationshipGraphProjection({
      selectedRelationshipFile,
      selectedRelationshipRelations,
      relationshipDashboardFilteredFiles,
      relationshipDashboardFileIndex,
      relationshipDashboardDirectionCountByFile,
      relationshipDashboardRelationCountByFile,
      relationshipDashboardLayoutPreset,
      relationshipGraphExpandedSide,
      selectedRelationshipRelationId,
    });
  }, [
    relationshipDashboardData,
    relationshipDashboardDirectionCountByFile,
    relationshipDashboardFileIndex,
    relationshipDashboardFilteredFiles,
    relationshipDashboardLayoutPreset,
    relationshipGraphExpandedSide,
    relationshipDashboardRelationCountByFile,
    selectedRelationshipFile,
    selectedRelationshipRelationId,
    selectedRelationshipRelations,
  ]);

  const handleRelationshipGraphPointerDown = (event: PointerEvent<HTMLDivElement>) => {
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

  const handleRelationshipGraphPointerMove = (event: PointerEvent<HTMLDivElement>) => {
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

  const handleRelationshipGraphPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (relationshipGraphPanRef.current?.pointerId !== event.pointerId) {
      return;
    }
    relationshipGraphPanRef.current = null;
    setIsRelationshipGraphPanning(false);
  };

  const selectedRelationshipRelation = useMemo(() => {
    if (!inspectedRelationshipRelations.length) {
      return null;
    }
    if (selectedRelationshipRelationId) {
      const selectedRelation = inspectedRelationshipRelations.find(
        (relation) => relation.id === selectedRelationshipRelationId,
      );
      if (selectedRelation) {
        return selectedRelation;
      }
    }
    return inspectedRelationshipRelations.find((relation) => relation.type === "calls")
      ?? inspectedRelationshipRelations[0]
      ?? null;
  }, [inspectedRelationshipRelations, selectedRelationshipRelationId]);

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

  const selectedRelationshipScopeWarnings = useMemo(() => (
    relationshipDashboardData?.staleSummary?.reasons.filter(
      (reason) => reason.kind === "scan-scope-warning",
    ) ?? []
  ), [relationshipDashboardData?.staleSummary?.reasons]);

  const apiEndpointById = useMemo(() => {
    const index = new Map<string, ProjectMapApiEndpoint>();
    relationshipDashboardData?.apiContracts?.endpoints.forEach((endpoint) => {
      index.set(endpoint.id, endpoint);
    });
    return index;
  }, [relationshipDashboardData?.apiContracts?.endpoints]);

  const apiSearchQuery = relationshipDashboardViewMode === "api"
    ? relationshipDashboardQuery.trim().toLowerCase()
    : "";

  const apiFilterOptions = useMemo(() => {
    const apiContracts = relationshipDashboardData?.apiContracts;
    const options = {
      protocols: new Set<string>(),
      languages: new Set<string>(),
      frameworks: new Set<string>(),
      modules: new Set<string>(),
      controllers: new Set<string>(),
      confidences: new Set<string>(),
    };
    if (!apiContracts) {
      return options;
    }
    const groupIndex = new Map(apiContracts.groups.map((group) => [group.id, group]));
    apiContracts.endpoints.forEach((endpoint) => {
      options.protocols.add(endpoint.protocol);
      options.languages.add(endpoint.language);
      if (endpoint.framework) {
        options.frameworks.add(endpoint.framework);
      }
      options.confidences.add(endpoint.confidence);
      endpoint.groupIds.forEach((groupId) => {
        const group = groupIndex.get(groupId);
        if (group?.level === "module") {
          options.modules.add(group.label);
        }
        if (group?.level === "controller") {
          options.controllers.add(group.label);
        }
      });
    });
    return options;
  }, [relationshipDashboardData?.apiContracts]);

  const apiSearchProjection = useMemo(() => {
    const apiContracts = relationshipDashboardData?.apiContracts;
    const visibleEndpointIds = new Set<string>();
    const visibleGroupIds = new Set<string>();
    if (!apiContracts) {
      return { visibleEndpointIds, visibleGroupIds };
    }

    const groupIndex = new Map(apiContracts.groups.map((group) => [group.id, group]));
    const addGroupWithAncestors = (groupId: string) => {
      let currentGroupId: string | undefined = groupId;
      while (currentGroupId) {
        const group = groupIndex.get(currentGroupId);
        if (!group || visibleGroupIds.has(group.id)) {
          break;
        }
        visibleGroupIds.add(group.id);
        currentGroupId = group.parentId;
      }
    };
    const addGroupWithDescendants = (groupId: string) => {
      const group = groupIndex.get(groupId);
      if (!group) {
        return;
      }
      visibleGroupIds.add(group.id);
      group.endpointIds.forEach((endpointId) => visibleEndpointIds.add(endpointId));
      group.childGroupIds.forEach(addGroupWithDescendants);
    };

    const endpointMatchesFilters = (endpoint: ProjectMapApiEndpoint) => {
      const matchesModule = apiModuleFilter === "all"
        || endpoint.groupIds.some((groupId) => {
          const group = groupIndex.get(groupId);
          return group?.level === "module" && group.label === apiModuleFilter;
        });
      const matchesController = apiControllerFilter === "all"
        || endpoint.groupIds.some((groupId) => {
          const group = groupIndex.get(groupId);
          return group?.level === "controller" && group.label === apiControllerFilter;
        });
      return (apiProtocolFilter === "all" || endpoint.protocol === apiProtocolFilter)
        && (apiLanguageFilter === "all" || endpoint.language === apiLanguageFilter)
        && (apiFrameworkFilter === "all" || endpoint.framework === apiFrameworkFilter)
        && (apiConfidenceFilter === "all" || endpoint.confidence === apiConfidenceFilter)
        && matchesModule
        && matchesController
        && (!apiSearchQuery || projectMapApiEndpointMatchesQuery(endpoint, apiSearchQuery));
    };

    const hasStructuredFilter = [
      apiProtocolFilter,
      apiLanguageFilter,
      apiFrameworkFilter,
      apiModuleFilter,
      apiControllerFilter,
      apiConfidenceFilter,
    ].some((value) => value !== "all");

    if (!apiSearchQuery && !hasStructuredFilter) {
      apiContracts.groups.forEach((group) => visibleGroupIds.add(group.id));
      apiContracts.endpoints.forEach((endpoint) => visibleEndpointIds.add(endpoint.id));
      return { visibleEndpointIds, visibleGroupIds };
    }

    if (apiSearchQuery && !hasStructuredFilter) {
      apiContracts.groups.forEach((group) => {
        if (!projectMapApiGroupMatchesQuery(group, apiSearchQuery)) {
          return;
        }
        addGroupWithAncestors(group.id);
        addGroupWithDescendants(group.id);
      });
    }

    apiContracts.endpoints.forEach((endpoint) => {
      if (!endpointMatchesFilters(endpoint)) {
        return;
      }
      visibleEndpointIds.add(endpoint.id);
      endpoint.groupIds.forEach(addGroupWithAncestors);
    });

    return { visibleEndpointIds, visibleGroupIds };
  }, [
    apiConfidenceFilter,
    apiControllerFilter,
    apiFrameworkFilter,
    apiLanguageFilter,
    apiModuleFilter,
    apiProtocolFilter,
    apiSearchQuery,
    relationshipDashboardData?.apiContracts,
  ]);

  const apiGroups = useMemo<ProjectMapApiGroupWithCount[]>(() => {
    const apiContracts = relationshipDashboardData?.apiContracts;
    if (!apiContracts) {
      return [];
    }
    const endpointCounts = new Map<string, number>();
    apiContracts.endpoints.forEach((endpoint) => {
      if (!apiSearchProjection.visibleEndpointIds.has(endpoint.id)) {
        return;
      }
      endpoint.groupIds.forEach((groupId) => {
        endpointCounts.set(groupId, (endpointCounts.get(groupId) ?? 0) + 1);
      });
    });
    return apiContracts.groups
      .filter((group) => apiSearchProjection.visibleGroupIds.has(group.id))
      .map((group) => ({
        ...group,
        endpointCount: endpointCounts.get(group.id)
          ?? group.endpointIds.filter((endpointId) => apiSearchProjection.visibleEndpointIds.has(endpointId)).length,
      }))
      .sort((left, right) => (
        left.level.localeCompare(right.level)
        || right.endpointCount - left.endpointCount
        || left.label.localeCompare(right.label)
      ));
  }, [apiSearchProjection, relationshipDashboardData?.apiContracts]);

  const apiGroupById = useMemo(() => {
    const index = new Map<string, ProjectMapApiGroupWithCount>();
    apiGroups.forEach((group) => {
      index.set(group.id, group);
    });
    return index;
  }, [apiGroups]);

  const apiModuleGroups = useMemo(() => {
    const modules = apiGroups.filter((group) => group.level === "module");
    return modules.length ? modules : apiGroups.filter((group) => group.level !== "endpoint");
  }, [apiGroups]);

  const selectedApiModuleGroup = useMemo(() => {
    if (!apiModuleGroups.length) {
      return null;
    }
    if (selectedApiGroupId) {
      const selected = apiGroupById.get(selectedApiGroupId);
      if (selected?.level === "module") {
        return selected;
      }
      const parent = selected?.parentId ? apiGroupById.get(selected.parentId) : null;
      if (parent?.level === "module") {
        return parent;
      }
    }
    return apiModuleGroups[0] ?? null;
  }, [apiGroupById, apiModuleGroups, selectedApiGroupId]);

  const apiControllerGroups = useMemo(() => {
    if (!selectedApiModuleGroup) {
      return apiGroups.filter((group) => group.level === "controller");
    }
    const childGroups = selectedApiModuleGroup.childGroupIds
      .map((groupId) => apiGroupById.get(groupId))
      .filter((group): group is ProjectMapApiGroupWithCount => Boolean(group))
      .filter((group) => group.level === "controller");
    if (childGroups.length) {
      return childGroups.sort((left, right) => (
        right.endpointCount - left.endpointCount || left.label.localeCompare(right.label)
      ));
    }
    return apiGroups
      .filter((group) => group.parentId === selectedApiModuleGroup.id)
      .sort((left, right) => (
        right.endpointCount - left.endpointCount || left.label.localeCompare(right.label)
      ));
  }, [apiGroupById, apiGroups, selectedApiModuleGroup]);

  const apiControllerGroupsByModuleId = useMemo(() => {
    const index = new Map<string, ProjectMapApiGroupWithCount[]>();
    apiModuleGroups.forEach((moduleGroup) => {
      const controllers = moduleGroup.childGroupIds
        .map((groupId) => apiGroupById.get(groupId))
        .filter((group): group is ProjectMapApiGroupWithCount => Boolean(group))
        .filter((group) => group.level === "controller")
        .sort((left, right) => (
          right.endpointCount - left.endpointCount || left.label.localeCompare(right.label)
        ));
      index.set(moduleGroup.id, controllers);
    });
    return index;
  }, [apiGroupById, apiModuleGroups]);

  useEffect(() => {
    if (!apiModuleGroups.length) {
      setExpandedApiModuleGroupIds((current) => (current.size ? new Set() : current));
      return;
    }
    setExpandedApiModuleGroupIds((current) => {
      const next = new Set<string>();
      current.forEach((groupId) => {
        if (apiGroupById.has(groupId)) {
          next.add(groupId);
        }
      });
      if (!next.size) {
        next.add(apiModuleGroups[0].id);
      }
      if (next.size === current.size && Array.from(next).every((groupId) => current.has(groupId))) {
        return current;
      }
      return next;
    });
  }, [apiGroupById, apiModuleGroups]);

  const selectedApiGroup = useMemo(() => {
    if (!apiGroups.length) {
      return null;
    }
    if (selectedApiGroupId) {
      const selected = apiGroups.find((group) => group.id === selectedApiGroupId);
      if (selected) {
        return selected;
      }
    }
    return apiControllerGroups[0] ?? selectedApiModuleGroup ?? apiGroups[0] ?? null;
  }, [apiControllerGroups, apiGroups, selectedApiGroupId, selectedApiModuleGroup]);

  const selectedApiGroupEndpoints = useMemo(() => {
    const endpoints = (relationshipDashboardData?.apiContracts?.endpoints ?? [])
      .filter((endpoint) => apiSearchProjection.visibleEndpointIds.has(endpoint.id));
    if (!selectedApiGroup) {
      return endpoints.slice(0, 30);
    }
    const groupEndpointIds = new Set(selectedApiGroup.endpointIds);
    return endpoints.filter((endpoint) => (
      groupEndpointIds.has(endpoint.id) || endpoint.groupIds.includes(selectedApiGroup.id)
    ));
  }, [apiSearchProjection, relationshipDashboardData?.apiContracts?.endpoints, selectedApiGroup]);

  const apiEndpointSections = useMemo<ProjectMapApiEndpointSection[]>(() => {
    const sectionMap = new Map<string, ProjectMapApiEndpoint[]>();
    selectedApiGroupEndpoints.forEach((endpoint) => {
      const sectionKey = (endpoint.method ?? endpoint.protocol ?? "api").toUpperCase();
      const endpoints = sectionMap.get(sectionKey) ?? [];
      endpoints.push(endpoint);
      sectionMap.set(sectionKey, endpoints);
    });
    return Array.from(sectionMap.entries())
      .sort(([left], [right]) => {
        const priority = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        const leftRank = priority.indexOf(left);
        const rightRank = priority.indexOf(right);
        return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank)
          || left.localeCompare(right);
      })
      .map(([title, endpoints]) => ({
        id: title,
        title,
        hint: t("projectMap.relationship.apiEndpointSectionHint", { count: endpoints.length }),
        endpoints: endpoints.sort((left, right) => (
          (left.path ?? left.operationName ?? left.handlerSymbol ?? left.id)
            .localeCompare(right.path ?? right.operationName ?? right.handlerSymbol ?? right.id)
        )),
      }));
  }, [selectedApiGroupEndpoints, t]);

  const selectedApiEndpoint = useMemo(() => {
    if (selectedApiEndpointId) {
      const selected = apiEndpointById.get(selectedApiEndpointId);
      const selectedStillVisible = selectedApiGroupEndpoints.some((endpoint) => endpoint.id === selectedApiEndpointId);
      if (selected && selectedStillVisible) {
        return selected;
      }
    }
    return apiEndpointSections[0]?.endpoints[0] ?? null;
  }, [apiEndpointById, apiEndpointSections, selectedApiEndpointId, selectedApiGroupEndpoints]);

  const selectedApiCallChains = useMemo(() => {
    const callChains = relationshipDashboardData?.apiContracts?.callChains ?? [];
    if (!selectedApiEndpoint) {
      return [];
    }
    const selectedChainIds = new Set(selectedApiEndpoint.callChainIds);
    return callChains.filter((chain) => chain.endpointId === selectedApiEndpoint.id || selectedChainIds.has(chain.id));
  }, [relationshipDashboardData?.apiContracts?.callChains, selectedApiEndpoint]);

  const apiEndpointCount = relationshipDashboardData?.apiContracts?.endpoints.length ?? 0;
  const apiContractScanExists = Boolean(relationshipDashboardData?.apiContracts);
  const apiGraphMode =
    apiEndpointCount > 50 ? "group-only" : apiEndpointCount > 30 ? "selected-group" : "endpoint-direct";

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
                        <>
                          <div
                            className={cn(
                              "project-map-relationship-graph-dashboard",
                              isRelationshipGraphRailCollapsed && "is-rail-collapsed",
                              isRelationshipGraphInspectorCollapsed && "is-inspector-collapsed",
                            )}
                          >
                          {!isRelationshipGraphRailCollapsed ? (
                            <aside className="project-map-relationship-graph-rail">
                              <header>
                                <strong>{t("projectMap.relationship.graphFiles")}</strong>
                                <span>{t("projectMap.relationship.graphTopFiles", {
                                  top: relationshipDashboardFilteredFiles.length,
                                  matching: relationshipDashboardVisibleFileTotal,
                                  scanned: relationshipDashboardData.files.length,
                                })}</span>
                              </header>
                              <div className="project-map-relationship-graph-file-list">
                                {relationshipDashboardTopFileGroups.map((roleGroup, roleGroupIndex) => {
                                  const selectedFileInRole = Boolean(
                                    selectedRelationshipFile
                                    && roleGroup.files.some((file) => file.id === selectedRelationshipFile.id),
                                  );
                                  const isDefaultRoleExpanded = roleGroupIndex === 0;
                                  const isRoleExpanded =
                                    selectedFileInRole
                                    || expandedRelationshipTopRoleGroups.has(roleGroup.id)
                                    || (
                                      isDefaultRoleExpanded
                                      && !collapsedRelationshipTopRoleGroups.has(roleGroup.id)
                                    );
                                  return (
                                    <section
                                      key={roleGroup.id}
                                      className="project-map-relationship-graph-file-group"
                                    >
                                      <header>
                                        <button
                                          type="button"
                                          className="project-map-relationship-graph-file-group-toggle"
                                          aria-expanded={isRoleExpanded}
                                          onClick={() => toggleRelationshipTopRoleGroup(roleGroup.id, isRoleExpanded)}
                                        >
                                          <span aria-hidden>{isRoleExpanded ? "▾" : "▸"}</span>
                                          <strong>{roleGroup.label}</strong>
                                        </button>
                                        <span>{t("projectMap.relationship.graphFileGroupStats", {
                                          files: roleGroup.files.length,
                                          relations: roleGroup.relationCount,
                                        })}</span>
                                      </header>
                                      {isRoleExpanded ? (
                                        <div className="project-map-relationship-graph-file-modules">
                                          {roleGroup.moduleGroups.map((moduleGroup, moduleGroupIndex) => {
                                            const selectedFileInModule = Boolean(
                                              selectedRelationshipFile
                                              && moduleGroup.files.some((file) => file.id === selectedRelationshipFile.id),
                                            );
                                            const isDefaultModuleExpanded = roleGroupIndex === 0 && moduleGroupIndex === 0;
                                            const isModuleExpanded =
                                              selectedFileInModule
                                              || expandedRelationshipTopModuleGroups.has(moduleGroup.id)
                                              || (
                                                isDefaultModuleExpanded
                                                && !collapsedRelationshipTopModuleGroups.has(moduleGroup.id)
                                              );
                                            const isGroupExpanded = expandedRelationshipTopFileGroups.has(moduleGroup.id);
                                            const visibleFiles = isGroupExpanded
                                              ? moduleGroup.files
                                              : moduleGroup.files.slice(0, PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT);
                                            return (
                                              <section
                                                key={moduleGroup.id}
                                                className="project-map-relationship-graph-file-module"
                                              >
                                                <header>
                                                  <button
                                                    type="button"
                                                    className="project-map-relationship-graph-file-module-toggle"
                                                    aria-expanded={isModuleExpanded}
                                                    onClick={() => toggleRelationshipTopModuleGroup(moduleGroup.id, isModuleExpanded)}
                                                  >
                                                    <span aria-hidden>{isModuleExpanded ? "▾" : "▸"}</span>
                                                    <strong>{moduleGroup.label}</strong>
                                                  </button>
                                                  <span>
                                                    {isModuleExpanded
                                                      ? t("projectMap.relationship.graphFileModuleStats", {
                                                          rendered: visibleFiles.length,
                                                          files: moduleGroup.files.length,
                                                        })
                                                      : t("projectMap.relationship.graphFileModuleCollapsedStats", {
                                                          files: moduleGroup.files.length,
                                                        })}
                                                  </span>
                                                </header>
                                                {isModuleExpanded ? (
                                                  <div>
                                                    {visibleFiles.map((file) => {
                                                      const directionCount =
                                                        relationshipDashboardDirectionCountByFile.get(file.id)
                                                        ?? { incoming: 0, outgoing: 0 };
                                                      return (
                                                        <button
                                                          key={file.id}
                                                          type="button"
                                                          className={cn(
                                                            selectedRelationshipFile?.id === file.id && "is-active",
                                                          )}
                                                          onClick={() => {
                                                            setSelectedRelationshipFileId(file.id);
                                                            setInspectedRelationshipFileId(file.id);
                                                            setSelectedRelationshipRelationId(null);
                                                          }}
                                                        >
                                                          <span
                                                            style={{
                                                              "--relationship-node-color": getProjectMapRelationshipRoleColor(file.role),
                                                            } as CSSProperties}
                                                          />
                                                          <strong>{file.basename}</strong>
                                                          <em>
                                                            {t("projectMap.relationship.graphFileDirectionSummary", {
                                                              role: file.role,
                                                              incoming: directionCount.incoming,
                                                              outgoing: directionCount.outgoing,
                                                            })}
                                                          </em>
                                                        </button>
                                                      );
                                                    })}
                                                    {moduleGroup.files.length > PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT ? (
                                                      <button
                                                        type="button"
                                                        className="project-map-relationship-graph-file-more"
                                                        onClick={() => toggleRelationshipTopFileGroup(moduleGroup.id)}
                                                      >
                                                        <strong>
                                                          {isGroupExpanded
                                                            ? t("projectMap.relationship.graphFileGroupCollapse")
                                                            : t("projectMap.relationship.graphFileGroupMore", {
                                                                count: moduleGroup.files.length - PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT,
                                                              })}
                                                        </strong>
                                                        <em>{t("projectMap.relationship.graphFileGroupSearchHint")}</em>
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                ) : null}
                                              </section>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </section>
                                  );
                                })}
                              </div>
                            </aside>
                          ) : null}
                          <div
                            className={cn(
                              "project-map-relationship-graph-canvas",
                              isRelationshipGraphPanning && "is-panning",
                            )}
                            ref={relationshipGraphCanvasRef}
                            onPointerDown={handleRelationshipGraphPointerDown}
                            onPointerMove={handleRelationshipGraphPointerMove}
                            onPointerUp={handleRelationshipGraphPointerEnd}
                            onPointerCancel={handleRelationshipGraphPointerEnd}
                          >
                            <header className="project-map-relationship-graph-canvas-header">
                              <div>
                                <strong>{t("projectMap.relationship.graphTitle")}</strong>
                                <span>{t("projectMap.relationship.graphSubtitle")}</span>
                              </div>
                              {selectedRelationshipFile ? (
                                <span>{t("projectMap.relationship.graphFocusHint", {
                                  file: selectedRelationshipFile.basename,
                                })}</span>
                              ) : null}
                            </header>
                            <div className="project-map-relationship-graph-legend">
                              <button
                                type="button"
                                className={cn(
                                  relationshipDashboardTypeFilter === PROJECT_MAP_RELATION_FILTER_ALL && "is-active",
                                )}
                                onClick={() => {
                                  setRelationshipDashboardTypeFilter(PROJECT_MAP_RELATION_FILTER_ALL);
                                  setSelectedRelationshipRelationId(null);
                                }}
                              >
                                {t("projectMap.relationship.graphLegendAll")}
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "is-calls",
                                  relationshipDashboardTypeFilter === "calls" && "is-active",
                                )}
                                onClick={() => {
                                  setRelationshipDashboardTypeFilter("calls");
                                  setSelectedRelationshipRelationId(null);
                                }}
                              >
                                {t("projectMap.relationship.graphLegendCalls")}
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "is-imports",
                                  relationshipDashboardTypeFilter === "imports" && "is-active",
                                )}
                                onClick={() => {
                                  setRelationshipDashboardTypeFilter("imports");
                                  setSelectedRelationshipRelationId(null);
                                }}
                              >
                                {t("projectMap.relationship.graphLegendImports")}
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "is-tests",
                                  relationshipDashboardTypeFilter === "tested_by" && "is-active",
                                )}
                                onClick={() => {
                                  setRelationshipDashboardTypeFilter("tested_by");
                                  setSelectedRelationshipRelationId(null);
                                }}
                              >
                                {t("projectMap.relationship.graphLegendTests")}
                              </button>
                              <span>{t("projectMap.relationship.graphLegendOther")}</span>
                            </div>
                            {relationshipDashboardGraph ? (
                              <>
                                <div
                                  className="project-map-relationship-graph-stage"
                                  style={{
                                    "--relationship-graph-pan-x": `${relationshipGraphPan.x}px`,
                                    "--relationship-graph-pan-y": `${relationshipGraphPan.y}px`,
                                    "--relationship-graph-scale": Number((relationshipGraphScale * relationshipGraphZoom).toFixed(3)),
                                  } as CSSProperties}
                                >
                                  <div className="project-map-relationship-graph-lane-label is-incoming">
                                    {t("projectMap.relationship.graphLaneIncoming")}
                                  </div>
                                  <div className="project-map-relationship-graph-lane-label is-current">
                                    {t("projectMap.relationship.graphLaneCurrent")}
                                  </div>
                                  <div className="project-map-relationship-graph-lane-label is-outgoing">
                                    {t("projectMap.relationship.graphLaneOutgoing")}
                                  </div>
                                <svg
                                  className="project-map-relationship-graph-svg"
                                  viewBox={`0 0 ${PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH} ${PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT}`}
                                  preserveAspectRatio="none"
                                  aria-hidden
                                >
                                  <defs>
                                    <marker
                                      id="project-map-relationship-arrow"
                                      markerWidth="8"
                                      markerHeight="8"
                                      refX="7"
                                      refY="4"
                                      orient="auto"
                                    >
                                      <path d="M0,0 L8,4 L0,8 Z" />
                                    </marker>
                                  </defs>
                                  {relationshipDashboardGraph.edges.map((edge) => {
                                    const arrowX = edge.sourceX + (edge.targetX - edge.sourceX) * 0.62;
                                    const arrowY = edge.sourceY + (edge.targetY - edge.sourceY) * 0.62;
                                    const arrowAngle = Math.atan2(
                                      edge.targetY - edge.sourceY,
                                      edge.targetX - edge.sourceX,
                                    ) * 180 / Math.PI;
                                    return (
                                      <g
                                        key={edge.relation.id}
                                        className={cn(
                                          "project-map-relationship-graph-edge",
                                          edge.relation.type === "calls" && "is-calls",
                                          edge.relation.type === "imports" && "is-imports",
                                          edge.relation.type === "tested_by" && "is-tests",
                                          edge.isSelected && "is-selected",
                                        )}
                                        onClick={() => {
                                          setInspectedRelationshipFileId(edge.relation.sourceFileId);
                                          setSelectedRelationshipRelationId(edge.relation.id);
                                        }}
                                      >
                                        <line
                                          x1={edge.sourceX}
                                          y1={edge.sourceY}
                                          x2={edge.targetX}
                                          y2={edge.targetY}
                                          markerEnd="url(#project-map-relationship-arrow)"
                                        />
                                        <path
                                          className="project-map-relationship-graph-edge-arrow"
                                          d="M -6 -4 L 6 0 L -6 4 Z"
                                          transform={`translate(${arrowX} ${arrowY}) rotate(${arrowAngle})`}
                                        />
                                      </g>
                                    );
                                  })}
                                  {relationshipDashboardGraph.aggregateEdges.map((edge) => {
                                    const arrowX = edge.sourceX + (edge.targetX - edge.sourceX) * 0.62;
                                    const arrowY = edge.sourceY + (edge.targetY - edge.sourceY) * 0.62;
                                    const arrowAngle = Math.atan2(
                                      edge.targetY - edge.sourceY,
                                      edge.targetX - edge.sourceX,
                                    ) * 180 / Math.PI;
                                    return (
                                      <g
                                        key={edge.id}
                                        className="project-map-relationship-graph-aggregate-edge"
                                      >
                                        <line
                                          x1={edge.sourceX}
                                          y1={edge.sourceY}
                                          x2={edge.targetX}
                                          y2={edge.targetY}
                                          markerEnd="url(#project-map-relationship-arrow)"
                                        />
                                        <path
                                          className="project-map-relationship-graph-edge-arrow"
                                          d="M -5 -3.5 L 5 0 L -5 3.5 Z"
                                          transform={`translate(${arrowX} ${arrowY}) rotate(${arrowAngle})`}
                                        />
                                      </g>
                                    );
                                  })}
                                </svg>
                                {relationshipDashboardGraph.edges.map((edge) => {
                                  const callCandidate = getProjectMapRelationshipCallCandidate(edge.relation);
                                  return (
                                    <button
                                      key={`${edge.relation.id}:label`}
                                      type="button"
                                      className={cn(
                                        "project-map-relationship-graph-edge-label",
                                        edge.relation.type === "calls" && "is-calls",
                                        edge.relation.type === "imports" && "is-imports",
                                        edge.relation.type === "tested_by" && "is-tests",
                                        edge.isSelected && "is-selected",
                                      )}
                                      style={{
                                        left: edge.labelX,
                                        top: edge.labelY,
                                      }}
                                      title={callCandidate ?? edge.relation.type}
                                      onClick={() => {
                                        setInspectedRelationshipFileId(edge.relation.sourceFileId);
                                        setSelectedRelationshipRelationId(edge.relation.id);
                                      }}
                                    >
                                      {callCandidate ?? edge.relation.type}
                                    </button>
                                  );
                                })}
                                {relationshipDashboardGraph.nodes.map((node) => (
                                  <div
                                    key={node.file.id}
                                    role="button"
                                    tabIndex={0}
                                    className={cn(
                                      "project-map-relationship-graph-node",
                                      node.isSelected && "is-selected",
                                      inspectedRelationshipFile?.id === node.file.id && "is-inspected",
                                      node.isNeighbor && "is-neighbor",
                                      selectedRelationshipRelation
                                        && (
                                          selectedRelationshipRelation.sourceFileId === node.file.id
                                          || selectedRelationshipRelation.targetFileId === node.file.id
                                        )
                                        && "is-edge-endpoint",
                                      !node.isSelected && !node.isNeighbor && "is-secondary",
                                    )}
                                    style={{
                                      left: node.x,
                                      top: node.y,
                                      "--relationship-node-color": getProjectMapRelationshipRoleColor(node.file.role),
                                    } as CSSProperties}
                                    onClick={() => {
                                      setInspectedRelationshipFileId(node.file.id);
                                      setSelectedRelationshipRelationId(null);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.target !== event.currentTarget) {
                                        return;
                                      }
                                      if (event.key !== "Enter" && event.key !== " ") {
                                        return;
                                      }
                                      event.preventDefault();
                                      setInspectedRelationshipFileId(node.file.id);
                                      setSelectedRelationshipRelationId(null);
                                    }}
                                  >
                                    <i aria-hidden />
                                    <button
                                      type="button"
                                      className="project-map-relationship-graph-node-jump"
                                      aria-label={t("projectMap.relationship.graphFocusHint", {
                                        file: node.file.basename,
                                      })}
                                      title={t("projectMap.relationship.graphFocusHint", {
                                        file: node.file.basename,
                                      })}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (isProjectMapRelationshipNoiseFile(node.file)) {
                                          setShowRelationshipNoiseFiles(true);
                                        }
                                        setSelectedRelationshipFileId(node.file.id);
                                        setInspectedRelationshipFileId(node.file.id);
                                        setSelectedRelationshipRelationId(null);
                                      }}
                                    >
                                      <ExternalLink aria-hidden />
                                    </button>
                                    <span>{node.file.role}</span>
                                    <strong>{node.file.basename}</strong>
                                    <em>{node.file.language} · {node.file.layer}</em>
                                    <small>
                                      {t("projectMap.relationship.graphNodeMetricSummary", {
                                        incoming: node.incoming,
                                        outgoing: node.outgoing,
                                        total: node.total,
                                      })}
                                    </small>
                                  </div>
                                ))}
                                {relationshipDashboardGraph.aggregateNodes.map((node) => (
                                  <button
                                    key={node.id}
                                    type="button"
                                    className={cn(
                                      "project-map-relationship-graph-aggregate-node",
                                      node.kind === "incoming" ? "is-incoming" : "is-outgoing",
                                      node.isExpanded && "is-expanded",
                                    )}
                                    style={{ left: node.x, top: node.y }}
                                    onClick={() => {
                                      setRelationshipGraphExpandedSide((current) => (
                                        current === node.kind ? null : node.kind
                                      ));
                                      setSelectedRelationshipRelationId(null);
                                    }}
                                  >
                                    <strong>+{node.count}</strong>
                                    <span>
                                      {node.kind === "incoming"
                                        ? t("projectMap.relationship.graphMoreIncoming")
                                        : t("projectMap.relationship.graphMoreOutgoing")}
                                      {" · "}
                                      {node.isExpanded
                                        ? t("projectMap.relationship.graphMoreCollapse")
                                        : t("projectMap.relationship.graphMoreExpand")}
                                    </span>
                                  </button>
                                ))}
                                </div>
                                <div className="project-map-relationship-graph-minimap" aria-hidden>
                                  {relationshipDashboardGraph.nodes.map((node) => (
                                    <span
                                      key={`${node.file.id}:minimap`}
                                      className={cn(
                                        node.isSelected && "is-selected",
                                        node.isNeighbor && "is-neighbor",
                                        selectedRelationshipRelation
                                          && (
                                            selectedRelationshipRelation.sourceFileId === node.file.id
                                            || selectedRelationshipRelation.targetFileId === node.file.id
                                          )
                                          && "is-edge-endpoint",
                                      )}
                                      style={{
                                        left: `${Math.max(3, Math.min(94, (node.x / PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH) * 100))}%`,
                                        top: `${Math.max(6, Math.min(90, (node.y / PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT) * 100))}%`,
                                        "--relationship-node-color": getProjectMapRelationshipRoleColor(node.file.role),
                                      } as CSSProperties}
                                    />
                                  ))}
                                </div>
                                {!relationshipDashboardGraph.edges.length ? (
                                  <p className="project-map-relationship-graph-empty">
                                    {t("projectMap.relationship.graphNoEdges")}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="project-map-relationship-graph-empty">
                                {t("projectMap.relationship.graphNoEdges")}
                              </p>
                            )}
                          </div>
                          {!isRelationshipGraphInspectorCollapsed ? (
                            <aside className="project-map-relationship-graph-inspector">
                              <header className="project-map-relationship-graph-inspector-header">
                                <div>
                                  <span>{t("projectMap.relationship.graphInspector")}</span>
                                  <strong>
                                    {inspectedRelationshipFile?.basename ?? t("projectMap.relationship.inspectorNoFile")}
                                  </strong>
                                  {inspectedRelationshipFile ? <p>{inspectedRelationshipFile.path}</p> : null}
                                </div>
                              </header>
                              {inspectedRelationshipFile ? (
                                <>
                                  <div className="project-map-relationship-inspector-tags">
                                    <span>{inspectedRelationshipFile.role}</span>
                                    <span>{inspectedRelationshipFile.language}</span>
                                    <span>{inspectedRelationshipFile.layer}</span>
                                    <span>{inspectedRelationshipFile.parseStatus}</span>
                                  </div>
                                  <div className="project-map-relationship-inspector-metrics">
                                    <button
                                      type="button"
                                      onClick={() => focusProjectMapRelationshipRelation("incoming")}
                                      disabled={!inspectedRelationshipRelations.some((item) => (
                                        item.targetFileId === inspectedRelationshipFile.id
                                      ))}
                                    >
                                      <strong>{relationshipDashboardDirectionCountByFile.get(inspectedRelationshipFile.id)?.incoming ?? 0}</strong>
                                      {t("projectMap.relationship.inspectorIncomingShort")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => focusProjectMapRelationshipRelation("outgoing")}
                                      disabled={!inspectedRelationshipRelations.some((item) => (
                                        item.sourceFileId === inspectedRelationshipFile.id
                                      ))}
                                    >
                                      <strong>{relationshipDashboardDirectionCountByFile.get(inspectedRelationshipFile.id)?.outgoing ?? 0}</strong>
                                      {t("projectMap.relationship.inspectorOutgoingShort")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => focusProjectMapRelationshipRelation("total")}
                                      disabled={!inspectedRelationshipRelations.length}
                                    >
                                      <strong>{relationshipDashboardRelationCountByFile.get(inspectedRelationshipFile.id) ?? 0}</strong>
                                      {t("projectMap.relationship.inspectorTotalShort")}
                                    </button>
                                  </div>
                                  <div className="project-map-relationship-inspector-file-actions">
                                    <span className="project-map-relationship-inspector-action-label">
                                      {t("projectMap.relationship.importFileActionGroup")}
                                    </span>
                                    <label className="project-map-relationship-import-target">
                                      <span>{t("projectMap.relationship.importTargetLabel")}</span>
                                      <select
                                        value={relationshipCanvasImportTarget}
                                        disabled={isRelationshipCanvasImporting}
                                        onChange={(event) => {
                                          setRelationshipCanvasImportTarget(event.currentTarget.value);
                                        }}
                                      >
                                        <option value={PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET}>
                                          {t("projectMap.relationship.importTargetNew")}
                                        </option>
                                        {relationshipCanvasTargetEntries.map((entry) => (
                                          <option key={entry.id} value={entry.id}>
                                            {entry.title || t("intentCanvas.untitled")}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    {activeCodeSelectionAnchor ? (
                                      <div
                                        className="project-map-relationship-code-anchor"
                                        title={`${activeCodeSelectionAnchor.filePath}#${formatActiveCodeSelectionLineLabel(activeCodeSelectionAnchor)}`}
                                      >
                                        <span>{t("projectMap.relationship.activeCodeAnchor")}</span>
                                        <code>
                                          {getActiveCodeSelectionFileName(activeCodeSelectionAnchor)}
                                          {" · "}
                                          {formatActiveCodeSelectionLineLabel(activeCodeSelectionAnchor)}
                                        </code>
                                      </div>
                                    ) : null}
                                    {relationshipCanvasTargetLoadError ? (
                                      <p className="project-map-relationship-import-target-error">
                                        {t("projectMap.relationship.importTargetLoadFailed")}
                                      </p>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="project-map-relationship-inspector-primary-action"
                                      onClick={() => void handleImportRelationshipNeighborhoodToCanvas(relationshipCanvasImportTarget)}
                                      disabled={!onOpenIntentCanvasFromRelationship || isRelationshipCanvasImporting}
                                    >
                                      <ExternalLink aria-hidden />
                                      {isRelationshipCanvasImporting
                                        ? t("projectMap.relationship.importing")
                                        : t("projectMap.relationship.importFileGraphToCanvas", {
                                          count: inspectedRelationshipRelations.length,
                                        })}
                                    </button>
                                  </div>
                                  {isRelationshipCanvasImporting ? (
                                    <p className="project-map-relationship-inspector-empty">
                                      {t("projectMap.relationship.importing")}
                                    </p>
                                  ) : null}
                                  {relationshipCanvasImportError ? (
                                    <p className="project-map-relationship-inspector-empty">
                                      {relationshipCanvasImportError}
                                    </p>
                                  ) : null}
                                </>
                              ) : (
                                <p className="project-map-relationship-inspector-empty">
                                  {t("projectMap.relationship.inspectorEmpty")}
                                </p>
                              )}
                              {selectedRelationshipRelation ? (() => {
                                const sourceFile = relationshipDashboardFileIndex.get(selectedRelationshipRelation.sourceFileId);
                                const targetFile = relationshipDashboardFileIndex.get(selectedRelationshipRelation.targetFileId);
                                const evidence = selectedRelationshipRelation.evidence[0];
                                const callCandidate = getProjectMapRelationshipCallCandidate(selectedRelationshipRelation);
                                const targetDefinitionLine = resolveProjectMapRelationshipTargetSymbolLine({
                                  relation: selectedRelationshipRelation,
                                  symbols: relationshipDashboardData?.symbols ?? [],
                                });
                                return (
                                  <article className="project-map-relationship-inspector-edge-card">
                                    <span>{t("projectMap.relationship.graphSelectedEdge")}</span>
                                    <strong>
                                      {selectedRelationshipRelation.type === "calls"
                                        ? t("projectMap.relationship.methodCall")
                                        : selectedRelationshipRelation.type}
                                    </strong>
                                    <p>
                                      {sourceFile?.basename ?? selectedRelationshipRelation.sourceFileId}
                                      {" -> "}
                                      {targetFile?.basename ?? selectedRelationshipRelation.targetFileId}
                                    </p>
                                    {callCandidate ? <em>{callCandidate}</em> : null}
                                    <div className="project-map-relationship-inspector-file-actions">
                                      <span className="project-map-relationship-inspector-action-label">
                                        {t("projectMap.relationship.importEdgeActionGroup")}
                                      </span>
                                      <label className="project-map-relationship-import-target">
                                        <span>{t("projectMap.relationship.importTargetLabel")}</span>
                                        <select
                                          value={relationshipCanvasImportTarget}
                                          disabled={isRelationshipCanvasImporting}
                                          onChange={(event) => {
                                            setRelationshipCanvasImportTarget(event.currentTarget.value);
                                          }}
                                        >
                                          <option value={PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET}>
                                            {t("projectMap.relationship.importTargetNew")}
                                          </option>
                                          {relationshipCanvasTargetEntries.map((entry) => (
                                            <option key={entry.id} value={entry.id}>
                                              {entry.title || t("intentCanvas.untitled")}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      {activeCodeSelectionAnchor ? (
                                        <div
                                          className="project-map-relationship-code-anchor"
                                          title={`${activeCodeSelectionAnchor.filePath}#${formatActiveCodeSelectionLineLabel(activeCodeSelectionAnchor)}`}
                                        >
                                          <span>{t("projectMap.relationship.activeCodeAnchor")}</span>
                                          <code>
                                            {getActiveCodeSelectionFileName(activeCodeSelectionAnchor)}
                                            {" · "}
                                            {formatActiveCodeSelectionLineLabel(activeCodeSelectionAnchor)}
                                          </code>
                                        </div>
                                      ) : null}
                                      {relationshipCanvasTargetLoadError ? (
                                        <p className="project-map-relationship-import-target-error">
                                          {t("projectMap.relationship.importTargetLoadFailed")}
                                        </p>
                                      ) : null}
                                      <button
                                        type="button"
                                        disabled={!sourceFile || !onOpenEvidenceFile}
                                        onClick={() => openProjectMapRelationshipFileWithEvidence({
                                          filePath: sourceFile?.path,
                                          evidencePath: evidence?.path,
                                          evidenceLine: evidence?.line,
                                        })}
                                      >
                                        <ExternalLink aria-hidden />
                                        {t("projectMap.relationship.openSourceFile")}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!targetFile || !onOpenEvidenceFile}
                                        onClick={() => openProjectMapRelationshipFileWithEvidence({
                                          filePath: targetFile?.path,
                                          preferredLine: targetDefinitionLine,
                                          evidencePath: evidence?.path,
                                          evidenceLine: evidence?.line,
                                        })}
                                      >
                                        <ExternalLink aria-hidden />
                                        {t("projectMap.relationship.openTargetFile")}
                                      </button>
                                      <button
                                        type="button"
                                        className="project-map-relationship-inspector-secondary-action"
                                        disabled={!onOpenIntentCanvasFromRelationship || isRelationshipCanvasImporting}
                                        onClick={() => void handleImportRelationshipEdgeToCanvas(relationshipCanvasImportTarget)}
                                      >
                                        <ExternalLink aria-hidden />
                                        {isRelationshipCanvasImporting
                                          ? t("projectMap.relationship.importing")
                                          : t("projectMap.relationship.importEdgeToCanvas")}
                                      </button>
                                    </div>
                                    {evidence ? (
                                      <button
                                        type="button"
                                        className="project-map-relationship-inspector-evidence"
                                        disabled={!onOpenEvidenceFile}
                                        onClick={() => openProjectMapRelationshipPath(evidence.path, evidence.line)}
                                      >
                                        <span>{t("projectMap.relationship.evidenceTitle")}</span>
                                        <strong>
                                          {evidence.path}
                                          {evidence.line ? `:${evidence.line}` : ""}
                                        </strong>
                                        {evidence.excerpt ? <em>{evidence.excerpt}</em> : null}
                                      </button>
                                    ) : null}
                                  </article>
                                );
                              })() : null}
                              {selectedRelationshipRelationGroups.length ? (
                                <div className="project-map-relationship-inspector-section">
                                  <h5>{t("projectMap.relationship.readRelationshipSections")}</h5>
                                  {selectedRelationshipRelationGroups.map((group) => (
                                    <div key={group.id} className="project-map-relationship-inspector-relation-group">
                                      <strong>{group.title}</strong>
                                      {group.relations.slice(0, 4).map((relation) => {
                                        const sourceFile = relationshipDashboardFileIndex.get(relation.sourceFileId);
                                        const targetFile = relationshipDashboardFileIndex.get(relation.targetFileId);
                                        const callCandidate = getProjectMapRelationshipCallCandidate(relation);
                                        return (
                                          <button
                                            key={relation.id}
                                            type="button"
                                            className={cn(selectedRelationshipRelation?.id === relation.id && "is-active")}
                                            onClick={() => setSelectedRelationshipRelationId(relation.id)}
                                          >
                                            <span>{relation.type}</span>
                                            <strong>
                                              {sourceFile?.basename ?? relation.sourceFileId}
                                              {" -> "}
                                              {targetFile?.basename ?? relation.targetFileId}
                                            </strong>
                                            {callCandidate ? <em>{callCandidate}</em> : null}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {relationshipDashboardData.contextPack ? (
                                <div className="project-map-relationship-inspector-section">
                                  <h5>{t("projectMap.relationship.readContextTitle")}</h5>
                                  <div className="project-map-relationship-inspector-chip-list">
                                    {relationshipDashboardData.contextPack.mustReadFiles.slice(0, 3).map((path) => (
                                      <button
                                        key={`must:${path}`}
                                        type="button"
                                        onClick={() => openProjectMapRelationshipPath(path)}
                                      >
                                        {t("projectMap.relationship.contextMustReadChip", { path })}
                                      </button>
                                    ))}
                                    {relationshipDashboardData.contextPack.testTargets.slice(0, 3).map((path) => (
                                      <button
                                        key={`test:${path}`}
                                        type="button"
                                        onClick={() => openProjectMapRelationshipPath(path)}
                                      >
                                        {t("projectMap.relationship.contextTestChip", { path })}
                                      </button>
                                    ))}
                                    {relationshipDashboardData.contextPack.riskFlags.slice(0, 3).map((flag) => (
                                      <span key={`risk:${flag.label}`}>risk · {flag.label}</span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </aside>
                          ) : null}
                          </div>
                        </>
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
                          inspectedRelationshipFile={inspectedRelationshipFile}
                          relationshipDashboardData={relationshipDashboardData}
                          relationshipDashboardFileIndex={relationshipDashboardFileIndex}
                          relationshipDashboardModuleByFileId={relationshipDashboardModuleByFileId}
                          selectedRelationshipRelation={selectedRelationshipRelation}
                          selectedRelationshipRelationGroups={selectedRelationshipRelationGroups}
                          selectedRelationshipScopeWarnings={selectedRelationshipScopeWarnings}
                          setRelationshipDashboardViewMode={setRelationshipDashboardViewMode}
                          setSelectedRelationshipRelationId={setSelectedRelationshipRelationId}
                        />
                      ) : null}
                      {relationshipDashboardViewMode !== "api" && (relationshipDashboardData.repairIssues.length || relationshipDashboardData.readErrors.length) ? (
                        <div className="project-map-relationship-repair-strip">
                          <strong>{t("projectMap.relationship.repairTitle")}</strong>
                          {relationshipDashboardData.repairIssues.slice(0, 4).map((issue) => (
                            <span key={issue.id}>
                              {issue.severity} · {issue.kind} · {issue.path ?? issue.message}
                            </span>
                          ))}
                          {relationshipDashboardData.readErrors.slice(0, 2).map((error) => (
                            <span key={error.path}>
                              read-error · {error.path} · {error.message}
                            </span>
                          ))}
                        </div>
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
