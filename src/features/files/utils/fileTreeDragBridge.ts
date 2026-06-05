import type { DragEvent } from "react";

export const CROSS_WINDOW_TREE_DRAG_REBROADCAST_THROTTLE_MS = 120;

const CHAT_DROP_ZONE_SELECTORS = [
  ".chat-input-box",
  ".input-editable-wrapper",
  ".composer-input-area",
];

export function setFileTreeDragBridge(paths: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  document.documentElement.classList.add("file-tree-dragging");
  window.__fileTreeDragPaths = paths;
  window.__fileTreeDragStamp = Date.now();
  window.__fileTreeDragActive = true;
  window.__fileTreeDragOverChat = false;
  window.__fileTreeDragDropped = false;
}

export function setFileTreeDragPosition(x: number, y: number) {
  if (typeof window === "undefined") {
    return;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {
    return;
  }
  window.__fileTreeDragPosition = { x, y };
}

function getChatDropZones() {
  const zones: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  CHAT_DROP_ZONE_SELECTORS.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }
      const container = element.closest(".chat-input-box");
      const zone = container instanceof HTMLElement ? container : element;
      if (seen.has(zone)) {
        return;
      }
      seen.add(zone);
      zones.push(zone);
    });
  });
  return zones;
}

function getChatInputContainerFromElement(element: Element | null): HTMLElement | null {
  if (!element) {
    return null;
  }
  const container = element.closest(".chat-input-box");
  return container instanceof HTMLElement ? container : null;
}

