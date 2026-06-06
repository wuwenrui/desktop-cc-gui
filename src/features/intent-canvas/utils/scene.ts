import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import type {
  IntentCanvasAiContext,
  IntentCanvasElementDigest,
  IntentCanvasOpenSource,
  IntentCanvasRelationDigest,
  IntentCanvasScene,
} from "../types";
import { isRecord, toJsonObject } from "./json";

type SeedShape = {
  type: "rectangle" | "text" | "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor?: string;
  text?: string;
  fontSize?: number;
};

const EXCALIDRAW_RUNTIME_APP_STATE_KEYS = new Set(["collaborators"]);
const EXCALIDRAW_OBJECT_MAP_APP_STATE_KEYS = new Set(["selectedElementIds", "selectedGroupIds"]);

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function readElementLabel(element: Record<string, unknown>): string | null {
  const candidates = [element.text, element.originalText, element.label];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function buildSeedSkeleton(source: IntentCanvasOpenSource | null | undefined): SeedShape[] {
  const nodeTitle = source?.nodeTitle?.trim();
  const filePath = source?.filePath?.trim();
  const summary = source?.summary?.trim();
  if (nodeTitle || filePath) {
    const primaryLabel = nodeTitle || filePath || "Intent Node";
    const secondaryLabel = filePath && nodeTitle ? filePath : summary || "Describe the logic here";
    return [
      {
        type: "rectangle",
        x: 120,
        y: 160,
        width: 260,
        height: 92,
        strokeColor: "#2563eb",
        backgroundColor: "#eff6ff",
      },
      {
        type: "text",
        x: 130,
        y: 188,
        width: 230,
        height: 32,
        text: secondaryLabel,
        fontSize: 16,
        strokeColor: "#475569",
      },
      {
        type: "text",
        x: 130,
        y: 166,
        width: 230,
        height: 30,
        text: primaryLabel,
        fontSize: 22,
        strokeColor: "#1d4ed8",
      },
      {
        type: "arrow",
        x: 420,
        y: 205,
        width: 220,
        height: 0,
        strokeColor: "#0f172a",
      },
      {
        type: "rectangle",
        x: 680,
        y: 160,
        width: 260,
        height: 92,
        strokeColor: "#0f766e",
        backgroundColor: "#ecfdf5",
      },
      {
        type: "text",
        x: 700,
        y: 188,
        width: 220,
        height: 32,
        text: "Next Module",
        fontSize: 22,
        strokeColor: "#0f766e",
      },
    ];
  }

  return [
    {
      type: "rectangle",
      x: 120,
      y: 160,
      width: 260,
      height: 92,
      strokeColor: "#2563eb",
      backgroundColor: "#eff6ff",
    },
    {
      type: "text",
      x: 140,
      y: 188,
      width: 220,
      height: 32,
      text: "Auth Service",
      fontSize: 22,
      strokeColor: "#1d4ed8",
    },
    {
      type: "arrow",
      x: 420,
      y: 205,
      width: 220,
      height: 0,
      strokeColor: "#0f172a",
    },
    {
      type: "rectangle",
      x: 680,
      y: 160,
      width: 260,
      height: 92,
      strokeColor: "#0f766e",
      backgroundColor: "#ecfdf5",
    },
    {
      type: "text",
      x: 700,
      y: 188,
      width: 220,
      height: 32,
      text: "User DB",
      fontSize: 22,
      strokeColor: "#0f766e",
    },
  ];
}

function createElementId(index: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `intent-seed-${Date.now().toString(36)}-${index}`;
}

function createSeedElement(shape: SeedShape, index: number): OrderedExcalidrawElement {
  const baseElement = {
    id: createElementId(index),
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    angle: 0,
    strokeColor: shape.strokeColor,
    backgroundColor: shape.backgroundColor ?? "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: shape.type === "rectangle" ? { type: 3 } : null,
    seed: index + 1,
    version: 1,
    versionNonce: index + 100,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };

  if (shape.type === "text") {
    return {
      ...baseElement,
      text: shape.text ?? "",
      originalText: shape.text ?? "",
      fontSize: shape.fontSize ?? 18,
      fontFamily: 5,
      textAlign: "left",
      verticalAlign: "top",
      baseline: shape.fontSize ?? 18,
      containerId: null,
      lineHeight: 1.25,
    } as unknown as OrderedExcalidrawElement;
  }

  if (shape.type === "arrow") {
    return {
      ...baseElement,
      points: [
        [0, 0],
        [shape.width, shape.height],
      ],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
      lastCommittedPoint: null,
      elbowed: false,
    } as unknown as OrderedExcalidrawElement;
  }

  return baseElement as unknown as OrderedExcalidrawElement;
}

function isIntentCanvasElement(value: unknown): value is OrderedExcalidrawElement {
  return isRecord(value) && typeof value.id === "string" && typeof value.type === "string";
}

function sanitizeIntentCanvasAppState(appState: Partial<AppState> | unknown): Partial<AppState> {
  if (!isRecord(appState)) {
    return {};
  }
  const safeAppState = Object.entries(appState).reduce<Record<string, unknown>>(
    (current, [key, value]) => {
      if (!EXCALIDRAW_RUNTIME_APP_STATE_KEYS.has(key)) {
        current[key] = EXCALIDRAW_OBJECT_MAP_APP_STATE_KEYS.has(key) && !isRecord(value)
          ? {}
          : value === appState
            ? null
            : value;
      }
      return current;
    },
    {},
  );
  return toJsonObject(safeAppState) as Partial<AppState>;
}

export function sanitizeIntentCanvasScene(
  elements: readonly OrderedExcalidrawElement[] | readonly unknown[],
  appState: Partial<AppState> | unknown,
  files: BinaryFiles | unknown,
): IntentCanvasScene {
  const safeElements: OrderedExcalidrawElement[] = [];
  elements.forEach((element) => {
    if (isIntentCanvasElement(element)) {
      safeElements.push(element);
    }
  });
  return {
    elements: safeElements,
    appState: sanitizeIntentCanvasAppState(appState),
    files: toJsonObject(files) as BinaryFiles,
  };
}

export function createInitialIntentCanvasScene(
  source?: IntentCanvasOpenSource | null,
): IntentCanvasScene {
  const elements = buildSeedSkeleton(source).map(createSeedElement);
  return sanitizeIntentCanvasScene(
    elements,
    {
      viewBackgroundColor: "#fbfaf7",
      gridSize: 20,
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
    },
    {},
  );
}

export function buildIntentCanvasAiContext(
  scene: IntentCanvasScene,
  summary: string,
): IntentCanvasAiContext {
  const elementDigest: IntentCanvasElementDigest[] = [];
  const relationDigest: IntentCanvasRelationDigest[] = [];

  scene.elements.forEach((element) => {
    const rawElement = element as unknown as Record<string, unknown>;
    if (rawElement.isDeleted === true) {
      return;
    }
    const type = typeof rawElement.type === "string" ? rawElement.type : "unknown";
    const id = typeof rawElement.id === "string" ? rawElement.id : `${type}-${elementDigest.length + 1}`;
    const label = readElementLabel(rawElement);
    if (type === "arrow" || type === "line") {
      const startBinding = isRecord(rawElement.startBinding) ? rawElement.startBinding : null;
      const endBinding = isRecord(rawElement.endBinding) ? rawElement.endBinding : null;
      relationDigest.push({
        id,
        type,
        label,
        startBindingId: typeof startBinding?.elementId === "string" ? startBinding.elementId : null,
        endBindingId: typeof endBinding?.elementId === "string" ? endBinding.elementId : null,
      });
    }
    elementDigest.push({
      id,
      type,
      label,
      x: finiteNumber(rawElement.x),
      y: finiteNumber(rawElement.y),
      width: finiteNumber(rawElement.width),
      height: finiteNumber(rawElement.height),
    });
  });

  return {
    elementDigest: elementDigest.slice(0, 80),
    relationDigest: relationDigest.slice(0, 80),
    lastContextSnapshot: JSON.stringify(
      {
        summary: summary.trim(),
        elements: elementDigest.slice(0, 40),
        relations: relationDigest.slice(0, 40),
      },
      null,
      2,
    ),
  };
}
