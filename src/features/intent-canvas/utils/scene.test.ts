import { describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
  convertToExcalidrawElements: (elements: Array<Record<string, unknown>>) =>
    elements.map((element, index) => ({
      id: `mock-element-${index}`,
      ...element,
    })),
}));

import { buildIntentCanvasAiContext, sanitizeIntentCanvasScene } from "./scene";

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
