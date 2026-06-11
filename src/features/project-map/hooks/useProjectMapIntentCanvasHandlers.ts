import { useCallback } from "react";

import type { IntentCanvasCodeSelectionAnchor } from "../../intent-canvas/types";
import type { IntentCanvasMode, IntentCanvasOpenRequest } from "../../intent-canvas";
import type { ProjectMapNode } from "../types";

type UseProjectMapIntentCanvasHandlersInput = {
  activeCodeSelectionAnchor: IntentCanvasCodeSelectionAnchor | null;
  selectedNode: ProjectMapNode | null;
  onDetailOpen: () => void;
  onOpenIntentCanvas?: (request: Omit<IntentCanvasOpenRequest, "requestId">) => void;
};

export function useProjectMapIntentCanvasHandlers({
  activeCodeSelectionAnchor,
  selectedNode,
  onDetailOpen,
  onOpenIntentCanvas,
}: UseProjectMapIntentCanvasHandlersInput) {
  const handleOpenIntentCanvas = useCallback(
    (mode: IntentCanvasMode) => {
      if (!selectedNode) {
        return;
      }
      onOpenIntentCanvas?.({
        mode,
        title:
          mode === "spotlight"
            ? `${selectedNode.title} Spotlight`
            : `${selectedNode.title} Intent Canvas`,
        summary: selectedNode.summary,
        source: {
          projectMapNodeId: selectedNode.id,
          nodeTitle: selectedNode.title,
          nodeKind: selectedNode.nodeKind,
          summary: selectedNode.summary,
        },
      });
      onDetailOpen();
    },
    [onDetailOpen, onOpenIntentCanvas, selectedNode],
  );

  const handleOpenIntentCanvasForFile = useCallback(
    (filePath: string) => {
      const trimmedPath = filePath.trim();
      if (!trimmedPath) {
        return;
      }
      onOpenIntentCanvas?.({
        mode: "file",
        title: `${trimmedPath} Intent Canvas`,
        summary: selectedNode?.summary ?? "",
        source: {
          projectMapNodeId: selectedNode?.id ?? null,
          nodeTitle: selectedNode?.title ?? null,
          nodeKind: selectedNode?.nodeKind ?? null,
          summary: selectedNode?.summary ?? null,
          filePath: trimmedPath,
        },
      });
      onDetailOpen();
    },
    [onDetailOpen, onOpenIntentCanvas, selectedNode],
  );

  const handleOpenIntentCanvasFromRelationship = useCallback(
    (request: Omit<IntentCanvasOpenRequest, "requestId">) => {
      const enrichedRequest =
        activeCodeSelectionAnchor && request.seedSemanticGraphs?.length
          ? {
              ...request,
              seedSemanticGraphs: request.seedSemanticGraphs.map((graph) => ({
                ...graph,
                sourceSelection: activeCodeSelectionAnchor,
              })),
            }
          : request;
      onOpenIntentCanvas?.(enrichedRequest);
      onDetailOpen();
    },
    [activeCodeSelectionAnchor, onDetailOpen, onOpenIntentCanvas],
  );

  return {
    handleOpenIntentCanvas,
    handleOpenIntentCanvasForFile,
    handleOpenIntentCanvasFromRelationship,
  };
}
