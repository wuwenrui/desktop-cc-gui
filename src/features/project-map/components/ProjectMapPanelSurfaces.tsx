import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Folder from "lucide-react/dist/esm/icons/folder";
import ListChecks from "lucide-react/dist/esm/icons/list-checks";
import Network from "lucide-react/dist/esm/icons/network";
import RefreshCcw from "lucide-react/dist/esm/icons/refresh-ccw";
import Route from "lucide-react/dist/esm/icons/route";
import Search from "lucide-react/dist/esm/icons/search";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { cn } from "../../../lib/utils";
import type { EngineType, WorkspaceInfo } from "../../../types";
import {
  normalizeEngineType,
  useProjectMapGenerationOptions,
} from "../hooks/useProjectMapGenerationOptions";
import { PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID } from "../utils/incrementalGeneration";
import {
  formatProjectMapDateTime,
  translateProjectMapNodeKind,
} from "../utils/display";
import type {
  ProjectMapEvidenceFileEntry,
  ProjectMapEvidenceFileIndex,
} from "../utils/evidenceFileIndex";
import { projectMapPathMatches } from "../utils/projectionGuards";
import type { ProjectMapPathResult } from "../utils/navigation";
import type {
  ProjectMapIndexedRelation,
  ProjectMapNodeRelationBucket,
  ProjectMapRelationDirectionFilter,
  ProjectMapRelationIndex,
} from "../utils/relationIndex";
import type {
  ProjectMapCandidate,
  ProjectMapActivityItem,
  ProjectMapActivityProjection,
  ProjectMapAdvisorHint,
  ProjectMapAssociationExplanation,
  ProjectMapDataset,
  ProjectMapExplainPack,
  ProjectMapGenerationRequest,
  ProjectMapGraphIntegrityIssue,
  ProjectMapGraphRepairSummary,
  ProjectMapImpactResult,
  ProjectMapLens,
  ProjectMapNode,
  ProjectMapRefreshSummary,
  ProjectMapRelatedArtifact,
  ProjectMapStorageLocation,
  ProjectMapStaleReason,
} from "../types";
import {
  ProjectMapArtifactChip,
  ProjectMapDiagramChip,
  ProjectMapSourceChip,
  dedupeProjectMapArtifactsForDisplay,
  dedupeProjectMapSourcesForDisplay,
  normalizeProjectMapArtifactForDisplay,
  type ProjectMapTraceTarget,
} from "./ProjectMapTraceChips";

const PROJECT_MAP_EVIDENCE_SOURCE_KIND_ALL = "all";
const PROJECT_MAP_RELATION_FILTER_ALL = "all";

export type ProjectMapHierarchyRelationView = {
  id: string;
  parent: ProjectMapNode;
  child: ProjectMapNode;
};

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

function summarizeGraphRepairActions(summary: ProjectMapGraphRepairSummary | null): {
  deterministicCleanupCount: number;
  evidenceMarkerCount: number;
  actionCount: number;
} {
  const actions = summary?.actions ?? [];
  return {
    deterministicCleanupCount: actions.filter((repairAction) => repairAction.kind !== "quarantine-evidence-gap").length,
    evidenceMarkerCount: actions.filter((repairAction) => repairAction.kind === "quarantine-evidence-gap").length,
    actionCount: actions.length,
  };
}

type ProjectMapOrchestrationDraftState =
  | { status: "idle" }
  | {
      status: "created";
      nodeId: string;
      taskId: string;
      taskStatus: string;
      evidenceCount: number;
      riskCount: number;
    }
  | {
      status: "failed";
      nodeId: string;
      reason: "missing-workspace" | "missing-node";
    };

