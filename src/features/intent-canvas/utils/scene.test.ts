import { describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
  convertToExcalidrawElements: (elements: Array<Record<string, unknown>>) =>
    elements.map((element, index) => ({
      id: `mock-element-${index}`,
      ...element,
    })),
}));

import {
  buildIntentCanvasAiContext,
  createInitialIntentCanvasScene,
  repairIntentCanvasGeneratedElements,
  sanitizeIntentCanvasScene,
} from "./scene";

describe("sanitizeIntentCanvasScene", () => {
  it("drops Excalidraw runtime collaborators from appState", () => {
    const scene = sanitizeIntentCanvasScene(
      [],
      {
        collaborators: new Map([
          [
            "socket-1",
            {
              username: "Alice",
            },
          ],
        ]),
        gridSize: 20,
        scrollX: 12,
        scrollY: -8,
        viewBackgroundColor: "#fbfaf7",
      },
      {},
    );

    expect(scene.appState).toEqual({
      gridSize: 20,
      scrollX: 12,
      scrollY: -8,
      viewBackgroundColor: "#fbfaf7",
    });
  });

  it("drops legacy JSON collaborators objects before appState is reused as initial data", () => {
    const scene = sanitizeIntentCanvasScene(
      [],
      {
        collaborators: {
          "socket-1": {
            username: "Alice",
          },
        },
        zoom: {
          value: 1,
        },
      },
      {},
    );

    expect(scene.appState).toEqual({
      zoom: {
        value: 1,
      },
    });
  });

  it("normalizes nullable Excalidraw selection maps before appState is reused as initial data", () => {
    const scene = sanitizeIntentCanvasScene(
      [],
      {
        selectedElementIds: null,
        selectedGroupIds: undefined,
        zoom: {
          value: 1,
        },
      },
      {},
    );

    expect(scene.appState).toEqual({
      selectedElementIds: {},
      selectedGroupIds: {},
      zoom: {
        value: 1,
      },
    });
  });

  it("filters malformed elements before loading untrusted scene data", () => {
    const scene = sanitizeIntentCanvasScene(
      [
        null,
        "bad",
        { id: "rect-1", type: "rectangle", x: 1, y: 2, width: 3, height: 4 },
        { id: 42, type: "rectangle" },
        { id: "missing-type" },
      ],
      {},
      {},
    );

    expect(scene.elements).toHaveLength(1);
    expect(scene.elements[0]?.id).toBe("rect-1");
  });

  it("uses light relationship seed palettes when importing semantic graphs", () => {
    const scene = createInitialIntentCanvasScene(null, [
      {
        graphId: "graph-1",
        createdAt: "2026-06-06T00:00:00.000Z",
        nodes: [
          {
            id: "controller-node",
            label: "AppUserController.java",
            kind: "file",
            sourceAnchor: {
              kind: "relationship-node",
              workspaceId: "workspace-1",
              scanRunId: "scan-1",
              nodeId: "controller-node",
              nodeKind: "controller",
              filePath: "src/main/java/AppUserController.java",
            },
            summary: "role:controller",
          },
          {
            id: "service-node",
            label: "UserService.java",
            kind: "file",
            sourceAnchor: {
              kind: "relationship-node",
              workspaceId: "workspace-1",
              scanRunId: "scan-1",
              nodeId: "service-node",
              nodeKind: "service",
              filePath: "src/main/java/UserService.java",
            },
            summary: "role:service",
          },
        ],
        edges: [
          {
            id: "edge-1",
            sourceNodeId: "controller-node",
            targetNodeId: "service-node",
            relationKind: "calls",
            direction: "out",
            label: "call",
          },
        ],
        importOptions: {
          centerNodeId: "controller-node",
        },
      },
    ]);

    const rectangleBackgrounds = scene.elements.flatMap((element) => {
      const rawElement = element as unknown as Record<string, unknown>;
      return rawElement.type === "rectangle" && typeof rawElement.backgroundColor === "string"
        ? [rawElement.backgroundColor]
        : [];
    });
    const textColors = scene.elements.flatMap((element) => {
      const rawElement = element as unknown as Record<string, unknown>;
      return rawElement.type === "text" && typeof rawElement.strokeColor === "string"
        ? [rawElement.strokeColor]
        : [];
    });

    expect(rectangleBackgrounds).toContain("#ecfeff");
    expect(rectangleBackgrounds).toContain("#ecfdf5");
    expect(rectangleBackgrounds).not.toContain("#05252c");
    expect(rectangleBackgrounds).not.toContain("#08261d");
    expect(textColors).toContain("#0e7490");
    expect(textColors).toContain("#047857");
  });

  it("keeps generated relationship node ids unique for long similar file ids", () => {
    const scene = createInitialIntentCanvasScene(null, [
      {
        graphId: "graph-with-long-file-paths",
        createdAt: "2026-06-06T00:00:00.000Z",
        nodes: [
          {
            id: "src/main/java/com/example/demo/controller/SharedVeryLongPrefixAlphaController.java",
            label: "AlphaController.java",
            kind: "file",
            summary: "role:controller",
          },
          {
            id: "src/main/java/com/example/demo/controller/SharedVeryLongPrefixBetaController.java",
            label: "BetaController.java",
            kind: "file",
            summary: "role:controller",
          },
        ],
        edges: [
          {
            id: "calls-shared-prefix",
            sourceNodeId: "src/main/java/com/example/demo/controller/SharedVeryLongPrefixAlphaController.java",
            targetNodeId: "src/main/java/com/example/demo/controller/SharedVeryLongPrefixBetaController.java",
            relationKind: "calls",
            label: "call",
          },
        ],
        importOptions: {
          centerNodeId: "src/main/java/com/example/demo/controller/SharedVeryLongPrefixAlphaController.java",
        },
      },
    ]);
    const ids = scene.elements.map((element) => element.id);
    const generatedNodes = scene.elements.flatMap((element) => {
      const rawElement = element as unknown as Record<string, unknown>;
      return rawElement.type === "rectangle" && typeof rawElement.id === "string" && rawElement.id.startsWith("intent-node-")
        ? [rawElement]
        : [];
    });

    expect(new Set(ids).size).toBe(ids.length);
    generatedNodes.forEach((node) => {
      const textBinding = Array.isArray(node.boundElements)
        ? node.boundElements.find((binding) => (
            typeof binding === "object"
            && binding !== null
            && "type" in binding
            && binding.type === "text"
            && "id" in binding
            && typeof binding.id === "string"
          ))
        : null;
      const textElement = scene.elements.find((element) => element.id === textBinding?.id) as unknown as Record<string, unknown> | undefined;

      expect(textBinding).toBeTruthy();
      expect(typeof textElement?.text === "string" && textElement.text.trim().length > 0).toBe(true);
    });
  });

  it("repairs legacy dark generated relationship elements before rendering", () => {
    const elements = repairIntentCanvasGeneratedElements([
      {
        id: "intent-node-legacy",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 260,
        height: 92,
        strokeColor: "#22d3ee",
        backgroundColor: "#05252c",
        boundElements: [{ id: "intent-node-text-legacy", type: "text" }],
      },
      {
        id: "intent-node-text-legacy",
        type: "text",
        x: 14,
        y: 16,
        width: 232,
        height: 64,
        strokeColor: "#a5f3fc",
        text: "Legacy node",
        originalText: "Legacy node",
        containerId: "intent-node-legacy",
      },
    ] as never);
    const rectangle = elements.find((element) => element.id === "intent-node-legacy") as unknown as Record<string, unknown> | undefined;
    const text = elements.find((element) => element.id === "intent-node-text-legacy") as unknown as Record<string, unknown> | undefined;

    expect(rectangle?.backgroundColor).toBe("#ecfeff");
    expect(text?.strokeColor).toBe("#0e7490");
  });

  it("drops generated relationship rectangles that have no visible label", () => {
    const elements = repairIntentCanvasGeneratedElements([
      {
        id: "intent-node-empty",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 260,
        height: 92,
        strokeColor: "#64748b",
        backgroundColor: "#f8fafc",
        boundElements: null,
      },
    ] as never);

    expect(elements).toHaveLength(0);
  });

  it("does not include deleted elements in AI context", () => {
    const scene = sanitizeIntentCanvasScene(
      [
        { id: "visible", type: "rectangle", text: "Visible", x: 0, y: 0, width: 100, height: 60 },
        { id: "deleted", type: "rectangle", text: "Deleted", isDeleted: true },
        {
          id: "deleted-edge",
          type: "arrow",
          isDeleted: true,
          startBinding: { elementId: "visible" },
        },
      ],
      {},
      {},
    );

    const context = buildIntentCanvasAiContext(scene, "summary");

    expect(context.elementDigest.map((element) => element.id)).toEqual(["visible"]);
    expect(context.relationDigest).toHaveLength(0);
  });

  it("normalizes cyclic appState and files without throwing", () => {
    const appState: Record<string, unknown> = { gridSize: 20 };
    appState.self = appState;
    const files: Record<string, unknown> = { image: { id: "image" } };
    files.self = files;

    const scene = sanitizeIntentCanvasScene([], appState, files);

    expect(scene.appState).toEqual({
      gridSize: 20,
      self: null,
    });
    expect(scene.files).toEqual({
      image: { id: "image" },
      self: null,
    });
  });
});
