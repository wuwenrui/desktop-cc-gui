import { useCallback } from "react";
import type {
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  MutableRefObject,
  PointerEvent,
  SetStateAction,
  WheelEvent,
} from "react";

import {
  PROJECT_MAP_GRAPH_HEIGHT,
  PROJECT_MAP_GRAPH_WIDTH,
  clampProjectMapGraphZoom,
  type ProjectMapGraphNodePosition,
  type ProjectMapInteractiveLayout,
  type ProjectMapMiniMapProjection,
} from "../utils/interactiveLayout";
import type { ProjectMapNode } from "../types";
import type { GraphNodeDragState, GraphViewport } from "../components/projectMapPanelModel";
import { ZOOM_STEP } from "../components/projectMapPanelModel";

type PersistGraphPositionsInput = {
  positions: ProjectMapGraphNodePosition[];
  preset?: never;
  pinnedNodeIds: Set<string>;
  updatedAt: string;
};

type UseProjectMapGraphInteractionHandlersInput = {
  miniMapProjection: ProjectMapMiniMapProjection | null;
  nodeDragRef: MutableRefObject<GraphNodeDragState | null>;
  panStartRef: MutableRefObject<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>;
  persistGraphPositions: (input: PersistGraphPositionsInput) => Promise<void>;
  renderGraphLayout: ProjectMapInteractiveLayout;
  selectedGraphNodeIds: Set<string>;
  setDragPreviewPositions: Dispatch<SetStateAction<Record<string, ProjectMapGraphNodePosition>>>;
  setSelectedGraphNodeIds: Dispatch<SetStateAction<Set<string>>>;
  setViewport: Dispatch<SetStateAction<GraphViewport>>;
  suppressNextNodeClickRef: MutableRefObject<boolean>;
  viewport: GraphViewport;
  onPrepareNodeSelection: (node: ProjectMapNode) => void;
  onSelectSingleNode: (node: ProjectMapNode) => void;
};

export function useProjectMapGraphInteractionHandlers({
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
  onPrepareNodeSelection,
  onSelectSingleNode,
}: UseProjectMapGraphInteractionHandlersInput) {
  const updateZoom = useCallback(
    (nextZoom: number) => {
      setViewport((current) => ({
        ...current,
        zoom: clampProjectMapGraphZoom(nextZoom),
      }));
    },
    [setViewport],
  );

  const handleCanvasPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
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
    },
    [panStartRef, viewport.pan.x, viewport.pan.y],
  );

  const updateNodeDragPreview = useCallback(
    (event: PointerEvent<HTMLDivElement>): boolean => {
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
      setDragPreviewPositions(Object.fromEntries(previewEntries));
      return true;
    },
    [nodeDragRef, setDragPreviewPositions, viewport.zoom],
  );

  const finishNodeDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>): boolean => {
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
    },
    [
      nodeDragRef,
      persistGraphPositions,
      setDragPreviewPositions,
      setSelectedGraphNodeIds,
      suppressNextNodeClickRef,
    ],
  );

  const handleCanvasPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
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
    },
    [panStartRef, setViewport, updateNodeDragPreview],
  );

  const handleCanvasPointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (finishNodeDrag(event)) {
        return;
      }

      if (panStartRef.current?.pointerId === event.pointerId) {
        panStartRef.current = null;
      }
    },
    [finishNodeDrag, panStartRef],
  );

  const handleCanvasWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
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
    },
    [setViewport],
  );

  const handleNodeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, node: ProjectMapNode) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onSelectSingleNode(node);
    },
    [onSelectSingleNode],
  );

  const handleNodePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, node: ProjectMapNode) => {
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }
      event.stopPropagation();
      const positionById = new Map(
        renderGraphLayout.positions.map((position) => [position.id, position]),
      );
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
      onPrepareNodeSelection(node);
      setSelectedGraphNodeIds(new Set(nodeIds));
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [
      nodeDragRef,
      onPrepareNodeSelection,
      renderGraphLayout.positions,
      selectedGraphNodeIds,
      setSelectedGraphNodeIds,
    ],
  );

  const handleNodePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (updateNodeDragPreview(event)) {
        event.stopPropagation();
      }
    },
    [updateNodeDragPreview],
  );

  const handleNodePointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (finishNodeDrag(event)) {
        event.stopPropagation();
      }
    },
    [finishNodeDrag],
  );

  const handleNodeClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, node: ProjectMapNode) => {
      if (suppressNextNodeClickRef.current) {
        suppressNextNodeClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.shiftKey || event.metaKey) {
        onPrepareNodeSelection(node);
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

      onSelectSingleNode(node);
    },
    [
      onPrepareNodeSelection,
      onSelectSingleNode,
      setSelectedGraphNodeIds,
      suppressNextNodeClickRef,
    ],
  );

  const handleMiniMapClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
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
    },
    [miniMapProjection, setViewport],
  );

  return {
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
  };
}
