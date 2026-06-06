import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type IntentCanvasMode = "architect" | "spotlight" | "file";
export type IntentCanvasOpenTarget = "new" | "append";

export type IntentCanvasWorkspaceRef = {
  id: string;
  name: string | null;
};

export type IntentCanvasOpenSource = {
  projectMapNodeId?: string | null;
  nodeTitle?: string | null;
  nodeKind?: string | null;
  summary?: string | null;
  filePath?: string | null;
};

export type IntentCanvasOpenRequest = {
  requestId: number;
  mode: IntentCanvasMode;
  target?: IntentCanvasOpenTarget | null;
  canvasId?: string | null;
  title?: string | null;
  summary?: string | null;
  seedSemanticGraphs?: CanvasSemanticGraph[];
  source?: IntentCanvasOpenSource | null;
};

export type IntentCanvasElementDigest = {
  id: string;
  type: string;
  label: string | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
};

export type IntentCanvasRelationDigest = {
  id: string;
  type: "arrow" | "line";
  label: string | null;
  startBindingId: string | null;
  endBindingId: string | null;
};

export type IntentCanvasAiContext = {
  elementDigest: IntentCanvasElementDigest[];
  relationDigest: IntentCanvasRelationDigest[];
  lastContextSnapshot: string;
};

export type SourceRange = {
  startLine: number;
  startColumn?: number | null;
  endLine?: number | null;
  endColumn?: number | null;
};

export type CanvasCodeSymbolKind =
  | "function"
  | "method"
  | "class"
  | "module"
  | "unknown";

export type CanvasSourceAnchor =
  | {
      kind: "code-symbol";
      workspaceId: string;
      filePath: string;
      symbolName: string;
      symbolKind: CanvasCodeSymbolKind;
      scanRunId?: string | null;
      symbolId?: string | null;
      selectionRange?: SourceRange | null;
      definitionRange?: SourceRange | null;
      resolvedBy?: "relationship-symbols" | "editor-selection" | "fallback-text" | string;
    }
  | {
      kind: "relationship-node";
      workspaceId: string;
      scanRunId: string;
      nodeId: string;
      nodeKind: string;
      filePath?: string | null;
      symbolId?: string | null;
    }
  | {
      kind: "relationship-edge";
      workspaceId: string;
      scanRunId: string;
      edgeId: string;
      relationKind: string;
      sourceNodeId: string;
      targetNodeId: string;
      evidenceIds: string[];
    };

export type CanvasSemanticNodeType = "file" | "symbol" | "module" | "group" | "endpoint" | "unknown";

export type CanvasSemanticNode = {
  id: string;
  label: string;
  kind: CanvasSemanticNodeType;
  sourceAnchor?: CanvasSourceAnchor | null;
  evidenceIds?: string[];
  summary?: string | null;
  stale?: boolean;
  unresolved?: boolean;
};

export type CanvasSemanticEdgeDirection = "out" | "in" | "both" | "undirected";

export type CanvasSemanticEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationKind: string;
  direction?: CanvasSemanticEdgeDirection;
  sourceAnchor?: CanvasSourceAnchor | null;
  label?: string | null;
  evidenceIds?: string[];
};

export type CanvasSemanticGraph = {
  graphId: string;
  createdAt: string;
  sourceSnapshot?: {
    kind: "project-map-relations";
    scanRunId: string;
    snapshotVersion?: string | null;
  };
  nodes: CanvasSemanticNode[];
  edges: CanvasSemanticEdge[];
  importOptions?: {
    depth?: number | null;
    direction?: "callers" | "callees" | "both" | "neighborhood";
    centerNodeId?: string | null;
    maxNodes?: number | null;
    maxEdges?: number | null;
    omittedNodes?: number | null;
    omittedEdges?: number | null;
  };
};

export type CanvasAiAnnotation = {
  id: string;
  targetGraphId: string;
  targetNodeIds?: string[];
  targetEdgeIds?: string[];
  annotationKind: "summary" | "risk" | "group" | "next-step" | string;
  content: string;
  createdAt: string;
};

export type IntentCanvasScene = {
  elements: readonly OrderedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};

export type IntentCanvasLinks = {
  projectMapNodeIds: string[];
  filePaths: string[];
  threadIds: string[];
};

export type IntentCanvasDocument = {
  version: 1;
  id: string;
  title: string;
  kind: "intent-canvas";
  createdAt: string;
  updatedAt: string;
  workspace: IntentCanvasWorkspaceRef;
  mode: IntentCanvasMode;
  summary: string;
  links: IntentCanvasLinks;
  scene: IntentCanvasScene;
  aiContext: IntentCanvasAiContext;
  semanticGraphs: CanvasSemanticGraph[];
  aiAnnotations: CanvasAiAnnotation[];
};

export type IntentCanvasIndexEntry = {
  id: string;
  title: string;
  mode: IntentCanvasMode;
  summary: string;
  updatedAt: string;
  createdAt: string;
  path: string;
  linkedFileCount: number;
  linkedProjectMapNodeCount: number;
  linkedThreadCount: number;
  elementCount: number;
};

export type IntentCanvasIndexFile = {
  version: 1;
  canvases: IntentCanvasIndexEntry[];
};

export type IntentCanvasLoadResult<T> = {
  value: T;
  warnings: string[];
};
