import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntentCanvasManager } from "./IntentCanvasManager";
import type { IntentCanvasDocument, IntentCanvasOpenRequest } from "../types";
import {
  createIntentCanvasDocument,
  loadIntentCanvasIndex,
  saveIntentCanvasDocument,
} from "../services/intentCanvasStorage";

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
});
