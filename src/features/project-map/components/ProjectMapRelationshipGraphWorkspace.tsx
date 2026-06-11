import type { CSSProperties, Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";

import { cn } from "../../../lib/utils";
import { ProjectMapRelationshipGraphRail } from "./ProjectMapRelationshipGraphRail";
import {
  PROJECT_MAP_RELATIONSHIP_GRAPH_HEIGHT,
  PROJECT_MAP_RELATIONSHIP_GRAPH_WIDTH,
  type ProjectMapRelationshipGraphProjection,
} from "./projectMapRelationshipGraphProjection";
import {
  getProjectMapRelationshipCallCandidate,
  getProjectMapRelationshipRoleColor,
  isProjectMapRelationshipNoiseFile,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import type {
  ProjectMapRelationshipFileDirectionCount,
  ProjectMapRelationshipTopFileRoleGroup,
} from "../hooks/useProjectMapRelationshipFileProjection";
import type { ProjectMapRelationshipRelationGroup } from "../hooks/useProjectMapRelationshipGraphProjection";
import type {
  IntentCanvasCodeSelectionAnchor,
  IntentCanvasIndexEntry,
} from "../../intent-canvas/types";
import type {
  ProjectMapFileRelation,
  ProjectMapRelationshipSymbol,
  ProjectMapScannedFile,
} from "../types";

type ProjectMapRelationshipGraphWorkspaceProps = {
  activeCodeSelectionAnchor: IntentCanvasCodeSelectionAnchor | null;
  beginRelationshipGraphPaneResize: (pane: "rail" | "inspector", event: ReactPointerEvent<HTMLDivElement>) => void;
  collapsedRelationshipTopModuleGroups: ReadonlySet<string>;
  collapsedRelationshipTopRoleGroups: ReadonlySet<string>;
  expandedRelationshipTopFileGroups: ReadonlySet<string>;
  expandedRelationshipTopModuleGroups: ReadonlySet<string>;
  expandedRelationshipTopRoleGroups: ReadonlySet<string>;
  focusProjectMapRelationshipRelation: (direction: "incoming" | "outgoing" | "total") => void;
  handleImportRelationshipEdgeToCanvas: (targetValue: string) => void | Promise<void>;
  handleImportRelationshipNeighborhoodToCanvas: (targetValue: string) => void | Promise<void>;
  handleRelationshipGraphPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleRelationshipGraphPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleRelationshipGraphPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  inspectedRelationshipFile: ProjectMapScannedFile | null;
  inspectedRelationshipRelations: ProjectMapFileRelation[];
  isRelationshipCanvasImporting: boolean;
  isRelationshipGraphInspectorCollapsed: boolean;
  isRelationshipGraphPanning: boolean;
  isRelationshipGraphRailCollapsed: boolean;
  onOpenEvidenceFile?: (path: string, location?: { line: number; column: number }) => void;
  onOpenIntentCanvasFromRelationship?: unknown;
  openProjectMapRelationshipFileWithEvidence: (input: {
    filePath: string | null | undefined;
    preferredLine?: number | null;
    evidencePath?: string | null;
    evidenceLine?: number | null;
  }) => void;
  openProjectMapRelationshipPath: (path: string | null | undefined, line?: number | null) => void;
  relationshipCanvasImportError: string | null;
  relationshipCanvasImportTarget: string;
  relationshipCanvasTargetEntries: IntentCanvasIndexEntry[];
  relationshipCanvasTargetLoadError: string | null;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardDirectionCountByFile: ReadonlyMap<string, ProjectMapRelationshipFileDirectionCount>;
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  relationshipDashboardFilteredFiles: ProjectMapScannedFile[];
  relationshipDashboardGraph: ProjectMapRelationshipGraphProjection | null;
  relationshipDashboardRelationCountByFile: ReadonlyMap<string, number>;
  relationshipDashboardTopFileGroups: ProjectMapRelationshipTopFileRoleGroup[];
  relationshipDashboardTypeFilter: string;
  relationshipDashboardVisibleFileTotal: number;
  relationshipGraphCanvasRef: RefObject<HTMLDivElement | null>;
  relationshipGraphDashboardRef: RefObject<HTMLDivElement | null>;
  relationshipGraphInspectorWidth: number;
  relationshipGraphPan: { x: number; y: number };
  relationshipGraphRailWidth: number;
  relationshipGraphScale: number;
  relationshipGraphZoom: number;
  selectedRelationshipFile: ProjectMapScannedFile | null;
  selectedRelationshipRelation: ProjectMapFileRelation | null;
  selectedRelationshipRelationGroups: ProjectMapRelationshipRelationGroup[];
  setInspectedRelationshipFileId: (value: string | null) => void;
  setRelationshipCanvasImportTarget: Dispatch<SetStateAction<string>>;
  setRelationshipDashboardTypeFilter: (value: string) => void;
  setRelationshipGraphExpandedSide: Dispatch<SetStateAction<"incoming" | "outgoing" | null>>;
  setSelectedRelationshipFileId: (value: string | null) => void;
  setSelectedRelationshipRelationId: (value: string | null) => void;
  setShowRelationshipNoiseFiles: Dispatch<SetStateAction<boolean>>;
  toggleRelationshipTopFileGroup: (groupId: string) => void;
  toggleRelationshipTopModuleGroup: (groupId: string, isExpanded: boolean) => void;
  toggleRelationshipTopRoleGroup: (groupId: string, isExpanded: boolean) => void;
};

const PROJECT_MAP_RELATION_FILTER_ALL = "all";
const PROJECT_MAP_RELATIONSHIP_NEW_CANVAS_TARGET = "__new_canvas__";

function formatActiveCodeSelectionLineLabel(anchor: IntentCanvasCodeSelectionAnchor): string {
  return anchor.startLine === anchor.endLine
    ? `L${anchor.startLine}`
    : `L${anchor.startLine}-L${anchor.endLine}`;
}

function getActiveCodeSelectionFileName(anchor: IntentCanvasCodeSelectionAnchor): string {
  return anchor.filePath.split(/\//).filter(Boolean).pop() ?? anchor.filePath;
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

export function ProjectMapRelationshipGraphWorkspace({
  activeCodeSelectionAnchor,
  beginRelationshipGraphPaneResize,
  collapsedRelationshipTopModuleGroups,
  collapsedRelationshipTopRoleGroups,
  expandedRelationshipTopFileGroups,
  expandedRelationshipTopModuleGroups,
  expandedRelationshipTopRoleGroups,
  focusProjectMapRelationshipRelation,
  handleImportRelationshipEdgeToCanvas,
  handleImportRelationshipNeighborhoodToCanvas,
  handleRelationshipGraphPointerDown,
  handleRelationshipGraphPointerEnd,
  handleRelationshipGraphPointerMove,
  inspectedRelationshipFile,
  inspectedRelationshipRelations,
  isRelationshipCanvasImporting,
  isRelationshipGraphInspectorCollapsed,
  isRelationshipGraphPanning,
  isRelationshipGraphRailCollapsed,
  onOpenEvidenceFile,
  onOpenIntentCanvasFromRelationship,
  openProjectMapRelationshipFileWithEvidence,
  openProjectMapRelationshipPath,
  relationshipCanvasImportError,
  relationshipCanvasImportTarget,
  relationshipCanvasTargetEntries,
  relationshipCanvasTargetLoadError,
  relationshipDashboardData,
  relationshipDashboardDirectionCountByFile,
  relationshipDashboardFileIndex,
  relationshipDashboardFilteredFiles,
  relationshipDashboardGraph,
  relationshipDashboardRelationCountByFile,
  relationshipDashboardTopFileGroups,
  relationshipDashboardTypeFilter,
  relationshipDashboardVisibleFileTotal,
  relationshipGraphCanvasRef,
  relationshipGraphDashboardRef,
  relationshipGraphInspectorWidth,
  relationshipGraphPan,
  relationshipGraphRailWidth,
  relationshipGraphScale,
  relationshipGraphZoom,
  selectedRelationshipFile,
  selectedRelationshipRelation,
  selectedRelationshipRelationGroups,
  setInspectedRelationshipFileId,
  setRelationshipCanvasImportTarget,
  setRelationshipDashboardTypeFilter,
  setRelationshipGraphExpandedSide,
  setSelectedRelationshipFileId,
  setSelectedRelationshipRelationId,
  setShowRelationshipNoiseFiles,
  toggleRelationshipTopFileGroup,
  toggleRelationshipTopModuleGroup,
  toggleRelationshipTopRoleGroup,
}: ProjectMapRelationshipGraphWorkspaceProps) {
  const { t } = useTranslation();

  return (
                          <div
                            ref={relationshipGraphDashboardRef}
                            className={cn(
                              "project-map-relationship-graph-dashboard",
                              isRelationshipGraphRailCollapsed && "is-rail-collapsed",
                              isRelationshipGraphInspectorCollapsed && "is-inspector-collapsed",
                            )}
                            style={{
                              "--relationship-graph-rail-width": `${relationshipGraphRailWidth}px`,
                              "--relationship-graph-inspector-width": `${relationshipGraphInspectorWidth}px`,
                            } as CSSProperties}
                          >
                          {!isRelationshipGraphRailCollapsed ? (
                            <ProjectMapRelationshipGraphRail
                              collapsedRelationshipTopModuleGroups={collapsedRelationshipTopModuleGroups}
                              collapsedRelationshipTopRoleGroups={collapsedRelationshipTopRoleGroups}
                              expandedRelationshipTopFileGroups={expandedRelationshipTopFileGroups}
                              expandedRelationshipTopModuleGroups={expandedRelationshipTopModuleGroups}
                              expandedRelationshipTopRoleGroups={expandedRelationshipTopRoleGroups}
                              relationshipDashboardData={relationshipDashboardData}
                              relationshipDashboardDirectionCountByFile={relationshipDashboardDirectionCountByFile}
                              relationshipDashboardFilteredFiles={relationshipDashboardFilteredFiles}
                              relationshipDashboardTopFileGroups={relationshipDashboardTopFileGroups}
                              relationshipDashboardVisibleFileTotal={relationshipDashboardVisibleFileTotal}
                              selectedRelationshipFile={selectedRelationshipFile}
                              setInspectedRelationshipFileId={setInspectedRelationshipFileId}
                              setSelectedRelationshipFileId={setSelectedRelationshipFileId}
                              setSelectedRelationshipRelationId={setSelectedRelationshipRelationId}
                              toggleRelationshipTopFileGroup={toggleRelationshipTopFileGroup}
                              toggleRelationshipTopModuleGroup={toggleRelationshipTopModuleGroup}
                              toggleRelationshipTopRoleGroup={toggleRelationshipTopRoleGroup}
                            />
                          ) : null}
                          {!isRelationshipGraphRailCollapsed ? (
                            <div
                              className="project-map-relationship-graph-resizer is-rail"
                              role="separator"
                              aria-label={t("projectMap.relationship.graphResizeFiles")}
                              onPointerDown={(event) => beginRelationshipGraphPaneResize("rail", event)}
                            />
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
                            <div
                              className="project-map-relationship-graph-resizer is-inspector"
                              role="separator"
                              aria-label={t("projectMap.relationship.graphResizeInspector")}
                              onPointerDown={(event) => beginRelationshipGraphPaneResize("inspector", event)}
                            />
                          ) : null}
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
  );
}