export function ProjectMapNavigationPanel({
  searchQuery,
  expanded,
  pathNodeOptions,
  pathSourceNodeId,
  pathTargetNodeId,
  pathResult,
  associationExplanation,
  onSearchQueryChange,
  onFocusNode,
  onPathSourceNodeChange,
  onPathTargetNodeChange,
}: {
  searchQuery: string;
  expanded: boolean;
  pathNodeOptions: ProjectMapNode[];
  pathSourceNodeId: string | null;
  pathTargetNodeId: string | null;
  pathResult: ProjectMapPathResult;
  associationExplanation: ProjectMapAssociationExplanation;
  onSearchQueryChange: (query: string) => void;
  onFocusNode: (nodeId: string | null) => void;
  onPathSourceNodeChange: (nodeId: string | null) => void;
  onPathTargetNodeChange: (nodeId: string | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <section
      className={cn("project-map-navigation-panel", !expanded && "is-collapsed")}
      aria-label={t("projectMap.navigation.title")}
    >
      {!expanded ? null : (
        <>
      <div className="project-map-navigation-card project-map-search-card">
        <header>
          <Search aria-hidden />
          <div>
            <h4>{t("projectMap.navigation.search.title")}</h4>
            <p>{t("projectMap.navigation.search.subtitle")}</p>
          </div>
        </header>
        <label className="project-map-search-input">
          <span>{t("projectMap.navigation.search.label")}</span>
          <input
            value={searchQuery}
            placeholder={t("projectMap.navigation.search.placeholder")}
            onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="project-map-navigation-card">
        <header>
          <Route aria-hidden />
          <div>
            <h4>{t("projectMap.navigation.path.title")}</h4>
            <p>{t("projectMap.navigation.path.subtitle")}</p>
          </div>
        </header>
        <div className="project-map-path-controls">
          <label>
            <span>{t("projectMap.navigation.path.source")}</span>
            <select
              value={pathSourceNodeId ?? ""}
              onChange={(event) => onPathSourceNodeChange(event.currentTarget.value || null)}
            >
              {pathNodeOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("projectMap.navigation.path.target")}</span>
            <select
              value={pathTargetNodeId ?? ""}
              onChange={(event) => onPathTargetNodeChange(event.currentTarget.value || null)}
            >
              {pathNodeOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={cn("project-map-path-result", `is-${pathResult.status}`)}>
          <p>{pathResult.message}</p>
          {pathResult.steps.length > 0 ? (
            <ol>
              {pathResult.steps.map((step, index) => (
                <li key={`${step.node.id}-${index}`}>
                  <button type="button" onClick={() => onFocusNode(step.node.id)}>
                    {step.node.title}
                  </button>
                  <span>
                    {step.via === "relation" ? (
                      <>
                        {step.relation?.label ?? step.relation?.type ?? t("projectMap.navigation.path.relation")}
                        {step.relation ? (
                          <em>
                            {t("projectMap.navigation.path.relationMeta", {
                              type: step.relation.type,
                              sourceKind: step.relation.sourceKind,
                            })}
                          </em>
                        ) : null}
                      </>
                    ) : step.via === "hierarchy" ? (
                      t("projectMap.navigation.path.hierarchy")
                    ) : (
                      t("projectMap.navigation.path.self")
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {associationExplanation.status === "found" && associationExplanation.reasons.length > 0 ? (
            <details className="project-map-path-explanation">
              <summary>{t("projectMap.navigation.path.explain")}</summary>
              <ul>
                {associationExplanation.reasons.slice(0, 6).map((reason, index) => (
                  <li
                    key={`${reason.relationId ?? reason.label}:${index}`}
                    className={cn(reason.degraded && "is-degraded")}
                  >
                    <strong>{reason.label}</strong>
                    <span>
                      {t("projectMap.navigation.path.reasonMeta", {
                        confidence: t(`projectMap.confidence.${reason.confidence}`),
                        evidence: reason.evidenceCount,
                        sourceKind: reason.sourceKind ?? t("projectMap.navigation.path.hierarchy"),
                      })}
                      {reason.stale ? ` · ${t("projectMap.relations.stale")}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : associationExplanation.status === "not-found" ? (
            <p className="project-map-path-explanation-empty">
              {t("projectMap.navigation.path.noExplanation")}
            </p>
          ) : null}
        </div>
      </div>
        </>
      )}
    </section>
  );
}

export function ProjectMapRelationLegendPanel({
  relationIndex,
  hierarchyRelations,
  hierarchyRelationTotalCount,
  expanded,
  typeFilter,
  sourceKindFilter,
  directionFilter,
  typeOptions,
  sourceKindOptions,
  selectedNodeId,
  onTypeFilterChange,
  onSourceKindFilterChange,
  onDirectionFilterChange,
  onClearSelectedRelation,
  onFocusNode,
}: {
  relationIndex: ProjectMapRelationIndex;
  hierarchyRelations: ProjectMapHierarchyRelationView[];
  hierarchyRelationTotalCount: number;
  expanded: boolean;
  typeFilter: string;
  sourceKindFilter: string;
  directionFilter: ProjectMapRelationDirectionFilter;
  typeOptions: string[];
  sourceKindOptions: string[];
  selectedNodeId: string | null;
  onTypeFilterChange: (value: string) => void;
  onSourceKindFilterChange: (value: string) => void;
  onDirectionFilterChange: (value: ProjectMapRelationDirectionFilter) => void;
  onClearSelectedRelation: () => void;
  onFocusNode: (nodeId: string) => void;
}) {
  const { t } = useTranslation();
  const hasHierarchyRelations = hierarchyRelationTotalCount > 0;

  return (
    <section className={cn("project-map-relation-legend-panel", !expanded && "is-collapsed")}>
      {!expanded ? null : (
        <>
      {hasHierarchyRelations ? (
        <p className="project-map-relation-hierarchy-summary">
          {t("projectMap.relations.hierarchySummary", {
            count: hierarchyRelationTotalCount,
            typed: relationIndex.relations.length,
          })}
        </p>
      ) : null}
      <div className="project-map-relation-filters">
        <label>
          <span>{t("projectMap.relations.typeFilter")}</span>
          <select
            value={typeFilter}
            aria-label={t("projectMap.relations.typeFilter")}
            onChange={(event) => onTypeFilterChange(event.currentTarget.value)}
          >
            <option value={PROJECT_MAP_RELATION_FILTER_ALL}>
              {t("projectMap.relations.allTypes")}
            </option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
            {hasHierarchyRelations ? (
              <option value="hierarchy">{t("projectMap.relations.hierarchyType")}</option>
            ) : null}
          </select>
        </label>
        <label>
          <span>{t("projectMap.relations.sourceKindFilter")}</span>
          <select
            value={sourceKindFilter}
            aria-label={t("projectMap.relations.sourceKindFilter")}
            onChange={(event) => onSourceKindFilterChange(event.currentTarget.value)}
          >
            <option value={PROJECT_MAP_RELATION_FILTER_ALL}>
              {t("projectMap.relations.allSourceKinds")}
            </option>
            {sourceKindOptions.map((sourceKind) => (
              <option key={sourceKind} value={sourceKind}>
                {sourceKind}
              </option>
            ))}
            {hasHierarchyRelations ? (
              <option value="map-tree">{t("projectMap.relations.mapTreeSourceKind")}</option>
            ) : null}
          </select>
        </label>
        <label>
          <span>{t("projectMap.relations.directionFilter")}</span>
          <select
            value={directionFilter}
            disabled={!selectedNodeId}
            aria-label={t("projectMap.relations.directionFilter")}
            onChange={(event) =>
              onDirectionFilterChange(event.currentTarget.value as ProjectMapRelationDirectionFilter)
            }
          >
            <option value="all">{t("projectMap.relations.allDirections")}</option>
            <option value="incoming">{t("projectMap.relations.incoming")}</option>
            <option value="outgoing">{t("projectMap.relations.outgoing")}</option>
          </select>
        </label>
        <button type="button" onClick={onClearSelectedRelation}>
          {t("projectMap.relations.clearSelection")}
        </button>
      </div>
      {relationIndex.typeCounts.length > 0 ? (
        <div className="project-map-relation-type-counts">
          {hasHierarchyRelations ? (
            <button
              key="hierarchy"
              type="button"
              className={cn(typeFilter === "hierarchy" && "is-active")}
              onClick={() =>
                onTypeFilterChange(typeFilter === "hierarchy" ? PROJECT_MAP_RELATION_FILTER_ALL : "hierarchy")
              }
            >
              <span>{t("projectMap.relations.hierarchyType")}</span>
              <em>{hierarchyRelationTotalCount}</em>
            </button>
          ) : null}
          {relationIndex.typeCounts.slice(0, 8).map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn(typeFilter === item.key && "is-active")}
              onClick={() =>
                onTypeFilterChange(typeFilter === item.key ? PROJECT_MAP_RELATION_FILTER_ALL : item.key)
              }
            >
              <span>{item.key}</span>
              <em>{item.count}</em>
            </button>
          ))}
        </div>
      ) : (
        <>
          {hasHierarchyRelations ? (
            <div className="project-map-relation-type-counts">
              <button
                type="button"
                className={cn(typeFilter === "hierarchy" && "is-active")}
                onClick={() =>
                  onTypeFilterChange(typeFilter === "hierarchy" ? PROJECT_MAP_RELATION_FILTER_ALL : "hierarchy")
                }
              >
                <span>{t("projectMap.relations.hierarchyType")}</span>
                <em>{hierarchyRelationTotalCount}</em>
              </button>
            </div>
          ) : null}
          <p className="project-map-relation-empty">
            {hasHierarchyRelations
              ? t("projectMap.relations.noTypedRelations")
              : t("projectMap.relations.empty")}
          </p>
        </>
      )}
      {hierarchyRelations.length > 0 ? (
        <div className="project-map-hierarchy-relation-list" role="list">
          {hierarchyRelations.slice(0, 16).map((relation) => (
            <div key={relation.id} className="project-map-hierarchy-relation-row" role="listitem">
              <span>{t("projectMap.relations.hierarchyType")}</span>
              <button type="button" onClick={() => onFocusNode(relation.parent.id)}>
                {relation.parent.title}
              </button>
              <em>→</em>
              <button type="button" onClick={() => onFocusNode(relation.child.id)}>
                {relation.child.title}
              </button>
            </div>
          ))}
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}

export function ProjectMapRelationInspector({
  bucket,
  selectedRelationId,
  onFocusNode,
  onSelectRelation,
}: {
  bucket: ProjectMapNodeRelationBucket | null;
  selectedRelationId: string | null;
  onFocusNode: (nodeId: string) => void;
  onSelectRelation: (relationId: string) => void;
}) {
  const { t } = useTranslation();
  const incoming = bucket?.incoming ?? [];
  const outgoing = bucket?.outgoing ?? [];

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <section className="project-map-relation-inspector">
        <header className="project-map-relation-inspector-head">
          <h4>{t("projectMap.relations.inspectorTitle")}</h4>
          <p>{t("projectMap.relations.noNodeRelations")}</p>
        </header>
      </section>
    );
  }

  return (
    <section className="project-map-relation-inspector">
      <header className="project-map-relation-inspector-head">
        <h4>{t("projectMap.relations.inspectorTitle")}</h4>
        <p>
          {t("projectMap.relations.inspectorSummary", {
            defaultValue: "{{outgoing}} outgoing · {{incoming}} incoming",
            outgoing: outgoing.length,
            incoming: incoming.length,
          })}
        </p>
      </header>
      <ProjectMapRelationGroup
        title={t("projectMap.relations.outgoing")}
        relations={outgoing}
        selectedRelationId={selectedRelationId}
        endpointKind="target"
        onFocusNode={onFocusNode}
        onSelectRelation={onSelectRelation}
      />
      <ProjectMapRelationGroup
        title={t("projectMap.relations.incoming")}
        relations={incoming}
        selectedRelationId={selectedRelationId}
        endpointKind="source"
        onFocusNode={onFocusNode}
        onSelectRelation={onSelectRelation}
      />
    </section>
  );
}

export function ProjectMapRelationGroup({
  title,
  relations,
  selectedRelationId,
  endpointKind,
  onFocusNode,
  onSelectRelation,
}: {
  title: string;
  relations: ProjectMapIndexedRelation[];
  selectedRelationId: string | null;
  endpointKind: "source" | "target";
  onFocusNode: (nodeId: string) => void;
  onSelectRelation: (relationId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="project-map-relation-group">
      <strong>
        {title} <span>{relations.length}</span>
      </strong>
      {relations.length === 0 ? (
        <p>{t("projectMap.relations.noRelationsInGroup")}</p>
      ) : (
        <ul>
          {relations.slice(0, 8).map((indexedRelation) => {
            const endpoint = indexedRelation[endpointKind];
            const relation = indexedRelation.relation;
            return (
              <li
                key={`${title}:${relation.id}:${endpointKind}`}
                className={cn(
                  selectedRelationId === relation.id && "is-selected",
                  indexedRelation.degraded && "is-degraded",
                )}
              >
                <button
                  className="project-map-relation-select-button"
                  type="button"
                  onClick={() => onSelectRelation(relation.id)}
                >
                  <span>{relation.label ?? relation.type}</span>
                  <em>
                    {relation.sourceKind} · {relation.confidence}
                    {relation.stale ? ` · ${t("projectMap.relations.stale")}` : ""}
                  </em>
                </button>
                {endpoint.node ? (
                  <button
                    className="project-map-relation-endpoint-button"
                    type="button"
                    onClick={() => onFocusNode(endpoint.nodeId)}
                  >
                    <span>{endpoint.node.title}</span>
                    <em>{t("projectMap.relations.focusEndpoint", { defaultValue: "Focus node" })}</em>
                  </button>
                ) : (
                  <span>{t("projectMap.relations.missingEndpoint", { nodeId: endpoint.nodeId })}</span>
                )}
                {relation.evidence.length > 0 ? (
                  <small className="project-map-relation-evidence-count">
                    {t("projectMap.relations.evidenceCount", { count: relation.evidence.length })}
                  </small>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ProjectMapEvidenceFilesPanel({
  evidenceFileIndex,
  filteredFiles,
  selectedFile,
  expanded,
  changedFilePaths,
  unmappedFilePaths,
  selectedNodeId,
  searchQuery,
  sourceKindFilter,
  sourceKindOptions,
  showSelectedNodeOnly,
  isHighlightActive,
  onExpandedChange,
  onSearchQueryChange,
  onSourceKindFilterChange,
  onSelectedNodeOnlyChange,
  onSelectFile,
  onFocusNode,
  onSelectRelation,
  onClearHighlight,
  onOpenTrace,
}: {
  evidenceFileIndex: ProjectMapEvidenceFileIndex;
  filteredFiles: ProjectMapEvidenceFileEntry[];
  selectedFile: ProjectMapEvidenceFileEntry | null;
  expanded: boolean;
  changedFilePaths: string[];
  unmappedFilePaths: string[];
  selectedNodeId: string | null;
  searchQuery: string;
  sourceKindFilter: string;
  sourceKindOptions: string[];
  showSelectedNodeOnly: boolean;
  isHighlightActive: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  onSourceKindFilterChange: (sourceKind: string) => void;
  onSelectedNodeOnlyChange: (enabled: boolean) => void;
  onSelectFile: (path: string) => void;
  onFocusNode: (nodeId: string) => void;
  onSelectRelation: (relationId: string) => void;
  onClearHighlight: () => void;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  const { t } = useTranslation();
  const firstLineRef = selectedFile?.lineRefs[0] ?? null;
  const canOpenSelectedFile = Boolean(selectedFile && onOpenTrace);
  const visibleFiles = filteredFiles.slice(0, 10);
  const cappedFileCount = Math.max(0, filteredFiles.length - visibleFiles.length);
  const selectedFileRelationLinks = selectedFile?.relationLinks.slice(0, 6) ?? [];
  const selectedFileNodeLinks = selectedFile?.nodeLinks.slice(0, 8) ?? [];
  const selectedFileLineRefs = selectedFile?.lineRefs.slice(0, 6) ?? [];
  const selectedFileGovernanceLinks = selectedFile?.governanceLinks.slice(0, 5) ?? [];
  const selectedFileHasLargeContext = Boolean(
    selectedFile &&
      (selectedFile.nodeLinks.length > selectedFileNodeLinks.length ||
        selectedFile.relationLinks.length > selectedFileRelationLinks.length ||
        selectedFile.lineRefs.length > selectedFileLineRefs.length ||
        selectedFile.governanceLinks.length > selectedFileGovernanceLinks.length),
  );

  const getFileMarkers = (fileEntry: ProjectMapEvidenceFileEntry): Array<{
    key: string;
    label: string;
    className?: string;
  }> => {
    const markers = [];
    if (changedFilePaths.some((filePath) => projectMapPathMatches(fileEntry.path, filePath))) {
      markers.push({
        key: "changed",
        label: t("projectMap.evidenceFiles.changed"),
        className: "is-changed",
      });
    }
    if (unmappedFilePaths.some((filePath) => projectMapPathMatches(fileEntry.path, filePath))) {
      markers.push({
        key: "unmapped",
        label: t("projectMap.evidenceFiles.unmapped"),
        className: "is-degraded",
      });
    }
    if (fileEntry.nodeCount > 8 || fileEntry.relationCount > 6 || fileEntry.lineRefs.length > 6) {
      markers.push({
        key: "large",
        label: t("projectMap.evidenceFiles.largeContext"),
        className: "is-warning",
      });
    }
    return markers;
  };

  return (
    <section className={cn("project-map-evidence-files-panel", !expanded && "is-collapsed")}>
      <div className="project-map-evidence-files-header">
        <Folder aria-hidden />
        <div>
          <h4>{t("projectMap.evidenceFiles.title")}</h4>
          <p>
            {t("projectMap.evidenceFiles.summary", {
              files: evidenceFileIndex.files.length,
              evidence: evidenceFileIndex.totalFileEvidenceCount,
              nonFile: evidenceFileIndex.totalNonFileEvidenceCount,
            })}
          </p>
        </div>
        <button type="button" onClick={() => onExpandedChange(!expanded)}>
          {expanded ? t("projectMap.evidenceFiles.collapse") : t("projectMap.evidenceFiles.expand")}
        </button>
      </div>
      {!expanded ? null : (
        <>

      <div className="project-map-evidence-files-controls">
        <label className="project-map-search-input">
          <Search aria-hidden />
          <input
            value={searchQuery}
            placeholder={t("projectMap.evidenceFiles.searchPlaceholder")}
            aria-label={t("projectMap.evidenceFiles.searchLabel")}
            onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          />
        </label>
        <select
          value={sourceKindFilter}
          aria-label={t("projectMap.evidenceFiles.sourceKindFilter")}
          onChange={(event) => onSourceKindFilterChange(event.currentTarget.value)}
        >
          <option value={PROJECT_MAP_EVIDENCE_SOURCE_KIND_ALL}>
            {t("projectMap.evidenceFiles.allSourceKinds")}
          </option>
          {sourceKindOptions.map((sourceKind) => (
            <option key={sourceKind} value={sourceKind}>
              {sourceKind}
            </option>
          ))}
        </select>
        <label className="project-map-evidence-files-toggle">
          <input
            type="checkbox"
            checked={showSelectedNodeOnly}
            disabled={!selectedNodeId}
            onChange={(event) => onSelectedNodeOnlyChange(event.currentTarget.checked)}
          />
          <span>{t("projectMap.evidenceFiles.selectedNodeOnly")}</span>
        </label>
      </div>

      {evidenceFileIndex.files.length === 0 ? (
        <p className="project-map-evidence-files-empty">
          {t("projectMap.evidenceFiles.empty")}
        </p>
      ) : filteredFiles.length === 0 ? (
        <p className="project-map-evidence-files-empty">
          {t("projectMap.evidenceFiles.noFilteredFiles")}
        </p>
      ) : (
        <div className="project-map-evidence-file-list" role="list">
          {visibleFiles.map((fileEntry) => {
            const markers = getFileMarkers(fileEntry);
            return (
              <button
                key={fileEntry.path}
                type="button"
                className={cn(
                  "project-map-evidence-file-row",
                  selectedFile?.path === fileEntry.path && "is-selected",
                )}
                onClick={() => {
                  onSelectFile(fileEntry.path);
                  const fileLineRef = fileEntry.lineRefs[0] ?? null;
                  onOpenTrace?.(
                    fileLineRef
                      ? { path: fileEntry.path, line: fileLineRef.line }
                      : { path: fileEntry.path },
                  );
                }}
              >
                <span className="project-map-evidence-file-path">{fileEntry.displayPath}</span>
                <span className="project-map-evidence-file-meta">
                  {t("projectMap.evidenceFiles.fileMeta", {
                    nodes: fileEntry.nodeCount,
                    evidence: fileEntry.evidenceCount,
                  })}
                </span>
                <span className="project-map-evidence-file-tags">
                  {markers.map((marker) => (
                    <em key={marker.key} className={marker.className}>{marker.label}</em>
                  ))}
                  {fileEntry.sourceKinds.slice(0, 3).map((sourceKind) => (
                    <em key={sourceKind}>{sourceKind}</em>
                  ))}
                  {fileEntry.staleCount > 0 ? (
                    <em className="is-warning">{t("projectMap.evidenceFiles.stale")}</em>
                  ) : null}
                  {fileEntry.lowConfidenceCount > 0 ? (
                    <em className="is-warning">{t("projectMap.evidenceFiles.lowConfidence")}</em>
                  ) : null}
                  {fileEntry.degradedCount > 0 ? (
                    <em className="is-degraded">{t("projectMap.evidenceFiles.degraded")}</em>
                  ) : null}
                </span>
              </button>
            );
          })}
          {cappedFileCount > 0 ? (
            <p className="project-map-evidence-files-empty">
              {t("projectMap.evidenceFiles.cappedFiles", { count: cappedFileCount })}
            </p>
          ) : null}
        </div>
      )}

      {selectedFile ? (
        <div className="project-map-evidence-file-detail">
          <header>
            <div>
              <h5>{selectedFile.displayPath}</h5>
              <p>
                {t("projectMap.evidenceFiles.detailMeta", {
                  nodes: selectedFile.nodeCount,
                  relations: selectedFile.relationCount,
                  governance: selectedFile.governanceLinks.length,
                })}
              </p>
            </div>
            <div className="project-map-evidence-file-actions">
              <button
                type="button"
                disabled={!canOpenSelectedFile}
                onClick={() => {
                  if (!selectedFile || !onOpenTrace) {
                    return;
                  }
                  onOpenTrace(
                    firstLineRef
                      ? { path: selectedFile.path, line: firstLineRef.line }
                      : { path: selectedFile.path },
                  );
                }}
              >
                {t("projectMap.evidenceFiles.openFile")}
              </button>
              {isHighlightActive ? (
                <button type="button" onClick={onClearHighlight}>
                  {t("projectMap.evidenceFiles.clearHighlight")}
                </button>
              ) : (
                <button type="button" onClick={() => onSelectFile(selectedFile.path)}>
                  {t("projectMap.evidenceFiles.highlightNodes")}
                </button>
              )}
            </div>
          </header>
          {selectedFileHasLargeContext ? (
            <p className="project-map-evidence-files-empty">
              {t("projectMap.evidenceFiles.largeContent")}
            </p>
          ) : null}

          {selectedFile.nodeLinks.length > 0 ? (
            <div className="project-map-evidence-related-nodes">
              <strong>{t("projectMap.evidenceFiles.relatedNodes")}</strong>
              {selectedFileNodeLinks.map((nodeLink) => (
                <button
                  key={nodeLink.nodeId}
                  type="button"
                  onClick={() => onFocusNode(nodeLink.nodeId)}
                >
                  <span>{nodeLink.title}</span>
                  <em>
                    {t("projectMap.evidenceFiles.nodeMeta", {
                      evidence: nodeLink.evidenceCount,
                      confidence: nodeLink.confidence,
                    })}
                  </em>
                </button>
              ))}
            </div>
          ) : (
            <p className="project-map-evidence-files-empty">
              {t("projectMap.evidenceFiles.noRelatedNodes")}
            </p>
          )}

          {selectedFileRelationLinks.length > 0 ? (
            <div className="project-map-evidence-related-nodes">
              <strong>{t("projectMap.evidenceFiles.relatedRelations")}</strong>
              {selectedFileRelationLinks.map((relationLink) => (
                <button
                  key={relationLink.relationId}
                  type="button"
                  onClick={() => {
                    onSelectRelation(relationLink.relationId);
                    const focusNodeId = relationLink.sourceNodeId || relationLink.targetNodeId;
                    if (focusNodeId) {
                      onFocusNode(focusNodeId);
                    }
                  }}
                >
                  <span>{relationLink.type}</span>
                  <em>
                    {t("projectMap.evidenceFiles.relationMeta", {
                      evidence: relationLink.evidenceCount,
                      confidence: relationLink.confidence,
                    })}
                  </em>
                </button>
              ))}
            </div>
          ) : null}

          {selectedFileGovernanceLinks.length > 0 ? (
            <div className="project-map-evidence-line-refs">
              <strong>{t("projectMap.evidenceFiles.governanceRefs")}</strong>
              <span>
                {selectedFileGovernanceLinks
                  .map((link) => link.line ? `${link.label}:${link.line}` : link.label)
                  .join(" · ")}
              </span>
            </div>
          ) : null}

          {selectedFile.lineRefs.length > 0 ? (
            <div className="project-map-evidence-line-refs">
              <strong>{t("projectMap.evidenceFiles.lineRefs")}</strong>
              <span>
                {selectedFileLineRefs
                  .map((lineRef) => `${lineRef.label}:${lineRef.line}`)
                  .join(" · ")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {evidenceFileIndex.nonFileEvidence.length > 0 ? (
        <p className="project-map-evidence-non-file">
          {t("projectMap.evidenceFiles.nonFileEvidence", {
            count: evidenceFileIndex.nonFileEvidence.length,
          })}
        </p>
      ) : null}
        </>
      )}
    </section>
  );
}

export function DetailPanel({
  node,
  dataset,
  pendingCandidate,
  lens,
  explainPack,
  relationBucket,
  activityProjection,
  nodeExplainHint,
  selectedRelationId,
  impactAnalysis,
  refreshSummary,
  nodeStaleReasons,
  graphIntegrityIssues,
  graphRepairSummary,
  isGraphHealthExpanded,
  orchestrationDraftState,
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
  onCreateOrchestrationTask,
  onOrganizeUnassigned,
  onConfirmCandidate,
  onRejectCandidate,
  onConfirmNodeCandidate,
  onRejectNodeCandidate,
  onDeleteNode,
  onOpenTrace,
  onFocusRelationNode,
  onSelectRelation,
  onGraphHealthExpandedChange,
  onRepairGraph,
  onOpenIntentCanvasArchitect,
  onOpenIntentCanvasSpotlight,
  onOpenIntentCanvasForFile,
}: {
  node: ProjectMapNode | null;
  dataset: ProjectMapDataset;
  pendingCandidate: ProjectMapCandidate | null;
  lens: ProjectMapLens | null;
  explainPack: ProjectMapExplainPack | null;
  relationBucket: ProjectMapNodeRelationBucket | null;
  activityProjection: ProjectMapActivityProjection;
  nodeExplainHint: ProjectMapAdvisorHint | null;
  selectedRelationId: string | null;
  impactAnalysis: ProjectMapImpactResult;
  refreshSummary: ProjectMapRefreshSummary;
  nodeStaleReasons: ProjectMapStaleReason[];
  graphIntegrityIssues: ProjectMapGraphIntegrityIssue[];
  graphRepairSummary: ProjectMapGraphRepairSummary | null;
  isGraphHealthExpanded: boolean;
  orchestrationDraftState: ProjectMapOrchestrationDraftState;
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
  onCreateOrchestrationTask: () => void;
  onOrganizeUnassigned: () => void;
  onConfirmCandidate: (candidateId: string) => void;
  onRejectCandidate: (candidateId: string) => void;
  onConfirmNodeCandidate: (nodeId: string) => void;
  onRejectNodeCandidate: (nodeId: string) => void;
  onDeleteNode: (() => void) | null;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
  onFocusRelationNode: (nodeId: string) => void;
  onSelectRelation: (relationId: string) => void;
  onGraphHealthExpandedChange: (expanded: boolean) => void;
  onRepairGraph: () => Promise<void>;
  onOpenIntentCanvasArchitect?: () => void;
  onOpenIntentCanvasSpotlight?: () => void;
  onOpenIntentCanvasForFile?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const isCalibratedCandidate = node
    ? isCandidateAfterCompletedCalibration(dataset, node)
    : false;
  const moveSuggestedParent = pendingCandidate?.move?.suggestedParentId
    ? dataset.nodes.find((candidateNode) => candidateNode.id === pendingCandidate.move?.suggestedParentId) ?? null
    : null;
  const isUnassignedDiscoveriesNode = node?.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID;
  const impactRole = node
    ? impactAnalysis.changedNodes.some((item) => item.node.id === node.id)
      ? "changed"
      : impactAnalysis.affectedNodes.some((item) => item.node.id === node.id)
        ? "affected"
        : null
    : null;
  const activeDraftState =
    node && orchestrationDraftState.status !== "idle" && orchestrationDraftState.nodeId === node.id
      ? orchestrationDraftState
      : null;
  const graphRepairActionSummary = summarizeGraphRepairActions(graphRepairSummary);
  const repairIssueCount = graphIntegrityIssues.length;
  const canRunGraphRepair = repairIssueCount > 0;
  const repairActionLabel =
    graphIntegrityIssues.some((issue) => issue.kind !== "missing-node-evidence")
      ? t("projectMap.repair.cleanupAction")
      : t("projectMap.repair.markEvidenceAction");
  const nodeRelatedActivity = node
    ? activityProjection.items.filter((item) => item.nodeIds.includes(node.id)).slice(0, 6)
    : [];
  const explainPackRelationCount = explainPack?.relations.length ?? 0;
  const explainPackEvidenceCount = explainPack
    ? explainPack.evidenceSources.length + explainPack.evidenceRecords.length + explainPack.governanceEvidence.length
    : 0;
  const primaryFileSource = node?.sources.find((source) => source.path?.trim()) ?? null;

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

          <div
            className="project-map-inspector-zones"
            aria-label={t("projectMap.detail.inspectorZones", {
              defaultValue: "Node understanding zones",
            })}
          >
            <section className="project-map-inspector-zone is-understand">
              <header className="project-map-inspector-zone-header">
                <span>01</span>
                <div>
                  <h4>{t("projectMap.detail.understandZone", { defaultValue: "Understand" })}</h4>
                  <p>
                    {t("projectMap.detail.understandZoneHint", {
                      defaultValue: "What this node means, what matters, and what can break.",
                    })}
                  </p>
                </div>
              </header>
              <section>
                <h4>{t("projectMap.detail.coreDescription")}</h4>
                <p>{node.detail.coreDescription}</p>
              </section>
              <InspectorList title={t("projectMap.detail.keyFacts")} items={node.detail.keyFacts} />
              <InspectorList title={t("projectMap.detail.keyLogic")} items={node.detail.keyLogic} />
              <InspectorList
                title={t("projectMap.detail.riskSignals")}
                items={node.detail.riskSignals}
                emptyLabel={t("projectMap.none")}
              />
              {impactAnalysis.inputFiles.length > 0 ? (
                <section>
                  <h4>{t("projectMap.impact.title", { defaultValue: "Impact" })}</h4>
                  {impactAnalysis.source ? (
                    <p>
                      {t("projectMap.impact.source", {
                        defaultValue: "Source: {{source}} · {{count}} files",
                        source: impactAnalysis.source.label,
                        count: impactAnalysis.source.fileCount,
                      })}
                    </p>
                  ) : null}
                  <p>
                    {t("projectMap.impact.summary", {
                      defaultValue:
                        "{{changed}} changed · {{affected}} affected · {{unmapped}} unmapped · {{ignored}} ignored",
                      changed: impactAnalysis.riskSummary.changedCount,
                      affected: impactAnalysis.riskSummary.affectedCount,
                      unmapped: impactAnalysis.riskSummary.unmappedCount,
                      ignored: impactAnalysis.riskSummary.ignoredCount,
                    })}
                  </p>
                  {impactRole ? (
                    <p>
                      {t("projectMap.impact.nodeRole", {
                        defaultValue: "This node is {{role}} by the current file set.",
                        role: impactRole,
                      })}
                    </p>
                  ) : null}
                  {impactAnalysis.unmappedFiles.length > 0 ? (
                    <ul>
                      {impactAnalysis.unmappedFiles.slice(0, 5).map((filePath) => (
                        <li key={filePath}>{filePath}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
              {(node.stale || nodeStaleReasons.length > 0 || refreshSummary.changedPaths.length > 0) ? (
                <section>
                  <h4>{t("projectMap.refresh.title")}</h4>
                  <p>{refreshSummary.label}</p>
                  {nodeStaleReasons.length > 0 ? (
                    <ul>
                      {nodeStaleReasons.slice(0, 6).map((reason) => (
                        <li key={reason.id}>
                          <strong>{t(`projectMap.refresh.classification.${reason.recommendation}`)}</strong>
                          {" · "}
                          {reason.label}
                          {reason.path ? ` · ${reason.path}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {refreshSummary.ignoredPaths.length > 0 ? (
                    <p>
                      {t("projectMap.refresh.ignored", {
                        count: refreshSummary.ignoredPaths.length,
                      })}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </section>
              <section className="project-map-inspector-zone is-evidence">
              <header className="project-map-inspector-zone-header">
                <span>02</span>
                <div>
                  <h4>{t("projectMap.detail.evidenceZone", { defaultValue: "Evidence" })}</h4>
                  <p>
                    {t("projectMap.detail.evidenceZoneHint", {
                      defaultValue: "Why ccgui trusts this node and where the proof lives.",
                    })}
                  </p>
                </div>
              </header>
              {nodeExplainHint ? (
                <details className="project-map-detail-disclosure" open>
                  <summary>
                    <span>{t("projectMap.detail.explainContext")}</span>
                    <em>{nodeExplainHint.deterministic ? t("projectMap.detail.deterministic") : t("projectMap.detail.inferred")}</em>
                  </summary>
                  <p>{nodeExplainHint.summary}</p>
                  <div className="project-map-detail-mini-pills">
                    <span>{nodeExplainHint.kind}</span>
                    <span>{nodeExplainHint.severity ?? "info"}</span>
                    {nodeExplainHint.degraded ? <span>{t("projectMap.detail.degraded")}</span> : null}
                  </div>
                </details>
              ) : null}
              {explainPack ? (
                <details className="project-map-detail-disclosure">
                  <summary>
                    <span>{t("projectMap.detail.evidenceAndContext")}</span>
                    <em>
                      {t("projectMap.detail.evidenceSummary", {
                        evidence: explainPackEvidenceCount,
                        relations: explainPackRelationCount,
                      })}
                    </em>
                  </summary>
                  <section>
                    <h4>{t("projectMap.detail.explainPack", { defaultValue: "Explain Pack" })}</h4>
                    <dl className="project-map-definition-grid">
                      <div>
                        <dt>{t("projectMap.detail.relatedNodes", { defaultValue: "Related nodes" })}</dt>
                        <dd>{explainPack.relatedNodes.length}</dd>
                      </div>
                      <div>
                        <dt>{t("projectMap.detail.relations", { defaultValue: "Relations" })}</dt>
                        <dd>{explainPack.relations.length}</dd>
                      </div>
                      <div>
                        <dt>{t("projectMap.detail.riskFlags", { defaultValue: "Risk flags" })}</dt>
                        <dd>{explainPack.riskFlags.length}</dd>
                      </div>
                    </dl>
                    {explainPack.relatedNodes.length > 0 ? (
                      <ul>
                        {explainPack.relatedNodes.slice(0, 6).map((relatedNode) => (
                          <li key={relatedNode.id}>
                            <strong>{relatedNode.title}</strong>
                            {" · "}
                            {translateProjectMapNodeKind(t, relatedNode.nodeKind)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {explainPack.evidenceSources.length > 0 ? (
                      <div className="project-map-source-list">
                        {dedupeProjectMapSourcesForDisplay(explainPack.evidenceSources).slice(0, 6).map((source) => (
                          <ProjectMapSourceChip
                            key={`${source.type}-${source.label}-${source.path ?? source.hash ?? ""}-${source.line ?? ""}`}
                            source={source}
                            onOpenTrace={onOpenTrace}
                          />
                        ))}
                      </div>
                    ) : null}
                    {explainPack.governanceEvidence.length > 0 ? (
                      <div className="project-map-governance-links">
                        {explainPack.governanceEvidence.slice(0, 8).map((link) => (
                          <span
                            key={link.id}
                            className={cn(
                              "project-map-governance-link",
                              `kind-${link.kind}`,
                              !link.deterministic && "is-inferred",
                            )}
                          >
                            <strong>{link.kind}</strong>
                            {link.path ? (
                              <button
                                type="button"
                                onClick={() => onOpenTrace?.({ path: link.path!, line: link.line })}
                              >
                                {link.label}
                              </button>
                            ) : (
                              <em>{link.label}</em>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </section>
                </details>
              ) : null}
              <details className="project-map-detail-disclosure">
                <summary>
                  <span>{t("projectMap.detail.recentActivity")}</span>
                  <em>{t("projectMap.detail.activitySummary", { count: nodeRelatedActivity.length })}</em>
                </summary>
                {nodeRelatedActivity.length > 0 ? (
                  <ul className="project-map-detail-activity-list">
                    {nodeRelatedActivity.map((item: ProjectMapActivityItem) => (
                      <li key={item.id} className={cn(item.degraded && "is-degraded")}>
                        <strong>{item.title}</strong>
                        <span>{item.summary}</span>
                        <em>{item.sourceCategory} · {item.confidence}</em>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t("projectMap.detail.noRecentActivity")}</p>
                )}
              </details>
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
                  {dedupeProjectMapArtifactsForDisplay(
                    node.detail.relatedArtifacts
                      .map(normalizeProjectMapArtifactForDisplay)
                      .filter((artifact): artifact is ProjectMapRelatedArtifact => Boolean(artifact)),
                  )
                    .map((artifact) => (
                      <ProjectMapArtifactChip
                        key={`${artifact.type}-${artifact.label}-${artifact.path ?? artifact.ref ?? ""}-${artifact.line ?? ""}`}
                        artifact={artifact}
                        onOpenTrace={onOpenTrace}
                      />
                    ))}
                </div>
              </section>
              <section>
                <h4>{t("projectMap.evidenceTitle")}</h4>
                <div className="project-map-source-list">
                  {dedupeProjectMapSourcesForDisplay(node.sources).map((source) => (
                    <ProjectMapSourceChip
                      key={`${source.type}-${source.label}-${source.path ?? source.hash ?? ""}-${source.line ?? ""}`}
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
            </section>
            <section className="project-map-inspector-zone is-relations">
              <header className="project-map-inspector-zone-header">
                <span>03</span>
                <div>
                  <h4>{t("projectMap.detail.relationZone", { defaultValue: "Relations" })}</h4>
                  <p>
                    {t("projectMap.detail.relationZoneHint", {
                      defaultValue: "Follow incoming, outgoing, and degraded engineering links.",
                    })}
                  </p>
                </div>
              </header>
              <details className="project-map-detail-disclosure">
                <summary>
                  <span>{t("projectMap.detail.associations")}</span>
                  <em>
                    {t("projectMap.detail.associationSummary", {
                      incoming: relationBucket?.incoming.length ?? 0,
                      outgoing: relationBucket?.outgoing.length ?? 0,
                    })}
                  </em>
                </summary>
                <ProjectMapRelationInspector
                  bucket={relationBucket}
                  selectedRelationId={selectedRelationId}
                  onFocusNode={onFocusRelationNode}
                  onSelectRelation={onSelectRelation}
                />
              </details>
            </section>
            <section className="project-map-inspector-zone is-actions">
              <header className="project-map-inspector-zone-header">
                <span>04</span>
                <div>
                  <h4>{t("projectMap.detail.actionsZone", { defaultValue: "Actions" })}</h4>
                  <p>
                    {t("projectMap.detail.actionsZoneHint", {
                      defaultValue: "Only bounded actions are exposed here; queue work stays secondary.",
                    })}
                  </p>
                </div>
              </header>
              {(graphIntegrityIssues.length > 0 || graphRepairSummary) ? (
                <section className={cn("project-map-repair-summary", !isGraphHealthExpanded && "is-compact")}>
                  <div className="project-map-repair-summary-head">
                    <h4>{t("projectMap.repair.title")}</h4>
                    <button
                      type="button"
                      onClick={() => onGraphHealthExpandedChange(!isGraphHealthExpanded)}
                    >
                      {isGraphHealthExpanded
                        ? t("projectMap.repair.collapse", { defaultValue: "收起" })
                        : t("projectMap.repair.expand", { defaultValue: "展开" })}
                    </button>
                  </div>
                  <p>
                    {t("projectMap.repair.summary", {
                      issues: repairIssueCount,
                      actions: graphRepairActionSummary.actionCount,
                    })}
                  </p>
                  {isGraphHealthExpanded && graphRepairActionSummary.actionCount > 0 ? (
                    <p>
                      {t("projectMap.repair.result", {
                        cleanup: graphRepairActionSummary.deterministicCleanupCount,
                        evidence: graphRepairActionSummary.evidenceMarkerCount,
                      })}
                    </p>
                  ) : null}
                  {isGraphHealthExpanded && canRunGraphRepair ? (
                    <button type="button" onClick={() => void onRepairGraph()} disabled={!canRunGraphRepair}>
                      {repairActionLabel}
                    </button>
                  ) : null}
                  {isGraphHealthExpanded && (graphRepairSummary?.actions ?? []).length > 0 ? (
                    <ul>
                      {(graphRepairSummary?.actions ?? []).slice(0, 6).map((repairAction) => (
                        <li key={repairAction.id}>{repairAction.label}</li>
                      ))}
                    </ul>
                  ) : isGraphHealthExpanded && graphIntegrityIssues.length > 0 ? (
                    <ul>
                      {graphIntegrityIssues.slice(0, 6).map((issue) => (
                        <li key={issue.id}>{issue.label}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
              <section className="project-map-orchestration-bridge">
                <h4>{t("projectMap.orchestration.title")}</h4>
                <p>{t("projectMap.orchestration.description")}</p>
                <div className="project-map-orchestration-summary">
                  <span>{t("projectMap.orchestration.sourceNode", { nodeId: node.id })}</span>
                  <span>
                    {t("projectMap.orchestration.evidenceCount", {
                      count:
                        node.sources.length +
                        node.detail.relatedArtifacts.length +
                        (node.detail.diagramArtifacts ?? []).length,
                    })}
                  </span>
                  {node.stale || node.candidate || node.confidence === "low" || node.confidence === "unknown" ? (
                    <span className="is-warning">{t("projectMap.orchestration.reviewRequired")}</span>
                  ) : (
                    <span>{t("projectMap.orchestration.readyForDraft")}</span>
                  )}
                </div>
                {activeDraftState?.status === "created" ? (
                  <p className="project-map-orchestration-status" role="status">
                    {t("projectMap.orchestration.created", {
                      taskId: activeDraftState.taskId,
                      status: activeDraftState.taskStatus,
                      evidence: activeDraftState.evidenceCount,
                      risks: activeDraftState.riskCount,
                    })}
                  </p>
                ) : null}
                {activeDraftState?.status === "failed" ? (
                  <p className="project-map-orchestration-status is-error" role="status">
                    {t(`projectMap.orchestration.failure.${activeDraftState.reason}`)}
                  </p>
                ) : null}
              </section>
              <div className="project-map-node-actions">
                {canDrill ? (
                  <button type="button" onClick={onDrill}>
                    {t("projectMap.drillIn")}
                  </button>
                ) : null}
                {onOpenIntentCanvasArchitect ? (
                  <button type="button" onClick={onOpenIntentCanvasArchitect}>
                    <Network aria-hidden />
                    {t("projectMap.openIntentCanvasArchitect")}
                  </button>
                ) : null}
                {onOpenIntentCanvasSpotlight ? (
                  <button type="button" onClick={onOpenIntentCanvasSpotlight}>
                    <Search aria-hidden />
                    {t("projectMap.openIntentCanvasSpotlight")}
                  </button>
                ) : null}
                {onOpenIntentCanvasForFile && primaryFileSource?.path ? (
                  <button type="button" onClick={() => onOpenIntentCanvasForFile(primaryFileSource.path!)}>
                    <Folder aria-hidden />
                    {t("projectMap.openIntentCanvasForFile")}
                  </button>
                ) : null}
                <button className="is-primary" type="button" onClick={onCreateOrchestrationTask}>
                  <ListChecks aria-hidden />
                  {t("projectMap.orchestration.createTask")}
                </button>
                <button type="button" onClick={onCompleteNode}>{t("projectMap.completeNode")}</button>
                <button type="button" onClick={onCalibrateNode}>{t("projectMap.calibrateNode")}</button>
                {onDeleteNode ? (
                  <button className="is-danger" type="button" onClick={onDeleteNode}>
                    <Trash2 aria-hidden />
                    {t("projectMap.deleteNode")}
                  </button>
                ) : null}
              </div>
            </section>
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

export function InspectorList({
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

export function ProjectMapSettingsPanel({
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

export function DeleteNodeConfirmDialog({
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

export function GenerationConfirmationDialog({
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
