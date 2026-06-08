// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntentCanvasManager } from "./IntentCanvasManager";
import type { IntentCanvasDocument, IntentCanvasOpenRequest } from "../types";
import {
  createIntentCanvasDocument,
  loadIntentCanvasIndex,
  saveIntentCanvasDocument,
} from "../services/intentCanvasStorage";
import { loadProjectMapRelationshipImportSourceState } from "../services/relationshipImportQueries";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en", resolvedLanguage: "en" },
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) {
        return key;
      }
      return Object.entries(params).reduce(
        (value, [name, replacement]) => value.replace(`{{${name}}}`, String(replacement)),
        key,
      );
    },
  }),
}));

vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: () => null,
}));

vi.mock("../services/intentCanvasStorage", () => ({
  appendIntentCanvasDocumentFromRequest: vi.fn(),
  cloneIntentCanvasDocument: vi.fn(),
  createIntentCanvasDocument: vi.fn(),
  deleteIntentCanvasDocument: vi.fn(),
  deleteIntentCanvasDocuments: vi.fn(),
  loadIntentCanvasDocument: vi.fn(),
  loadIntentCanvasIndex: vi.fn(),
  saveIntentCanvasDocument: vi.fn(),
}));

vi.mock("../services/relationshipImportQueries", () => ({
  isProjectMapRelationshipScanFresh: vi.fn((input: {
    importedScanRunId: string;
    latestScanRunId?: string | null;
  }) => Boolean(input.latestScanRunId) && input.importedScanRunId === input.latestScanRunId),
  loadProjectMapRelationshipImportSourceState: vi.fn(),
}));

function createCanvasDocument(): IntentCanvasDocument {
  return {
    version: 1,
    id: "canvas-one",
    title: "Canvas One",
    kind: "intent-canvas",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    workspace: { id: "workspace-1", name: "Workspace" },
    mode: "architect",
    summary: "",
    links: {
      projectMapNodeIds: [],
      filePaths: [],
      threadIds: [],
    },
    scene: {
      elements: [],
      appState: {},
      files: {},
    },
    aiContext: {
      elementDigest: [],
      relationDigest: [],
      lastContextSnapshot: "",
    },
    semanticGraphs: [],
    aiAnnotations: [],
  };
}

describe("IntentCanvasManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadIntentCanvasIndex).mockResolvedValue({ value: [], warnings: [] });
    vi.mocked(loadProjectMapRelationshipImportSourceState).mockResolvedValue({
      exists: true,
      scan: { scanRunId: "scan-current", generatedAt: "2026-06-06T00:00:00.000Z" },
      fileNodeIds: new Set<string>(),
      relationEdgeIds: new Set<string>(),
    });
  });

  it("consumes an open request once even when the editor state rerenders", async () => {
    const document = createCanvasDocument();
    const request: IntentCanvasOpenRequest = {
      requestId: 1,
      mode: "architect",
      target: "new",
      title: "Imported graph",
    };
    const onOpenRequestConsumed = vi.fn();
    vi.mocked(createIntentCanvasDocument).mockReturnValue(document);
    vi.mocked(saveIntentCanvasDocument).mockResolvedValue(document);

    const view = render(
      <IntentCanvasManager
        activeWorkspace={{ id: "workspace-1", name: "Workspace" } as any}
        activeThreadId={null}
        openRequest={request}
        onOpenRequestConsumed={onOpenRequestConsumed}
      />,
    );

    await waitFor(() => {
      expect(saveIntentCanvasDocument).toHaveBeenCalledTimes(1);
    });
    expect(onOpenRequestConsumed).toHaveBeenCalledWith(1);

    view.rerender(
      <IntentCanvasManager
        activeWorkspace={{ id: "workspace-1", name: "Workspace" } as any}
        activeThreadId={null}
        openRequest={request}
        onOpenRequestConsumed={onOpenRequestConsumed}
      />,
    );

    await waitFor(() => {
      expect(saveIntentCanvasDocument).toHaveBeenCalledTimes(1);
    });
  });

  it("shows imported graph source state and opens evidence-backed source locations", async () => {
    const document = createCanvasDocument();
    document.semanticGraphs = [
      {
        graphId: "graph-1",
        createdAt: "2026-06-06T00:00:00.000Z",
        sourceSnapshot: {
          kind: "project-map-relations",
          scanRunId: "scan-old",
          snapshotVersion: null,
        },
        nodes: [
          {
            id: "file-ok",
            label: "UserService.java",
            kind: "file",
            sourceAnchor: {
              kind: "relationship-node",
              workspaceId: "workspace-1",
              scanRunId: "scan-old",
              nodeId: "file-ok",
              nodeKind: "service",
              filePath: "src/main/java/UserService.java",
            },
          },
          {
            id: "file-missing",
            label: "MissingService.java",
            kind: "file",
            sourceAnchor: {
              kind: "relationship-node",
              workspaceId: "workspace-1",
              scanRunId: "scan-old",
              nodeId: "file-missing",
              nodeKind: "service",
              filePath: "src/main/java/MissingService.java",
            },
          },
        ],
        edges: [
          {
            id: "edge-ok",
            sourceNodeId: "file-ok",
            targetNodeId: "file-missing",
            relationKind: "calls",
            label: "toUserResponse",
            sourceAnchor: {
              kind: "relationship-edge",
              workspaceId: "workspace-1",
              scanRunId: "scan-old",
              edgeId: "edge-ok",
              relationKind: "calls",
              sourceNodeId: "file-ok",
              targetNodeId: "file-missing",
              evidenceIds: ["evidence-1"],
            },
            evidenceIds: ["evidence-1"],
            evidenceRefs: [
              {
                id: "evidence-1",
                path: "src/main/java/UserService.java",
                line: 42,
                label: "src/main/java/UserService.java:42",
              },
            ],
          },
        ],
      },
    ];
    const request: IntentCanvasOpenRequest = {
      requestId: 2,
      mode: "architect",
      target: "new",
      title: "Imported graph",
    };
    const onOpenSourceFile = vi.fn();
    vi.mocked(createIntentCanvasDocument).mockReturnValue(document);
    vi.mocked(saveIntentCanvasDocument).mockResolvedValue(document);
    vi.mocked(loadProjectMapRelationshipImportSourceState).mockResolvedValue({
      exists: true,
      scan: { scanRunId: "scan-current", generatedAt: "2026-06-06T00:00:00.000Z" },
      fileNodeIds: new Set<string>(["file-ok"]),
      relationEdgeIds: new Set<string>(["edge-ok"]),
    });

    render(
      <IntentCanvasManager
        activeWorkspace={{ id: "workspace-1", name: "Workspace" } as any}
        activeThreadId={null}
        openRequest={request}
        onOpenSourceFile={onOpenSourceFile}
      />,
    );

    await screen.findByText("intentCanvas.editor.sourceTraceability");
    await screen.findByText("intentCanvas.editor.sourceStaleNotice");
    expect(screen.getByText("intentCanvas.editor.sourceUnresolvedNotice")).toBeTruthy();

    fireEvent.click(screen.getByText("toUserResponse"));

    expect(onOpenSourceFile).toHaveBeenCalledWith(
      "src/main/java/UserService.java",
      { line: 42, column: 1 },
    );
  });
});
