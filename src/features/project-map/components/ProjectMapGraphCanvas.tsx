import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode, RefObject, WheelEvent } from "react";
import { useTranslation } from "react-i18next";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ArrowDownRightFromCircle from "lucide-react/dist/esm/icons/arrow-down-right-from-circle";
import ArrowUpLeftFromCircle from "lucide-react/dist/esm/icons/arrow-up-left-from-circle";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in";
import ZoomOut from "lucide-react/dist/esm/icons/zoom-out";

import { cn } from "../../../lib/utils";
import {
  PROJECT_MAP_GRAPH_HEIGHT,
  PROJECT_MAP_GRAPH_WIDTH,
  type ProjectMapGraphNodePosition,
  type ProjectMapInteractiveLayout,
  type ProjectMapMiniMapProjection,
} from "../utils/interactiveLayout";
import type { ProjectMapPathResult } from "../utils/navigation";
import type { ProjectMapIndexedRelation } from "../utils/relationIndex";
import {
  getDescendantStats,
  MINI_MAP_SIZE,
  PROJECT_MAP_QUICK_FILTERS,
  ZOOM_STEP,
  type GraphViewSnapshot,
  type GraphViewport,
} from "./projectMapPanelModel";
import { translateProjectMapNodeKind } from "../utils/display";
import type {
  ProjectMapHighlightProjection,
  ProjectMapLayoutPreset,
  ProjectMapLens,
  ProjectMapNode,
  ProjectMapQuickFilterId,
} from "../types";

type ProjectMapRelationRenderEdge = {
  indexedRelation: ProjectMapIndexedRelation;
  source: ProjectMapGraphNodePosition;
  target: ProjectMapGraphNodePosition;
};

type ProjectMapGraphCanvasProps = {
  activeQuickFilters: Set<ProjectMapQuickFilterId>;
  backToPreviousLabel: string;
  canvasRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  focusNodeId: string | null;
  hasBackToParentFallback: boolean;
  highlightProjection: ProjectMapHighlightProjection;
  isCanvasControlsCollapsed: boolean;
  lensIndex: Map<string, ProjectMapLens>;
  miniMapProjection: ProjectMapMiniMapProjection | null;
  neighborNodeIds: Set<string>;
  nodeIndex: Map<string, ProjectMapNode>;
  pathResult: ProjectMapPathResult;
  previousViewSnapshot: GraphViewSnapshot | null;
  relationFilteredNodeIds: Set<string>;
  relationRenderEdges: ProjectMapRelationRenderEdge[];
  renderGraphLayout: ProjectMapInteractiveLayout;
  rootNode: ProjectMapNode | null;
  selectedGraphNodeIds: Set<string>;
  selectedNode: ProjectMapNode | null;
  selectedRelationId: string | null;
  selectedRelationNodeIds: Set<string>;
  viewport: GraphViewport;
  onAutoLayout: () => void;
  onBackToPreviousView: () => void;
  onCanvasControlsToggle: () => void;
  onCanvasPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerEnd: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onLayoutPresetChange: (preset: ProjectMapLayoutPreset) => void;
  onMiniMapClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onNodeClick: (event: MouseEvent<HTMLDivElement>, node: ProjectMapNode) => void;
  onNodeDoubleClick: (node: ProjectMapNode) => void;
  onNodeDrillClick: (event: MouseEvent<HTMLButtonElement>, node: ProjectMapNode) => void;
  onNodeDrillUpClick: (event: MouseEvent<HTMLButtonElement>, node: ProjectMapNode) => void;
  onNodeKeyDown: (event: KeyboardEvent<HTMLDivElement>, node: ProjectMapNode) => void;
  onNodeMouseEnter: (nodeId: string) => void;
  onNodeMouseLeave: () => void;
  onNodePointerDown: (event: PointerEvent<HTMLDivElement>, node: ProjectMapNode) => void;
  onNodePointerEnd: (event: PointerEvent<HTMLDivElement>) => void;
  onNodePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onQuickFilterToggle: (filterId: ProjectMapQuickFilterId) => void;
  onResetLayout: () => void;
  onResetView: () => void;
  onZoomChange: (zoom: number) => void;
  layoutPreset: ProjectMapLayoutPreset;
};