function getSingleChatInputContainer() {
  const containers = Array.from(document.querySelectorAll(".chat-input-box"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  if (containers.length !== 1) {
    return null;
  }
  return containers[0];
}

function clearChatDropTargetHighlight() {
  const highlighted = document.querySelectorAll(".chat-input-box.file-tree-drop-target-active");
  highlighted.forEach((element) => {
    element.classList.remove("file-tree-drop-target-active");
  });
}

function applyChatDropTargetHighlight(target: HTMLElement | null) {
  clearChatDropTargetHighlight();
  if (!target) {
    return;
  }
  const container = getChatInputContainerFromElement(target);
  if (container) {
    container.classList.add("file-tree-drop-target-active");
    return;
  }
  if (target.classList.contains("chat-input-box")) {
    target.classList.add("file-tree-drop-target-active");
  }
}

function resolveChatDropTargetFromPoint(point: { x: number; y: number } | null) {
  if (!point) {
    return null;
  }

  const points = normalizePointCandidates(point);
  if (typeof document.elementFromPoint === "function") {
    for (const candidate of points) {
      const hovered = document.elementFromPoint(candidate.x, candidate.y);
      const container = getChatInputContainerFromElement(hovered);
      if (container) {
        return container;
      }
    }
  }

  const zones = getChatDropZones();
  for (const candidate of points) {
    for (const zone of zones) {
      const rect = zone.getBoundingClientRect();
      if (
        candidate.x >= rect.left &&
        candidate.x <= rect.right &&
        candidate.y >= rect.top &&
        candidate.y <= rect.bottom
      ) {
        return zone;
      }
    }
  }
  return null;
}

function resolveChatDropTargetFromDragEvent(event: globalThis.DragEvent) {
  const eventTarget = event.target instanceof Element ? event.target : null;
  const byTarget = getChatInputContainerFromElement(eventTarget);
  if (byTarget) {
    return byTarget;
  }
  if (
    Number.isFinite(event.clientX) &&
    Number.isFinite(event.clientY) &&
    !(event.clientX === 0 && event.clientY === 0)
  ) {
    return resolveChatDropTargetFromPoint({ x: event.clientX, y: event.clientY });
  }
  return null;
}

export function bindChatDropTargetsForTreeDrag(paths: string[]) {
  const onDocumentDragEnterOrOver = (event: globalThis.DragEvent) => {
    if (typeof window === "undefined" || window.__fileTreeDragActive !== true) {
      return;
    }
    setFileTreeDragPosition(event.clientX, event.clientY);
    const target = resolveChatDropTargetFromDragEvent(event);
    const visualTarget = target ?? getSingleChatInputContainer() ?? null;
    const isOverChat = Boolean(target);
    window.__fileTreeDragOverChat = isOverChat;
    applyChatDropTargetHighlight(visualTarget);
    if (isOverChat) {
      event.preventDefault();
    }
  };

  const onDocumentDragLeave = (event: globalThis.DragEvent) => {
    if (typeof window === "undefined" || window.__fileTreeDragActive !== true) {
      return;
    }
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (related && isChatInputElement(related)) {
      return;
    }
    const target = resolveChatDropTargetFromDragEvent(event);
    if (target) {
      window.__fileTreeDragOverChat = true;
      applyChatDropTargetHighlight(target);
      return;
    }
    window.__fileTreeDragOverChat = false;
    clearChatDropTargetHighlight();
  };

  const onDocumentDrop = (event: globalThis.DragEvent) => {
    if (typeof window === "undefined" || window.__fileTreeDragActive !== true) {
      return;
    }
    setFileTreeDragPosition(event.clientX, event.clientY);
    const target = resolveChatDropTargetFromDragEvent(event) ??
      resolveChatDropTargetFromPoint(window.__fileTreeDragPosition ?? null);
    window.__fileTreeDragOverChat = Boolean(target);
    if (!target) {
      clearFileTreeDragBridge();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (insertPathsIntoChat(paths)) {
      window.__fileTreeDragDropped = true;
    }
    clearFileTreeDragBridge();
  };

  document.addEventListener("dragenter", onDocumentDragEnterOrOver, true);
  document.addEventListener("dragover", onDocumentDragEnterOrOver, true);
  document.addEventListener("dragleave", onDocumentDragLeave, true);
  document.addEventListener("drop", onDocumentDrop, true);

  return () => {
    document.removeEventListener("dragenter", onDocumentDragEnterOrOver, true);
    document.removeEventListener("dragover", onDocumentDragEnterOrOver, true);
    document.removeEventListener("dragleave", onDocumentDragLeave, true);
    document.removeEventListener("drop", onDocumentDrop, true);
    clearChatDropTargetHighlight();
  };
}

function isChatInputElement(node: Element | null) {
  if (!node) {
    return false;
  }
  return CHAT_DROP_ZONE_SELECTORS.some((selector) => Boolean(node.closest(selector)));
}

function normalizePointCandidates(point: { x: number; y: number }) {
  const candidates = [{ x: point.x, y: point.y }];
  const scale = window.devicePixelRatio || 1;
  if (scale !== 1) {
    candidates.push({ x: point.x / scale, y: point.y / scale });
  }
  return candidates;
}

function isPointInsideChatInput(point: { x: number; y: number }) {
  const zones = getChatDropZones();
  if (zones.length === 0) {
    return false;
  }
  const points = normalizePointCandidates(point);
  if (typeof document.elementFromPoint === "function") {
    for (const candidate of points) {
      const hovered = document.elementFromPoint(candidate.x, candidate.y);
      if (isChatInputElement(hovered)) {
        return true;
      }
    }
  }
  return points.some((candidate) =>
    zones.some((zone) => {
      const rect = zone.getBoundingClientRect();
      return (
        candidate.x >= rect.left &&
        candidate.x <= rect.right &&
        candidate.y >= rect.top &&
        candidate.y <= rect.bottom
      );
    }),
  );
}

export function insertPathsIntoChat(paths: string[]) {
  if (typeof window === "undefined" || !window.handleFilePathFromJava) {
    return false;
  }
  if (!Array.isArray(paths) || paths.length === 0) {
    return false;
  }
  if (paths.length === 1) {
    window.handleFilePathFromJava(paths[0] ?? "");
    return true;
  }
  window.handleFilePathFromJava(paths);
  return true;
}

export function triggerChatInputInsertFromTreeDrag(
  event: DragEvent<HTMLButtonElement>,
  fallbackPaths: string[],
) {
  const paths = window.__fileTreeDragPaths ?? fallbackPaths;
  if (!Array.isArray(paths) || paths.length === 0) return false;
  if (window.__fileTreeDragOverChat === true) {
    return insertPathsIntoChat(paths);
  }
  const pointer = (
    Number.isFinite(event.clientX) &&
    Number.isFinite(event.clientY) &&
    !(event.clientX === 0 && event.clientY === 0)
  )
    ? { x: event.clientX, y: event.clientY }
    : window.__fileTreeDragPosition;
  if (pointer) {
    if (!isPointInsideChatInput(pointer)) {
      return false;
    }
  } else {
    const activeElement = document.activeElement instanceof Element
      ? document.activeElement
      : null;
    if (!isChatInputElement(activeElement)) {
      return false;
    }
  }
  return insertPathsIntoChat(paths);
}

export function clearFileTreeDragBridge() {
  if (typeof window === "undefined") {
    return;
  }
  document.documentElement.classList.remove("file-tree-dragging");
  if (typeof window.__fileTreeDragCleanup === "function") {
    try {
      window.__fileTreeDragCleanup();
    } catch {
      // Ignore cleanup failures from stale drag listeners.
    }
  }
  delete window.__fileTreeDragPaths;
  delete window.__fileTreeDragStamp;
  delete window.__fileTreeDragActive;
  delete window.__fileTreeDragPosition;
  delete window.__fileTreeDragOverChat;
  delete window.__fileTreeDragDropped;
  delete window.__fileTreeDragCleanup;
  clearChatDropTargetHighlight();
}

export function isWindowsDragPreviewRuntime() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const platform = (
    (
      navigator as Navigator & {
        userAgentData?: { platform?: string };
      }
    ).userAgentData?.platform ??
    navigator.platform ??
    ""
  ).toLowerCase();
  return platform.includes("win");
}

function getDragPreviewLeafLabel(path: string) {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) || path;
}

export function createWindowsFileTreeDragImage(
  primaryPath: string,
  totalCount: number,
  isFolder: boolean,
) {
  if (typeof document === "undefined") {
    return null;
  }
  const dragImage = document.createElement("div");
  dragImage.setAttribute("aria-hidden", "true");
  dragImage.style.position = "fixed";
  dragImage.style.top = "-9999px";
  dragImage.style.left = "-9999px";
  dragImage.style.pointerEvents = "none";
  dragImage.style.display = "inline-flex";
  dragImage.style.alignItems = "center";
  dragImage.style.gap = "8px";
  dragImage.style.maxWidth = "420px";
  dragImage.style.padding = "8px 12px";
  dragImage.style.borderRadius = "12px";
  dragImage.style.border = "1px solid rgba(37, 99, 235, 0.26)";
  dragImage.style.background = "rgba(23, 27, 36, 0.94)";
  dragImage.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.34)";
  dragImage.style.color = "#e5eefc";
  dragImage.style.fontSize = "12px";
  dragImage.style.fontWeight = "600";
  dragImage.style.lineHeight = "1.2";
  dragImage.style.fontFamily =
    '"SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

  const icon = document.createElement("span");
  icon.textContent = isFolder ? "[DIR]" : "[FILE]";
  icon.style.fontSize = "11px";
  icon.style.flexShrink = "0";
  icon.style.color = "#93c5fd";

  const text = document.createElement("span");
  const primaryLabel = getDragPreviewLeafLabel(primaryPath);
  text.textContent =
    totalCount > 1 ? `${primaryLabel} +${totalCount - 1}` : primaryLabel;
  text.style.whiteSpace = "nowrap";
  text.style.overflow = "hidden";
  text.style.textOverflow = "ellipsis";
  text.style.maxWidth = "340px";

  dragImage.append(icon, text);
  document.body.appendChild(dragImage);

  return {
    element: dragImage,
    cleanup: () => {
      dragImage.remove();
    },
  };
}