export function ProjectMapGraphCanvas({
  activeQuickFilters,
  backToPreviousLabel,
  canvasRef,
  children,
  focusNodeId,
  hasBackToParentFallback,
  highlightProjection,
  isCanvasControlsCollapsed,
  lensIndex,
  miniMapProjection,
  neighborNodeIds,
  nodeIndex,
  pathResult,
  previousViewSnapshot,
  relationFilteredNodeIds,
  relationRenderEdges,
  renderGraphLayout,
  rootNode,
  selectedGraphNodeIds,
  selectedNode,
  selectedRelationId,
  selectedRelationNodeIds,
  viewport,
  onAutoLayout,
  onBackToPreviousView,
  onCanvasControlsToggle,
  onCanvasPointerDown,
  onCanvasPointerEnd,
  onCanvasPointerMove,
  onCanvasWheel,
  onLayoutPresetChange,
  onMiniMapClick,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDrillClick,
  onNodeDrillUpClick,
  onNodeKeyDown,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodePointerDown,
  onNodePointerEnd,
  onNodePointerMove,
  onQuickFilterToggle,
  onResetLayout,
  onResetView,
  onZoomChange,
  layoutPreset,
}: ProjectMapGraphCanvasProps) {
  const { t } = useTranslation();

  return (
    <div
      ref={canvasRef}
      className="project-map-graph-canvas"
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerEnd}
      onPointerCancel={onCanvasPointerEnd}
      onWheel={onCanvasWheel}
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
          onClick={onCanvasControlsToggle}
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
              onClick={() => onZoomChange(viewport.zoom - ZOOM_STEP)}
              aria-label={t("projectMap.zoomOut")}
            >
              <ZoomOut aria-hidden />
            </button>
            <button type="button" onClick={onResetView}>
              {t("projectMap.resetView")}
            </button>
            <button type="button" onClick={onAutoLayout}>
              {t("projectMap.autoLayout")}
            </button>
            <button type="button" onClick={onResetLayout}>
              {t("projectMap.resetLayout")}
            </button>
            <label className="project-map-layout-preset">
              <span>{t("projectMap.layoutPreset")}</span>
              <select
                value={layoutPreset}
                aria-label={t("projectMap.layoutPreset")}
                onChange={(event) =>
                  onLayoutPresetChange(event.currentTarget.value as ProjectMapLayoutPreset)
                }
              >
                <option value="radial">{t("projectMap.layoutPresetRadial")}</option>
                <option value="tree">{t("projectMap.layoutPresetTree")}</option>
                <option value="force">{t("projectMap.layoutPresetForce")}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => onZoomChange(viewport.zoom + ZOOM_STEP)}
              aria-label={t("projectMap.zoomIn")}
            >
              <ZoomIn aria-hidden />
            </button>
            {previousViewSnapshot || hasBackToParentFallback ? (
              <button type="button" onClick={onBackToPreviousView}>
                <ArrowLeft aria-hidden />
                {backToPreviousLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        className="project-map-quick-filters"
        role="toolbar"
        aria-label={t("projectMap.quickFilters.title")}
      >
        {PROJECT_MAP_QUICK_FILTERS.map((filterId) => {
          const isActive = activeQuickFilters.has(filterId);
          return (
            <button
              key={filterId}
              type="button"
              className={cn("project-map-quick-filter-chip", isActive && "is-active")}
              aria-pressed={isActive}
              onClick={() => onQuickFilterToggle(filterId)}
            >
              {t(`projectMap.quickFilters.${filterId}`)}
            </button>
          );
        })}
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
            const relationState = highlightProjection.relationStates.get(edge.id);
            const isPathEdge = pathResult.edgeKeys.has(`${edge.source.id}::${edge.target.id}`);
            const isFilterEdge = highlightProjection.filterRelationIds.has(edge.id);
            const isAdvisorEdge = highlightProjection.advisorRelationIds.has(edge.id);
            return (
              <line
                key={edge.id}
                x1={edge.source.x}
                y1={edge.source.y}
                x2={edge.target.x}
                y2={edge.target.y}
                className={cn(
                  "project-map-edge",
                  isFocused && "is-focused",
                  isPathEdge && "is-path-edge",
                  isFilterEdge && "is-filter-edge",
                  isAdvisorEdge && "is-advisor-edge",
                  relationState?.primary && `is-highlight-${relationState.primary}`,
                )}
              />
            );
          })}
          {relationRenderEdges.map(({ indexedRelation, source, target }) => {
            const isSelectedRelation = selectedRelationId === indexedRelation.relation.id;
            const relationState = highlightProjection.relationStates.get(indexedRelation.relation.id);
            return (
              <line
                key={`relation:${indexedRelation.relation.id}:${source.id}:${target.id}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={cn(
                  "project-map-edge",
                  "is-relation-edge",
                  indexedRelation.degraded && "is-degraded",
                  isSelectedRelation && "is-selected-relation",
                  highlightProjection.pathRelationIds.has(indexedRelation.relation.id) && "is-path-edge",
                  highlightProjection.filterRelationIds.has(indexedRelation.relation.id) && "is-filter-edge",
                  highlightProjection.advisorRelationIds.has(indexedRelation.relation.id) && "is-advisor-edge",
                  relationState?.primary && `is-highlight-${relationState.primary}`,
                )}
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
          const nodeHighlightState = highlightProjection.nodeStates.get(node.id);
          const isImpactChanged = highlightProjection.activityChangedNodeIds.has(node.id);
          const isImpactAffected = highlightProjection.activityAffectedNodeIds.has(node.id);
          const isSearchMatch = highlightProjection.searchNodeIds.has(node.id);
          const isPathNode = highlightProjection.pathNodeIds.has(node.id);
          const isQuickFilterMatch = highlightProjection.filterNodeIds.has(node.id);
          const isAdvisorMatch = highlightProjection.advisorNodeIds.has(node.id);
          const isRelationFilteredNode = relationFilteredNodeIds.has(node.id);
          const isSelectedRelationNode = selectedRelationNodeIds.has(node.id);
          const isNavigationHighlighted =
            isSearchMatch ||
            isPathNode ||
            isImpactChanged ||
            isImpactAffected ||
            isQuickFilterMatch ||
            isAdvisorMatch ||
            isRelationFilteredNode ||
            isSelectedRelationNode;
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
                isImpactChanged && "is-impact-changed",
                isImpactAffected && "is-impact-affected",
                isSearchMatch && "is-search-match",
                isPathNode && "is-path-node",
                isQuickFilterMatch && "is-filter-match",
                isAdvisorMatch && "is-advisor-match",
                nodeHighlightState?.primary && `is-highlight-${nodeHighlightState.primary}`,
                isRelationFilteredNode && "is-relation-filtered-node",
                isSelectedRelationNode && "is-selected-relation-node",
                isSelected && "is-selected",
                isGroupSelected && "is-group-selected",
                position.pinned && "is-pinned",
                !isFocused && !isNavigationHighlighted && "is-dimmed",
              )}
              role="button"
              tabIndex={0}
              style={{ left: position.x, top: position.y }}
              onPointerDown={(event) => onNodePointerDown(event, node)}
              onPointerMove={onNodePointerMove}
              onPointerUp={onNodePointerEnd}
              onPointerCancel={onNodePointerEnd}
              onClick={(event) => onNodeClick(event, node)}
              onKeyDown={(event) => onNodeKeyDown(event, node)}
              onDoubleClick={() => onNodeDoubleClick(node)}
              onMouseEnter={() => onNodeMouseEnter(node.id)}
              onMouseLeave={onNodeMouseLeave}
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
                {isImpactChanged || isImpactAffected ? (
                  <>
                    {" · "}
                    {isImpactChanged
                      ? t("projectMap.impact.changed", { defaultValue: "Changed" })
                      : t("projectMap.impact.affected", { defaultValue: "Affected" })}
                  </>
                ) : null}
                {isSearchMatch || isPathNode || isSelectedRelationNode ? (
                  <>
                    {" · "}
                    {isSelectedRelationNode
                      ? t("projectMap.relations.badge")
                      : isPathNode
                        ? t("projectMap.navigation.path.badge")
                        : t("projectMap.navigation.search.badge")}
                  </>
                ) : null}
                {isQuickFilterMatch ? (
                  <>
                    {" · "}
                    {t("projectMap.quickFilters.badge")}
                  </>
                ) : null}
                {isAdvisorMatch ? (
                  <>
                    {" · "}
                    {t("projectMap.advisor.badge")}
                  </>
                ) : null}
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
                    onClick={(event) => onNodeDrillUpClick(event, node)}
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
                    onClick={(event) => onNodeDrillClick(event, node)}
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
          onClick={onMiniMapClick}
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
      {children}
    </div>
  );
}
